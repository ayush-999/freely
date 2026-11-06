"""Chat data access through the existing scoped MSSQL session. No DDL."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import case, func, or_, select, text

from app.models.chat import ChatConversation, ChatDevice, ChatMessage, ChatMessageEnvelope, ChatPreKey
from app.models.identity import User
from app.repositories.base import BaseRepository


class ChatRepository(BaseRepository[ChatConversation]):
    model = ChatConversation

    def user(self, user_id: int, *, lock: bool = False):
        stmt = select(User).where(User.id == user_id)
        if lock:
            stmt = stmt.with_hint(User, "WITH (UPDLOCK, HOLDLOCK)", "mssql").execution_options(populate_existing=True)
        return self.db.scalar(stmt)

    def user_by_handle(self, handle: str):
        return self.db.scalar(select(User).where(User.user_handle == handle, User.is_active == True))

    def conversations(self, user_id: int, limit: int = 50, offset: int = 0):
        return list(self.db.scalars(select(ChatConversation).where(
            or_(ChatConversation.participant_low_user_id == user_id, ChatConversation.participant_high_user_id == user_id)
        ).order_by(func.coalesce(ChatConversation.updated_at, ChatConversation.created_at).desc(), ChatConversation.id.desc()).offset(offset).limit(limit)))

    def conversation(self, public_id: str):
        return self.db.scalar(select(ChatConversation).where(ChatConversation.public_conversation_id == public_id))

    def conversation_pair(self, low: int, high: int):
        return self.db.scalar(select(ChatConversation).where(ChatConversation.participant_low_user_id == low, ChatConversation.participant_high_user_id == high))

    def conversation_by_id(self, row_id: int):
        return self.db.get(ChatConversation, row_id)

    def conversation_counts(self, user_id: int, conversation_ids: list[int] | None = None):
        """Count messages once per account, independent of device fan-out.

        Reading on any recipient device clears the account's unread badge.
        Keep this metadata query independent of keys and message ciphertext.
        """
        if conversation_ids == []:
            return {}
        read_messages = select(ChatMessageEnvelope.message_id).where(
            ChatMessageEnvelope.recipient_user_id == user_id,
            ChatMessageEnvelope.read_at.is_not(None),
        ).distinct().subquery()
        stmt = select(
            ChatMessage.conversation_id,
            func.count(ChatMessage.id).label("received_count"),
            func.sum(case((read_messages.c.message_id.is_(None), 1), else_=0)).label("unread_count"),
        ).join(ChatConversation, ChatConversation.id == ChatMessage.conversation_id).outerjoin(
            read_messages, read_messages.c.message_id == ChatMessage.id,
        ).where(
            or_(ChatConversation.participant_low_user_id == user_id, ChatConversation.participant_high_user_id == user_id),
            ChatMessage.sender_user_id != user_id,
        )
        if conversation_ids is not None:
            stmt = stmt.where(ChatMessage.conversation_id.in_(conversation_ids))
        return {
            row.conversation_id: (row.received_count, row.unread_count)
            for row in self.db.execute(stmt.group_by(ChatMessage.conversation_id))
        }

    def devices(self, user_id: int, *, active_only: bool = True):
        stmt = select(ChatDevice).where(ChatDevice.user_id == user_id)
        if active_only:
            stmt = stmt.where(ChatDevice.revoked_at.is_(None))
        return list(self.db.scalars(stmt.order_by(ChatDevice.signal_device_id)))

    def device(self, public_id: str, *, lock: bool = False):
        stmt = select(ChatDevice).where(ChatDevice.public_device_id == public_id)
        if lock:
            stmt = stmt.with_hint(ChatDevice, "WITH (UPDLOCK, HOLDLOCK)", "mssql").execution_options(populate_existing=True)
        return self.db.scalar(stmt)

    def device_by_id(self, row_id: int):
        return self.db.get(ChatDevice, row_id)

    def device_number(self, user_id: int, number: int):
        return self.db.scalar(select(ChatDevice).where(ChatDevice.user_id == user_id, ChatDevice.signal_device_id == number))

    def prekey(self, device_id: int, kind: str, key_id: int):
        return self.db.get(ChatPreKey, (device_id, kind, key_id))

    def available_prekey(self, device_id: int, kind: str, now: datetime):
        return self.db.scalar(select(ChatPreKey).where(
            ChatPreKey.device_id == device_id, ChatPreKey.key_kind == kind,
            ChatPreKey.retired_at.is_(None), ChatPreKey.claimed_at.is_(None),
            or_(ChatPreKey.expires_at.is_(None), ChatPreKey.expires_at > now)
        ).order_by(ChatPreKey.created_at.desc(), ChatPreKey.key_id.desc()))

    def claim_one_time(self, device_id: int, kind: str, now: datetime):
        # This statement claims and returns one row atomically. The containing
        # transaction also locks the device, so revocation cannot race the claim.
        stmt = text("""
            ;WITH candidate AS (
                SELECT TOP (1) * FROM dbo.chat_prekeys WITH (UPDLOCK, ROWLOCK)
                WHERE device_id = :device_id AND key_kind = :kind
                  AND claimed_at IS NULL AND retired_at IS NULL
                  AND (expires_at IS NULL OR expires_at > :now)
                ORDER BY created_at, key_id
            )
            UPDATE candidate SET claimed_at = :now
            OUTPUT inserted.device_id, inserted.key_kind, inserted.key_id;
        """)
        row = self.db.execute(stmt, {"device_id": device_id, "kind": kind, "now": now}).first()
        if row is None:
            return None
        result = self.prekey(row.device_id, row.key_kind, row.key_id)
        if result is not None:
            self.db.refresh(result)
        return result

    def prekeys(self, device_id: int, kind: str):
        return list(self.db.scalars(select(ChatPreKey).where(ChatPreKey.device_id == device_id, ChatPreKey.key_kind == kind)))

    def available_prekey_count(self, device_id: int, kind: str, now: datetime):
        return self.db.scalar(select(func.count()).select_from(ChatPreKey).where(
            ChatPreKey.device_id == device_id, ChatPreKey.key_kind == kind,
            ChatPreKey.claimed_at.is_(None), ChatPreKey.retired_at.is_(None),
            or_(ChatPreKey.expires_at.is_(None), ChatPreKey.expires_at > now)
        )) or 0

    def message(self, public_id: str):
        return self.db.scalar(select(ChatMessage).where(ChatMessage.public_message_id == public_id))

    def duplicate(self, device_id: int, client_id: UUID):
        return self.db.scalar(select(ChatMessage).where(ChatMessage.sender_device_id == device_id, ChatMessage.client_message_id == client_id))

    def history(self, conversation_id: int, before: int | None, limit: int):
        stmt = select(ChatMessage).where(ChatMessage.conversation_id == conversation_id)
        if before is not None:
            stmt = stmt.where(ChatMessage.id < before)
        return list(self.db.scalars(stmt.order_by(ChatMessage.id.desc()).limit(limit)))

    def envelope(self, message_id: int, device_id: int):
        return self.db.scalar(select(ChatMessageEnvelope).where(ChatMessageEnvelope.message_id == message_id, ChatMessageEnvelope.recipient_device_id == device_id))

    def envelopes(self, message_id: int):
        return list(self.db.scalars(select(ChatMessageEnvelope).where(ChatMessageEnvelope.message_id == message_id)))

    def pending(self, device_id: int, limit: int, after: int | None = None):
        stmt = select(ChatMessageEnvelope).where(
            ChatMessageEnvelope.recipient_device_id == device_id, ChatMessageEnvelope.delivered_at.is_(None)
        )
        if after is not None:
            stmt = stmt.where(ChatMessageEnvelope.id > after)
        return list(self.db.scalars(stmt.order_by(ChatMessageEnvelope.id).limit(limit)))

    def message_by_id(self, message_id: int):
        return self.db.get(ChatMessage, message_id)

    def add_row(self, row):
        self.db.add(row)

    def flush(self):
        self.db.flush()

    def commit(self):
        self.db.commit()

    def rollback(self):
        self.db.rollback()
