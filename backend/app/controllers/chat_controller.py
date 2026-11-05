"""REST and authenticated WebSocket adapters for the existing chat service."""

import asyncio
import json
import os
import time

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.chat_realtime import hub
from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.exceptions import AppError
from app.core.security import decode_access_token, oauth2_scheme, resolve_token_user
from app.models.identity import User
from app.schemas.chat import (
    MAX_CIPHERTEXT_BYTES, PROTOCOL_VERSION, ConversationCreate, ConversationPublic,
    DeviceAction, DevicePublic, DeviceRegister, KeyBundle, KeyClaim, KeysUpload, MessageAccepted,
    MessagePage, MessageSend, ReceiptInput, ReceiptPublic, SocketAuth, SocketEvent,
    TypingInput,
)
from app.services.chat_service import ChatService

settings = get_settings()


def chat_ready():
    return settings.chat_enabled and settings.chat_schema_ready and settings.chat_crypto_ready


def validate_chat_runtime():
    """Validate operator settings without opening a database connection."""
    if not settings.chat_enabled:
        return
    workers = int(os.environ.get("WEB_CONCURRENCY", settings.chat_worker_count))
    if workers != 1 or settings.chat_worker_count != 1:
        raise RuntimeError("Chat's in-process hub requires one API worker; shared realtime state is not configured")
    if settings.app_env != "development" and (len(settings.secret_key) < 32 or settings.secret_key in ("change-me", "change-me-generate-a-long-random-string")):
        raise RuntimeError("Chat requires an explicit production JWT secret")


def require_chat_enabled():
    if not chat_ready():
        raise HTTPException(status_code=503, detail="Encrypted messaging is not enabled; manual migration and crypto validation are required")
    validate_chat_runtime()


class ChatRoute(APIRoute):
    """Redact validation/database failures and bound JSON before Pydantic parsing."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def guarded(request: Request):
            if request.method in ("POST", "PUT", "PATCH"):
                chunks = []
                size = 0
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > settings.chat_max_frame_bytes:
                        return JSONResponse(status_code=413, content={"detail": "Chat request too large"})
                    chunks.append(chunk)
                request._body = b"".join(chunks)
            try:
                return await original(request)
            except (RequestValidationError, RecursionError):
                return JSONResponse(status_code=422, content={"detail": "Invalid chat request"})
            except SQLAlchemyError:
                # Do not echo SQL, bound data, connection details, or migration assumptions.
                return JSONResponse(status_code=503, content={"detail": "Messaging storage unavailable; verify the manual migration and retry"})
        return guarded


router = APIRouter(prefix="/chat", route_class=ChatRoute)


@router.get("/config")
def chat_config():
    return {"enabled": chat_ready(), "protocol_version": PROTOCOL_VERSION,
            "max_ciphertext_bytes": MAX_CIPHERTEXT_BYTES,
            "max_devices_per_user": settings.chat_max_devices_per_user}


def chat_db(_=Depends(require_chat_enabled)):
    yield from get_db()


def chat_user(request: Request, db: Session = Depends(chat_db), token: str = Depends(oauth2_scheme)):
    address = request.client.host if request.client else "unknown"
    hub.limiter.require(f"http-ip:{address}", rate=10, burst=120)
    local_http = settings.app_env == "development" and settings.chat_allow_insecure_localhost and request.url.hostname in ("localhost", "127.0.0.1", "host.docker.internal", "testserver")
    if request.url.scheme != "https" and not local_http:
        raise HTTPException(status_code=403, detail="Encrypted messaging requires HTTPS")
    user = resolve_token_user(db, token)
    hub.limiter.require(f"http-user:{user.id}", rate=4, burst=90)
    return user


def service(db: Session = Depends(chat_db)):
    return ChatService(db, max_devices=settings.chat_max_devices_per_user)


@router.get("/conversations", response_model=list[ConversationPublic])
def conversations(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=10000),
                  current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.list_conversations(current, limit, offset)


@router.post("/conversations", response_model=ConversationPublic)
def create_conversation(data: ConversationCreate, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.create_conversation(current, data)


@router.get("/conversations/{public_id}", response_model=ConversationPublic)
def conversation(public_id: str, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.get_conversation(current, public_id)


@router.get("/conversations/{public_id}/messages", response_model=MessagePage)
def messages(public_id: str, public_device_id: str = Query(min_length=10, max_length=40),
             before_id: str | None = Query(None, max_length=40), limit: int = Query(50, ge=1, le=100),
             current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.history(current, public_id, public_device_id, limit, before_id)


@router.post("/messages", response_model=MessageAccepted)
def send_message(data: MessageSend, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    result, deliveries = chat.send_message(current, data)
    hub.publish_messages(deliveries)
    return result


@router.get("/devices", response_model=list[DevicePublic])
def devices(current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.list_devices(current)


@router.post("/devices", response_model=DevicePublic)
def register_device(data: DeviceRegister, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.register_device(current, data)


@router.post("/devices/{public_id}/revoke", response_model=DevicePublic)
def revoke_device(public_id: str, data: DeviceAction | None = None,
                  current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    if data is not None and data.public_device_id != public_id:
        raise HTTPException(status_code=422, detail="Device identifier mismatch")
    result = chat.revoke_device(current, public_id)
    hub.revoke(public_id)
    return result


@router.get("/devices/{public_id}/pending", response_model=MessagePage)
def pending(public_id: str, limit: int = Query(50, ge=1, le=100),
            after_id: str | None = Query(None, max_length=40),
            current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.pending(current, public_id, limit, after_id)


@router.post("/keys/upload")
def upload_keys(data: KeysUpload, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    hub.limiter.require(f"key-upload:{current.id}", rate=0.1, burst=12)
    return chat.upload_keys(current, data)


@router.get("/keys/{handle}", response_model=list[KeyBundle])
def keys(handle: str, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    return chat.key_directory(current, handle)


@router.post("/keys/{handle}/claim", response_model=list[KeyBundle])
def claim_keys(handle: str, data: KeyClaim, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    hub.limiter.require(f"key-claim:{current.id}", rate=0.5, burst=10)
    return chat.claim_keys(current, handle, data)


@router.post("/messages/{public_id}/receipts", response_model=ReceiptPublic)
def receipt(public_id: str, data: ReceiptInput, current: User = Depends(chat_user), chat: ChatService = Depends(service)):
    result, members = chat.receipt(current, public_id, data)
    hub.publish(members, {"type": f"message.{result.status}", "data": result.model_dump(mode="json")})
    return result


def socket_authenticate(token, public_device_id):
    require_chat_enabled()
    with SessionLocal() as db:
        current = resolve_token_user(db, token)
        chat = ChatService(db)
        chat.require_device(current.id, public_device_id)
        subscriptions = {}
        for row in chat.repo.conversations(current.id, limit=100):
            peer = chat._peer(current.id, row)
            subscriptions[row.public_conversation_id] = (peer.id, peer.user_handle)
        payload = decode_access_token(token)
        return current.id, current.user_handle, float(payload["exp"]), subscriptions


def socket_operation(token, public_device_id, event):
    with SessionLocal() as db:
        current = resolve_token_user(db, token)
        chat = ChatService(db, max_devices=settings.chat_max_devices_per_user)
        chat.require_device(current.id, public_device_id)
        if event is None:
            return None
        if event.type == "message.send":
            data = MessageSend.model_validate(event.data)
            if data.public_device_id != public_device_id:
                raise HTTPException(status_code=403, detail="Socket device does not match message device")
            result, deliveries = chat.send_message(current, data)
            hub.publish_messages(deliveries)
            return "message.sent", result.model_dump(mode="json")
        if event.type in ("message.delivered", "message.read"):
            data = dict(event.data)
            message_id = data.pop("public_message_id", None)
            if not isinstance(message_id, str) or len(message_id) > 40:
                raise ValueError("Message identifier required")
            supplied = data.pop("public_device_id", public_device_id)
            if supplied != public_device_id:
                raise HTTPException(status_code=403, detail="Socket device does not match receipt device")
            if data:
                raise ValueError("Unexpected receipt fields")
            request = ReceiptInput(public_device_id=public_device_id, status=event.type.removeprefix("message."))
            result, members = chat.receipt(current, message_id, request)
            hub.publish(members, {"type": f"message.{result.status}", "data": result.model_dump(mode="json")})
            return "receipt.ok", result.model_dump(mode="json")
        typing = TypingInput.model_validate(event.data)
        peer_id, peer_handle = chat.peer_presence(current, typing.public_conversation_id)
        return event.type, {"public_conversation_id": typing.public_conversation_id,
                            "peer_id": peer_id, "peer_handle": peer_handle, "user_handle": current.user_handle}


async def _writer(connection):
    while True:
        event = await connection.queue.get()
        await connection.socket.send_json(event)


@router.websocket("/ws")
async def websocket_chat(socket: WebSocket):
    origin = socket.headers.get("origin")
    if not chat_ready() or origin not in settings.chat_origin_list or socket.query_params:
        await socket.close(code=4403)
        return
    host = socket.url.hostname
    local_http = settings.app_env == "development" and settings.chat_allow_insecure_localhost and host in ("localhost", "127.0.0.1", "host.docker.internal", "testserver")
    if socket.url.scheme != "wss" and not local_http:
        await socket.close(code=4403)
        return
    address = socket.client.host if socket.client else "unknown"
    if not hub.limiter.consume(f"ws-connect:{address}", rate=0.5, burst=12) or not hub.reserve_auth(settings.chat_max_pending_auth):
        await socket.close(code=4429)
        return
    reserved = True
    connection = None
    writer = None
    try:
        await socket.accept()
        raw = await asyncio.wait_for(socket.receive_text(), timeout=settings.chat_auth_timeout_seconds)
        if len(raw.encode("utf-8")) > 8192:
            await socket.close(code=4400)
            return
        auth = SocketAuth.model_validate_json(raw)
        user_id, handle, expiry, subscriptions = await run_in_threadpool(socket_authenticate, auth.token, auth.public_device_id)
        connection = hub.register(socket, user_id, handle, auth.public_device_id, expiry,
                                  max_per_user=settings.chat_max_connections_per_user, maximum=settings.chat_max_connections)
        connection.subscriptions.update(subscriptions)
        hub.release_auth()
        reserved = False
        await socket.send_json({"type": "auth.ok", "data": {"public_device_id": auth.public_device_id}})
        writer = asyncio.create_task(_writer(connection))
        for conversation_id, (peer_id, peer_handle) in subscriptions.items():
            hub._enqueue(connection, {"type": "user.online" if hub.online(peer_id) else "user.offline",
                                      "data": {"user_handle": peer_handle, "public_conversation_id": conversation_id}})
        hub.presence(user_id, handle, True)
        while True:
            remaining = expiry - time.time()
            if remaining <= 0:
                await socket.close(code=4401, reason="Authentication expired")
                break
            try:
                raw = await asyncio.wait_for(socket.receive_text(), timeout=min(20, remaining))
            except asyncio.TimeoutError:
                await run_in_threadpool(socket_operation, auth.token, auth.public_device_id, None)
                hub.expire_typing()
                continue
            if len(raw.encode("utf-8")) > settings.chat_max_frame_bytes:
                await socket.close(code=4400, reason="Frame too large")
                break
            if not hub.limiter.consume(f"ws-user:{user_id}", rate=4, burst=60):
                await socket.close(code=4429, reason="Rate limit exceeded")
                break
            try:
                event = SocketEvent.model_validate_json(raw)
                result_type, result = await run_in_threadpool(socket_operation, auth.token, auth.public_device_id, event)
                if event.type in ("typing.start", "typing.stop", "presence.subscribe"):
                    conversation_id = result["public_conversation_id"]
                    if len(connection.subscriptions) >= 100 and conversation_id not in connection.subscriptions:
                        raise ValueError("Subscription limit exceeded")
                    connection.subscriptions[conversation_id] = (result["peer_id"], result["peer_handle"])
                    if event.type == "presence.subscribe":
                        hub._enqueue(connection, {"type": "user.online" if hub.online(result["peer_id"]) else "user.offline",
                            "data": {"public_conversation_id": conversation_id, "user_handle": result["peer_handle"]}})
                    else:
                        hub.typing(user_id, conversation_id, event.type == "typing.start")
                        hub.publish((result["peer_id"],), {"type": event.type,
                            "data": {"public_conversation_id": conversation_id, "user_handle": handle}})
                else:
                    hub._enqueue(connection, {"type": result_type, "request_id": event.request_id, "data": result})
            except (ValidationError, ValueError, json.JSONDecodeError):
                hub._enqueue(connection, {"type": "error", "data": {"code": 422, "detail": "Invalid chat event"}})
            except AppError as exc:
                hub._enqueue(connection, {"type": "error", "data": {"code": exc.status_code, "detail": exc.detail}})
            except HTTPException as exc:
                if exc.status_code in (401, 403):
                    await socket.close(code=4401 if exc.status_code == 401 else 4403)
                    break
                hub._enqueue(connection, {"type": "error", "data": {"code": exc.status_code, "detail": exc.detail}})
            except SQLAlchemyError:
                hub._enqueue(connection, {"type": "error", "data": {"code": 503, "detail": "Messaging storage unavailable"}})
    except (asyncio.TimeoutError, ValidationError, ValueError, KeyError, jwt.PyJWTError):
        await socket.close(code=4401)
    except (AppError, HTTPException, SQLAlchemyError):
        await socket.close(code=4403)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        if reserved:
            hub.release_auth()
        if writer is not None:
            writer.cancel()
            try:
                await writer
            except (asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
                pass
        if connection is not None and hub.unregister(connection):
            hub.presence(connection.user_id, connection.handle, False)
