"""Ciphertext-only one-to-one messaging; the existing users remain authoritative.

Table creation is exclusively a manual migration. Importing these models never
connects to SQL Server or creates database objects.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger, CheckConstraint, ForeignKeyConstraint, Index, Integer,
    PrimaryKeyConstraint, UniqueConstraint, text,
)
from sqlalchemy.dialects.mssql import DATETIME2, NVARCHAR, UNIQUEIDENTIFIER, VARBINARY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

CHAT_PROTOCOL = "signal-pqxdh-v1"
CHAT_PREKEY_KINDS = ("ec_signed", "ec_one_time", "kem_one_time", "kem_last_resort")


class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="PK_chat_conversations"),
        UniqueConstraint("public_conversation_id", name="UQ_chat_conversations_public_id"),
        UniqueConstraint("participant_low_user_id", "participant_high_user_id", name="UQ_chat_conversations_pair"),
        ForeignKeyConstraint(["participant_low_user_id"], ["users.id"], name="FK_chat_conversations_low_user"),
        ForeignKeyConstraint(["participant_high_user_id"], ["users.id"], name="FK_chat_conversations_high_user"),
        CheckConstraint("participant_low_user_id < participant_high_user_id", name="CK_chat_conversations_distinct_pair"),
        CheckConstraint("updated_at IS NULL OR updated_at >= created_at", name="CK_chat_conversations_updated"),
        Index("IX_chat_conversations_low_updated", "participant_low_user_id", "updated_at", "id"),
        Index("IX_chat_conversations_high_updated", "participant_high_user_id", "updated_at", "id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_conversation_id: Mapped[str] = mapped_column(NVARCHAR(40), nullable=False)
    participant_low_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    participant_high_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()"))
    updated_at: Mapped[datetime | None] = mapped_column(DATETIME2)


class ChatDevice(Base):
    __tablename__ = "chat_devices"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="PK_chat_devices"),
        UniqueConstraint("public_device_id", name="UQ_chat_devices_public_id"),
        UniqueConstraint("user_id", "signal_device_id", name="UQ_chat_devices_user_signal_id"),
        UniqueConstraint("user_id", "id", name="UQ_chat_devices_owner_id"),
        ForeignKeyConstraint(["user_id"], ["users.id"], name="FK_chat_devices_user"),
        CheckConstraint("signal_device_id BETWEEN 1 AND 127", name="CK_chat_devices_signal_id"),
        CheckConstraint("registration_id BETWEEN 1 AND 16383", name="CK_chat_devices_registration_id"),
        CheckConstraint("protocol_version = 'signal-pqxdh-v1'", name="CK_chat_devices_protocol"),
        CheckConstraint("DATALENGTH(identity_public_key) = 33", name="CK_chat_devices_identity_key"),
        CheckConstraint("last_seen_at IS NULL OR last_seen_at >= created_at", name="CK_chat_devices_last_seen"),
        CheckConstraint("revoked_at IS NULL OR revoked_at >= created_at", name="CK_chat_devices_revoked"),
        Index("IX_chat_devices_active_user", "user_id", "signal_device_id", mssql_where=text("revoked_at IS NULL")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_device_id: Mapped[str] = mapped_column(NVARCHAR(40), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    signal_device_id: Mapped[int] = mapped_column(Integer, nullable=False)
    registration_id: Mapped[int] = mapped_column(Integer, nullable=False)
    protocol_version: Mapped[str] = mapped_column(NVARCHAR(32), nullable=False)
    identity_public_key: Mapped[bytes] = mapped_column(VARBINARY(33), nullable=False)
    label: Mapped[str | None] = mapped_column(NVARCHAR(100))
    created_at: Mapped[datetime] = mapped_column(DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()"))
    last_seen_at: Mapped[datetime | None] = mapped_column(DATETIME2)
    revoked_at: Mapped[datetime | None] = mapped_column(DATETIME2)


class ChatPreKey(Base):
    __tablename__ = "chat_prekeys"
    __table_args__ = (
        PrimaryKeyConstraint("device_id", "key_kind", "key_id", name="PK_chat_prekeys"),
        ForeignKeyConstraint(["device_id"], ["chat_devices.id"], name="FK_chat_prekeys_device"),
        CheckConstraint("key_kind IN ('ec_signed','ec_one_time','kem_one_time','kem_last_resort')", name="CK_chat_prekeys_kind"),
        CheckConstraint("key_id BETWEEN 0 AND 16777215", name="CK_chat_prekeys_key_id"),
        CheckConstraint("protocol_version = 'signal-pqxdh-v1'", name="CK_chat_prekeys_protocol"),
        CheckConstraint(
            "(key_kind = 'ec_one_time' AND DATALENGTH(public_key) = 33 AND signature IS NULL) OR "
            "(key_kind = 'ec_signed' AND DATALENGTH(public_key) = 33 AND signature IS NOT NULL AND DATALENGTH(signature) = 64) OR "
            "(key_kind IN ('kem_one_time','kem_last_resort') AND DATALENGTH(public_key) = 1569 AND signature IS NOT NULL AND DATALENGTH(signature) = 64)",
            name="CK_chat_prekeys_public_material",
        ),
        CheckConstraint("expires_at IS NULL OR expires_at > created_at", name="CK_chat_prekeys_expiry"),
        CheckConstraint("retired_at IS NULL OR retired_at >= created_at", name="CK_chat_prekeys_retired"),
        CheckConstraint("claimed_at IS NULL OR (key_kind IN ('ec_one_time','kem_one_time') AND claimed_at >= created_at)", name="CK_chat_prekeys_claimed"),
        Index("IX_chat_prekeys_available", "device_id", "key_kind", "key_id", mssql_where=text("claimed_at IS NULL AND retired_at IS NULL")),
    )

    device_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    key_kind: Mapped[str] = mapped_column(NVARCHAR(32), primary_key=True)
    key_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    protocol_version: Mapped[str] = mapped_column(NVARCHAR(32), nullable=False)
    public_key: Mapped[bytes] = mapped_column(VARBINARY(1569), nullable=False)
    signature: Mapped[bytes | None] = mapped_column(VARBINARY(64))
    created_at: Mapped[datetime] = mapped_column(DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()"))
    expires_at: Mapped[datetime | None] = mapped_column(DATETIME2)
    retired_at: Mapped[datetime | None] = mapped_column(DATETIME2)
    claimed_at: Mapped[datetime | None] = mapped_column(DATETIME2)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="PK_chat_messages"),
        UniqueConstraint("public_message_id", name="UQ_chat_messages_public_id"),
        UniqueConstraint("sender_device_id", "client_message_id", name="UQ_chat_messages_client_id"),
        ForeignKeyConstraint(["conversation_id"], ["chat_conversations.id"], name="FK_chat_messages_conversation"),
        ForeignKeyConstraint(["sender_user_id", "sender_device_id"], ["chat_devices.user_id", "chat_devices.id"], name="FK_chat_messages_sender_device"),
        CheckConstraint("DATALENGTH(request_digest) = 32", name="CK_chat_messages_digest"),
        Index("IX_chat_messages_conversation_id", "conversation_id", "id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_message_id: Mapped[str] = mapped_column(NVARCHAR(40), nullable=False)
    conversation_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sender_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sender_device_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    client_message_id: Mapped[UUID] = mapped_column(UNIQUEIDENTIFIER(as_uuid=True), nullable=False)
    request_digest: Mapped[bytes] = mapped_column(VARBINARY(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()"))


class ChatMessageEnvelope(Base):
    __tablename__ = "chat_message_envelopes"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="PK_chat_message_envelopes"),
        UniqueConstraint("message_id", "recipient_device_id", name="UQ_chat_envelopes_message_device"),
        ForeignKeyConstraint(["message_id"], ["chat_messages.id"], name="FK_chat_envelopes_message"),
        ForeignKeyConstraint(["recipient_user_id", "recipient_device_id"], ["chat_devices.user_id", "chat_devices.id"], name="FK_chat_envelopes_recipient_device"),
        CheckConstraint("protocol_version = 'signal-pqxdh-v1'", name="CK_chat_envelopes_protocol"),
        CheckConstraint("message_type IN (2,3)", name="CK_chat_envelopes_message_type"),
        CheckConstraint("DATALENGTH(ciphertext) BETWEEN 1 AND 65536", name="CK_chat_envelopes_ciphertext"),
        CheckConstraint("delivered_at IS NULL OR delivered_at >= created_at", name="CK_chat_envelopes_delivered"),
        CheckConstraint("read_at IS NULL OR (delivered_at IS NOT NULL AND read_at >= delivered_at)", name="CK_chat_envelopes_read"),
        Index("IX_chat_envelopes_pending", "recipient_device_id", "id", mssql_where=text("delivered_at IS NULL")),
        Index("IX_chat_envelopes_device_history", "recipient_device_id", "message_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    recipient_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    recipient_device_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    protocol_version: Mapped[str] = mapped_column(NVARCHAR(32), nullable=False)
    message_type: Mapped[int] = mapped_column(Integer, nullable=False)
    ciphertext: Mapped[bytes] = mapped_column(VARBINARY(None), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()"))
    delivered_at: Mapped[datetime | None] = mapped_column(DATETIME2)
    read_at: Mapped[datetime | None] = mapped_column(DATETIME2)
