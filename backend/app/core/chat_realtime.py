"""Bounded, single-process chat delivery. MSSQL remains the durable message store."""

import asyncio
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field

from fastapi import HTTPException, WebSocket


class RateLimiter:
    """Bounded token buckets shared by HTTP worker threads and socket tasks."""

    def __init__(self, maximum_entries=10000):
        self.maximum_entries = maximum_entries
        self._buckets = OrderedDict()
        self._lock = threading.Lock()

    def consume(self, key: str, *, rate: float, burst: int):
        now = time.monotonic()
        with self._lock:
            previous = self._buckets.pop(key, (float(burst), now))
            tokens = min(float(burst), previous[0] + (now - previous[1]) * rate)
            accepted = tokens >= 1
            self._buckets[key] = (tokens - 1 if accepted else tokens, now)
            # Refuse new identities when the live table is full instead of
            # evicting another caller's active bucket and resetting their limit.
            while len(self._buckets) > self.maximum_entries:
                oldest_key, (_, updated) = next(iter(self._buckets.items()))
                if now - updated < 600:
                    self._buckets.pop(key, None)
                    return False
                self._buckets.pop(oldest_key)
            return accepted

    def require(self, key: str, *, rate: float = 2, burst: int = 60):
        if not self.consume(key, rate=rate, burst=burst):
            raise HTTPException(status_code=429, detail="Chat rate limit exceeded", headers={"Retry-After": "1"})


@dataclass(eq=False)
class Connection:
    socket: WebSocket
    user_id: int
    handle: str
    public_device_id: str
    expires_at: float
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=16))
    closing: bool = False
    subscriptions: dict[str, tuple[int, str]] = field(default_factory=dict)


class ChatHub:
    """One-worker hub. Queues ciphertext briefly; never holds plaintext or keys."""

    def __init__(self):
        self.limiter = RateLimiter()
        self._connections: set[Connection] = set()
        self._lock = threading.RLock()
        self._pending_auth = 0
        self._typing: dict[tuple[int, str], float] = {}

    def reserve_auth(self, maximum: int):
        with self._lock:
            if self._pending_auth >= maximum:
                return False
            self._pending_auth += 1
            return True

    def release_auth(self):
        with self._lock:
            self._pending_auth = max(0, self._pending_auth - 1)

    def register(self, socket, user_id, handle, device_id, expires_at, *, max_per_user=8, maximum=512):
        with self._lock:
            if len(self._connections) >= maximum:
                raise HTTPException(status_code=429, detail="Chat connection capacity reached")
            if sum(connection.user_id == user_id for connection in self._connections) >= max_per_user:
                raise HTTPException(status_code=429, detail="Too many chat connections")
            connection = Connection(socket, user_id, handle, device_id, expires_at, asyncio.get_running_loop())
            self._connections.add(connection)
            return connection

    def unregister(self, connection):
        with self._lock:
            self._connections.discard(connection)
            # Other devices/tabs still online keep user presence online.
            return not any(item.user_id == connection.user_id for item in self._connections)

    def online(self, user_id):
        with self._lock:
            return any(item.user_id == user_id and item.expires_at > time.time() for item in self._connections)

    @staticmethod
    def _enqueue(connection, event):
        def put():
            if connection.closing:
                return
            try:
                connection.queue.put_nowait(event)
            except asyncio.QueueFull:
                connection.closing = True
                # Disconnect slow clients; they recover from durable pending pull.
                asyncio.create_task(connection.socket.close(code=1013, reason="Reconnect to recover pending messages"))
        if not connection.loop.is_closed():
            connection.loop.call_soon_threadsafe(put)

    def publish(self, user_ids, event, *, device_id=None):
        with self._lock:
            targets = [connection for connection in self._connections if connection.user_id in user_ids
                       and connection.expires_at > time.time() and not connection.closing
                       and (device_id is None or connection.public_device_id == device_id)]
        for connection in targets:
            self._enqueue(connection, event)

    def publish_messages(self, deliveries):
        for user_id, device_id, message in deliveries:
            self.publish((user_id,), {"type": "message.receive", "data": message.model_dump(mode="json")}, device_id=device_id)

    def revoke(self, device_id):
        with self._lock:
            targets = [connection for connection in self._connections if connection.public_device_id == device_id]
        for connection in targets:
            self._enqueue(connection, {"type": "device.revoked", "data": {"public_device_id": device_id}})
            def close(item=connection):
                asyncio.create_task(item.socket.close(code=4403, reason="Device revoked"))
            if not connection.loop.is_closed():
                connection.loop.call_soon_threadsafe(close)

    def presence(self, user_id, handle, online):
        with self._lock:
            targets = [(connection, conversation) for connection in self._connections
                       for conversation, (peer_id, _) in connection.subscriptions.items() if peer_id == user_id]
        for connection, conversation in targets:
            self._enqueue(connection, {"type": "user.online" if online else "user.offline",
                                       "data": {"user_handle": handle, "public_conversation_id": conversation}})

    def typing(self, user_id, conversation, active):
        with self._lock:
            key = (user_id, conversation)
            if active:
                self._typing[key] = time.monotonic() + 6
            else:
                self._typing.pop(key, None)
        if active:
            # Expire promptly even when every socket remains idle. Refreshes
            # replace the deadline; an older timer cannot clear new typing.
            try:
                asyncio.get_running_loop().call_later(6.05, self.expire_typing)
            except RuntimeError:
                pass

    def expire_typing(self):
        now = time.monotonic()
        with self._lock:
            expired = [key for key, expiry in self._typing.items() if expiry <= now]
            for key in expired:
                self._typing.pop(key, None)
            targets = [(connection, conversation, handle) for user_id, conversation in expired
                       for connection in self._connections
                       for subscribed, (peer_id, handle) in connection.subscriptions.items()
                       if subscribed == conversation and peer_id == user_id]
        for connection, conversation, handle in targets:
            self._enqueue(connection, {"type": "typing.stop", "data": {"user_handle": handle, "public_conversation_id": conversation}})


hub = ChatHub()
