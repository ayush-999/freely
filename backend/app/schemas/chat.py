"""Ciphertext-only chat contracts. Secret-bearing client records are never DTOs."""

import base64
import binascii
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PROTOCOL_VERSION = "signal-pqxdh-v1"
MAX_CIPHERTEXT_BYTES = 65536
KeyKind = Literal["ec_signed", "ec_one_time", "kem_one_time", "kem_last_resort"]
PublicId = Annotated[str, Field(min_length=10, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")]
Handle = Annotated[str, Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")]


def decode_blob(value: str, *, minimum: int = 1, maximum: int = MAX_CIPHERTEXT_BYTES) -> bytes:
    """Only canonical standard base64 is accepted; errors contain no input data."""
    if len(value) > ((maximum + 2) // 3) * 4:
        raise ValueError("Encoded field is too large")
    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("Invalid base64 field") from None
    if not minimum <= len(decoded) <= maximum:
        raise ValueError("Invalid binary field length")
    if base64.b64encode(decoded).decode("ascii") != value:
        raise ValueError("Noncanonical base64 field")
    return decoded


def encode_blob(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


class ChatInput(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class ConversationCreate(ChatInput):
    recipient_handle: Handle


class PeerPublic(BaseModel):
    user_handle: str
    full_name: str
    avatar_storage_key: str | None = None


class ConversationPublic(BaseModel):
    public_conversation_id: str
    peer: PeerPublic
    created_at: datetime
    updated_at: datetime | None = None
    received_count: int = 0
    unread_count: int = 0


class MessageSummary(BaseModel):
    received_count: int = 0
    unread_count: int = 0


class DeviceRegister(ChatInput):
    signal_device_id: int = Field(ge=1, le=127)
    registration_id: int = Field(ge=1, le=16383)
    protocol_version: Literal["signal-pqxdh-v1"] = PROTOCOL_VERSION
    identity_public_key: str = Field(max_length=44)
    label: str | None = Field(default=None, max_length=100)

    @field_validator("identity_public_key")
    @classmethod
    def identity_length(cls, value: str) -> str:
        if decode_blob(value, minimum=33, maximum=33)[0] != 5:
            raise ValueError("Invalid Signal identity public key")
        return value


class DevicePublic(BaseModel):
    public_device_id: str
    user_handle: str
    signal_device_id: int
    registration_id: int
    protocol_version: str
    identity_public_key: str
    label: str | None = None
    created_at: datetime
    revoked_at: datetime | None = None
    available_ec_one_time: int | None = None
    available_kem_one_time: int | None = None


class PreKeyUpload(ChatInput):
    key_kind: KeyKind
    key_id: int = Field(ge=1, le=16777215)
    public_key: str = Field(max_length=2092)
    signature: str | None = Field(default=None, max_length=88)
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def validate_key(self):
        is_ec = self.key_kind.startswith("ec_")
        size = 33 if is_ec else 1569
        raw = decode_blob(self.public_key, minimum=size, maximum=size)
        if is_ec and raw[0] != 5:
            raise ValueError("Invalid Signal EC public key")
        if self.key_kind == "ec_one_time":
            if self.signature is not None:
                raise ValueError("Unsigned EC prekey cannot have a signature")
        elif self.signature is None:
            raise ValueError("Signed prekey requires a signature")
        else:
            decode_blob(self.signature, minimum=64, maximum=64)
        return self


class KeysUpload(ChatInput):
    public_device_id: PublicId
    prekeys: list[PreKeyUpload] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_keys(self):
        keys = [(key.key_kind, key.key_id) for key in self.prekeys]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate prekey identifiers")
        for kind in ("ec_signed", "kem_last_resort"):
            if sum(key.key_kind == kind for key in self.prekeys) > 1:
                raise ValueError("Only one active key per reusable key kind may be uploaded")
        return self


class PreKeyPublic(BaseModel):
    key_kind: KeyKind
    key_id: int
    public_key: str
    signature: str | None = None
    expires_at: datetime | None = None


class KeyBundle(BaseModel):
    device: DevicePublic
    prekeys: list[PreKeyPublic]


class KeyClaim(ChatInput):
    public_device_id: PublicId


class EnvelopeInput(ChatInput):
    recipient_device_id: PublicId
    message_type: Literal[2, 3]
    ciphertext: str = Field(min_length=4, max_length=87384)

    @field_validator("ciphertext")
    @classmethod
    def ciphertext_length(cls, value: str) -> str:
        decode_blob(value)
        return value


class MessageSend(ChatInput):
    public_conversation_id: PublicId
    public_device_id: PublicId
    client_message_id: UUID
    envelopes: list[EnvelopeInput] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def unique_destinations(self):
        devices = [envelope.recipient_device_id for envelope in self.envelopes]
        if len(devices) != len(set(devices)):
            raise ValueError("Duplicate destination devices")
        return self


class MessageAccepted(BaseModel):
    public_message_id: str
    client_message_id: UUID
    created_at: datetime
    duplicate: bool = False


class MessageView(BaseModel):
    public_message_id: str
    public_conversation_id: str
    client_message_id: UUID
    sender_handle: str
    sender_device: DevicePublic
    created_at: datetime
    status: Literal["sent", "delivered", "read"]
    ciphertext: str | None = None
    message_type: Literal[2, 3] | None = None
    recipient_device_id: str | None = None


class MessagePage(BaseModel):
    items: list[MessageView]
    next_before_id: str | None = None
    next_after_id: str | None = None


class ReceiptInput(ChatInput):
    public_device_id: PublicId
    status: Literal["delivered", "read"]


class ReceiptPublic(BaseModel):
    public_message_id: str
    public_conversation_id: str
    status: Literal["sent", "delivered", "read"]


class DeviceAction(ChatInput):
    public_device_id: PublicId


class SocketAuth(ChatInput):
    type: Literal["auth"]
    token: str = Field(min_length=16, max_length=4096, repr=False)
    public_device_id: PublicId


class SocketEvent(ChatInput):
    type: Literal["message.send", "message.delivered", "message.read", "typing.start", "typing.stop", "presence.subscribe"]
    request_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    data: dict = Field(default_factory=dict)


class TypingInput(ChatInput):
    public_conversation_id: PublicId
