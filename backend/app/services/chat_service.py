"""One-to-one encrypted message relay; plaintext and private keys never enter here."""

import hashlib
import hmac
import json
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.models.chat import ChatConversation, ChatDevice, ChatMessage, ChatMessageEnvelope, ChatPreKey
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat import (
    PROTOCOL_VERSION, ConversationPublic, DevicePublic, KeyBundle, MessageAccepted,
    MessagePage, MessageView, PeerPublic, PreKeyPublic, ReceiptPublic, decode_blob, encode_blob,
)
from app.services.base import BaseService
from app.utils import utcnow
from app.utils.ids import new_public_id


class ChatService(BaseService):
    def __init__(self, db, *, repository=None, max_devices: int = 8):
        super().__init__(db)
        self.repo = repository or ChatRepository(db)
        self.max_devices = max_devices

    def require_device(self, user_id: int, public_id: str, *, lock: bool = False):
        device = self.repo.device(public_id, lock=lock)
        if device is None or device.user_id != user_id or device.revoked_at is not None:
            raise ForbiddenError("Active owned chat device required")
        return device

    def require_conversation(self, user_id: int, public_id: str):
        conversation = self.repo.conversation(public_id)
        # Uniform response avoids exposing whether an unrelated conversation exists.
        if conversation is None or user_id not in self._members(conversation):
            raise NotFoundError("Conversation not found")
        return conversation

    @staticmethod
    def _members(conversation):
        return (conversation.participant_low_user_id, conversation.participant_high_user_id)

    def _peer(self, user_id: int, conversation):
        peer_id = next(member for member in self._members(conversation) if member != user_id)
        peer = self.repo.user(peer_id)
        if peer is None:
            raise NotFoundError("Conversation peer not found")
        return peer

    def _conversation_public(self, user_id: int, conversation):
        peer = self._peer(user_id, conversation)
        return ConversationPublic(
            public_conversation_id=conversation.public_conversation_id,
            peer=PeerPublic(user_handle=peer.user_handle, full_name=peer.full_name, avatar_storage_key=peer.avatar_storage_key),
            created_at=conversation.created_at, updated_at=conversation.updated_at,
        )

    def device_public(self, device, *, include_counts=False):
        owner = self.repo.user(device.user_id)
        now = utcnow()
        return DevicePublic(
            public_device_id=device.public_device_id, user_handle=owner.user_handle,
            signal_device_id=device.signal_device_id, registration_id=device.registration_id,
            protocol_version=device.protocol_version, identity_public_key=encode_blob(device.identity_public_key),
            label=device.label, created_at=device.created_at, revoked_at=device.revoked_at,
            available_ec_one_time=self.repo.available_prekey_count(device.id, "ec_one_time", now) if include_counts else None,
            available_kem_one_time=self.repo.available_prekey_count(device.id, "kem_one_time", now) if include_counts else None,
        )

    def list_conversations(self, user, limit=50, offset=0):
        return [self._conversation_public(user.id, row) for row in self.repo.conversations(user.id, limit, offset)]

    def get_conversation(self, user, public_id):
        return self._conversation_public(user.id, self.require_conversation(user.id, public_id))

    def create_conversation(self, user, data):
        peer = self.repo.user_by_handle(data.recipient_handle)
        if peer is None:
            raise NotFoundError("Recipient not found")
        if peer.id == user.id:
            raise UnprocessableError("Choose another user")
        low, high = sorted((user.id, peer.id))
        row = self.repo.conversation_pair(low, high)
        if row is None:
            now = utcnow()
            row = ChatConversation(public_conversation_id=new_public_id("chat"), participant_low_user_id=low,
                                   participant_high_user_id=high, created_at=now, updated_at=now)
            try:
                self.repo.add_row(row)
                self.repo.commit()
            except IntegrityError:
                self.repo.rollback()
                row = self.repo.conversation_pair(low, high)
                if row is None:
                    raise ConflictError("Conversation creation conflicted; retry") from None
        return self._conversation_public(user.id, row)

    def list_devices(self, user):
        return [self.device_public(row, include_counts=True) for row in self.repo.devices(user.id, active_only=False)]

    def register_device(self, user, data):
        self.repo.user(user.id, lock=True)  # Serialize device roster changes per user.
        identity = decode_blob(data.identity_public_key, minimum=33, maximum=33)
        existing = self.repo.device_number(user.id, data.signal_device_id)
        if existing is not None:
            if (existing.revoked_at is None and existing.registration_id == data.registration_id
                    and existing.protocol_version == data.protocol_version
                    and hmac.compare_digest(existing.identity_public_key, identity)):
                self.repo.commit()
                return self.device_public(existing)
            raise ConflictError("Device number is already reserved; choose a new number")
        if len(self.repo.devices(user.id)) >= self.max_devices:
            raise ConflictError("Active device limit reached; revoke an old device first")
        now = utcnow()
        row = ChatDevice(public_device_id=new_public_id("dev"), user_id=user.id,
                         signal_device_id=data.signal_device_id, registration_id=data.registration_id,
                         protocol_version=data.protocol_version, identity_public_key=identity,
                         label=data.label, created_at=now, last_seen_at=now)
        self.repo.add_row(row)
        try:
            self.repo.commit()
        except IntegrityError:
            self.repo.rollback()
            raise ConflictError("Device registration conflicted; retry with the same device credentials") from None
        return self.device_public(row)

    def revoke_device(self, user, public_id):
        self.repo.user(user.id, lock=True)
        row = self.repo.device(public_id, lock=True)
        if row is None or row.user_id != user.id:
            raise NotFoundError("Device not found")
        row.revoked_at = row.revoked_at or utcnow()
        self.repo.commit()
        return self.device_public(row)

    @staticmethod
    def _naive_utc(value: datetime | None):
        if value is None:
            return None
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value

    @staticmethod
    def _key_public(key):
        return PreKeyPublic(key_kind=key.key_kind, key_id=key.key_id, public_key=encode_blob(key.public_key),
                            signature=encode_blob(key.signature) if key.signature is not None else None,
                            expires_at=key.expires_at)

    def upload_keys(self, user, data):
        device = self.require_device(user.id, data.public_device_id, lock=True)
        now = utcnow()
        for item in data.prekeys:
            expiry = self._naive_utc(item.expires_at)
            if expiry is not None and expiry <= now:
                raise UnprocessableError("Prekey expiry must be in the future")
            public_key = decode_blob(item.public_key, maximum=1569)
            signature = decode_blob(item.signature, minimum=64, maximum=64) if item.signature else None
            existing = self.repo.prekey(device.id, item.key_kind, item.key_id)
            if existing is not None:
                if existing.public_key != public_key or existing.signature != signature:
                    raise ConflictError("Prekey ID cannot be replaced with different key material")
                # An idempotent upload must never clear a claim or retirement.
                continue
            if item.key_kind in ("ec_signed", "kem_last_resort"):
                for old in self.repo.prekeys(device.id, item.key_kind):
                    if old.retired_at is None:
                        old.retired_at = now
            self.repo.add_row(ChatPreKey(device_id=device.id, key_kind=item.key_kind, key_id=item.key_id,
                                         protocol_version=PROTOCOL_VERSION, public_key=public_key, signature=signature,
                                         created_at=now, expires_at=expiry))
        try:
            self.repo.commit()
        except IntegrityError:
            self.repo.rollback()
            raise ConflictError("Prekey upload conflicted; retry") from None
        return {"message": "Public prekeys uploaded"}

    def _key_peer(self, user, handle):
        peer = self.repo.user_by_handle(handle)
        if peer is None:
            raise NotFoundError("User not found")
        if peer.id != user.id:
            low, high = sorted((user.id, peer.id))
            if self.repo.conversation_pair(low, high) is None:
                raise ForbiddenError("Create a conversation before requesting peer keys")
        return peer

    def key_directory(self, user, handle):
        peer = self._key_peer(user, handle)
        now = utcnow()
        bundles = []
        for device in self.repo.devices(peer.id):
            keys = [self.repo.available_prekey(device.id, kind, now) for kind in ("ec_signed", "kem_last_resort")]
            bundles.append(KeyBundle(device=self.device_public(device), prekeys=[self._key_public(key) for key in keys if key]))
        return bundles

    def claim_keys(self, user, handle, data):
        caller = self.require_device(user.id, data.public_device_id)
        peer = self._key_peer(user, handle)
        # Use the same user -> device -> prekey lock order as sending and
        # revocation, and stabilize the roster while collecting all bundles.
        for user_id in sorted({user.id, peer.id}):
            active = self.repo.user(user_id, lock=True)
            if active is None or not active.is_active:
                raise ForbiddenError("Conversation participant is inactive")
        bundles = []
        now = utcnow()
        entries = {entry.id: entry for entry in self.repo.devices(peer.id)}
        entries[caller.id] = caller
        locked = {entry.id: self.repo.device(entry.public_device_id, lock=True)
                  for entry in sorted(entries.values(), key=lambda row: row.id)}
        # Lock all involved devices in one global order, including the caller.
        self.require_device(user.id, data.public_device_id)
        for entry in sorted(entries.values(), key=lambda row: row.id):
            device = locked[entry.id]
            if device is None or device.revoked_at is not None:
                continue
            if device.user_id != peer.id:
                continue
            signed = self.repo.available_prekey(device.id, "ec_signed", now)
            if signed is None:
                raise ConflictError("Recipient device has no active signed prekey")
            kem = self.repo.claim_one_time(device.id, "kem_one_time", now)
            if kem is None:
                kem = self.repo.available_prekey(device.id, "kem_last_resort", now)
            if kem is None:
                raise ConflictError("Recipient device has no active KEM prekey")
            one_time = self.repo.claim_one_time(device.id, "ec_one_time", now)
            bundles.append(KeyBundle(device=self.device_public(device), prekeys=[self._key_public(key) for key in (signed, one_time, kem) if key]))
        self.repo.commit()
        return bundles

    @staticmethod
    def _digest(data):
        record = data.model_dump(mode="json")
        record["envelopes"] = sorted(record["envelopes"], key=lambda item: item["recipient_device_id"])
        return hashlib.sha256(json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")).digest()

    def send_message(self, user, data):
        conversation = self.require_conversation(user.id, data.public_conversation_id)
        # Roster locks make the required fanout consistent with registration/revocation.
        for member in sorted(self._members(conversation)):
            active = self.repo.user(member, lock=True)
            if active is None or not active.is_active:
                raise ForbiddenError("Conversation participant is inactive")
        device = self.require_device(user.id, data.public_device_id, lock=True)
        digest = self._digest(data)
        existing = self.repo.duplicate(device.id, data.client_message_id)
        if existing is not None:
            if existing.conversation_id != conversation.id or not hmac.compare_digest(existing.request_digest, digest):
                raise ConflictError("Client message ID was already used for different content")
            self.repo.commit()
            return MessageAccepted(public_message_id=existing.public_message_id, client_message_id=existing.client_message_id,
                                   created_at=existing.created_at, duplicate=True), []
        targets = {}
        for member in self._members(conversation):
            for target in self.repo.devices(member):
                if target.id != device.id:
                    targets[target.public_device_id] = target
        peer_id = next(member for member in self._members(conversation) if member != user.id)
        if not any(target.user_id == peer_id for target in targets.values()):
            raise ConflictError("Recipient has no active messaging device")
        if set(targets) != {item.recipient_device_id for item in data.envelopes}:
            raise ConflictError("Device roster changed; refresh keys and prepare a new encrypted message")
        now = utcnow()
        message = ChatMessage(public_message_id=new_public_id("msg"), conversation_id=conversation.id,
                              sender_user_id=user.id, sender_device_id=device.id, client_message_id=data.client_message_id,
                              request_digest=digest, created_at=now)
        self.repo.add_row(message)
        try:
            self.repo.flush()
            for item in data.envelopes:
                target = targets[item.recipient_device_id]
                self.repo.add_row(ChatMessageEnvelope(message_id=message.id, recipient_user_id=target.user_id,
                    recipient_device_id=target.id, protocol_version=PROTOCOL_VERSION, message_type=item.message_type,
                    ciphertext=decode_blob(item.ciphertext), created_at=now))
            conversation.updated_at = now
            self.repo.commit()
        except IntegrityError:
            self.repo.rollback()
            existing = self.repo.duplicate(device.id, data.client_message_id)
            if existing is not None and hmac.compare_digest(existing.request_digest, digest):
                return MessageAccepted(public_message_id=existing.public_message_id, client_message_id=existing.client_message_id,
                                       created_at=existing.created_at, duplicate=True), []
            raise ConflictError("Message acceptance conflicted; retry") from None
        events = [(target.user_id, target.public_device_id, self.message_view(message, target.id)) for target in targets.values()]
        return MessageAccepted(public_message_id=message.public_message_id, client_message_id=message.client_message_id, created_at=now), events

    def message_status(self, message):
        # Sync envelopes to the sender's other devices do not count as peer receipts.
        peer_envelopes = [item for item in self.repo.envelopes(message.id) if item.recipient_user_id != message.sender_user_id]
        if any(item.read_at is not None for item in peer_envelopes):
            return "read"
        if any(item.delivered_at is not None for item in peer_envelopes):
            return "delivered"
        return "sent"

    def message_view(self, message, device_id: int):
        conversation = self.repo.conversation_by_id(message.conversation_id)
        sender = self.repo.user(message.sender_user_id)
        device = self.repo.device_by_id(message.sender_device_id)
        envelope = self.repo.envelope(message.id, device_id)
        target = self.repo.device_by_id(device_id)
        return MessageView(public_message_id=message.public_message_id, public_conversation_id=conversation.public_conversation_id,
                           client_message_id=message.client_message_id, sender_handle=sender.user_handle,
                           sender_device=self.device_public(device), created_at=message.created_at, status=self.message_status(message),
                           ciphertext=encode_blob(envelope.ciphertext) if envelope is not None else None,
                           message_type=envelope.message_type if envelope is not None else None,
                           recipient_device_id=target.public_device_id if envelope is not None else None)

    def history(self, user, conversation_id, device_id, limit=50, before_id=None):
        conversation = self.require_conversation(user.id, conversation_id)
        device = self.require_device(user.id, device_id)
        before = None
        if before_id:
            previous = self.repo.message(before_id)
            if previous is None or previous.conversation_id != conversation.id:
                raise NotFoundError("History cursor not found")
            before = previous.id
        rows = self.repo.history(conversation.id, before, limit + 1)
        return MessagePage(items=[self.message_view(row, device.id) for row in rows[:limit]],
                           next_before_id=rows[limit - 1].public_message_id if len(rows) > limit else None)

    def pending(self, user, device_id, limit=50, after_id=None):
        device = self.require_device(user.id, device_id)
        after = None
        if after_id:
            cursor_message = self.repo.message(after_id)
            cursor = self.repo.envelope(cursor_message.id, device.id) if cursor_message is not None else None
            if cursor is None:
                raise NotFoundError("Pending cursor not found")
            after = cursor.id
        views = []
        rows = self.repo.pending(device.id, limit + 1, after)
        for envelope in rows[:limit]:
            message = self.repo.message_by_id(envelope.message_id)
            self.require_conversation(user.id, self._conversation_for_message(message).public_conversation_id)
            views.append(self.message_view(message, device.id))
        return MessagePage(items=views, next_after_id=views[-1].public_message_id if len(rows) > limit else None)

    def _conversation_for_message(self, message):
        return self.repo.conversation_by_id(message.conversation_id)

    def receipt(self, user, message_id, data):
        device = self.require_device(user.id, data.public_device_id, lock=True)
        message = self.repo.message(message_id)
        if message is None:
            raise NotFoundError("Message not found")
        conversation = self._conversation_for_message(message)
        self.require_conversation(user.id, conversation.public_conversation_id)
        envelope = self.repo.envelope(message.id, device.id)
        if envelope is None or envelope.recipient_user_id != user.id:
            raise ForbiddenError("Destination device receipt required")
        now = utcnow()
        envelope.delivered_at = envelope.delivered_at or now
        if data.status == "read":
            envelope.read_at = envelope.read_at or now
        self.repo.commit()
        result = ReceiptPublic(public_message_id=message.public_message_id,
                               public_conversation_id=conversation.public_conversation_id, status=self.message_status(message))
        return result, self._members(conversation)

    def peer_presence(self, user, conversation_id):
        conversation = self.require_conversation(user.id, conversation_id)
        peer = self._peer(user.id, conversation)
        return peer.id, peer.user_handle
