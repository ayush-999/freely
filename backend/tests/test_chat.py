import asyncio
import base64
import json
import time
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.dialects import mssql

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.models.chat import ChatDevice, ChatMessage, ChatMessageEnvelope, ChatPreKey
from app.models.identity import User
from app.schemas.chat import (
    ConversationCreate, DeviceRegister, KeyClaim, KeysUpload, MessageSend,
    PreKeyUpload, ReceiptInput, decode_blob, encode_blob,
)
from app.services.chat_service import ChatService
from app.utils import utcnow
from tests.chat_fakes import FakeRepository, FakeSession


def ec(seed=1):
    return encode_blob(bytes([5]) + bytes([seed]) * 32)


def registration(number=1, seed=1):
    return DeviceRegister(signal_device_id=number, registration_id=number, identity_public_key=ec(seed), label="Browser")


@pytest.fixture
def world():
    repo = FakeRepository()
    users = [repo.add_row(User(id=number, user_handle=name, full_name=name.title(), is_active=True, created_at=utcnow()))
             for number, name in enumerate(("alice", "bob", "mallory"), 1)]
    service = ChatService(None, repository=repo)
    alice, bob, mallory = users
    devices = [service.register_device(user, registration(seed=number)) for number, user in enumerate(users, 1)]
    conversation = service.create_conversation(alice, ConversationCreate(recipient_handle="bob"))
    return repo, service, users, devices, conversation


def message(world, client_id=None):
    _, _, _, devices, conversation = world
    return MessageSend(public_conversation_id=conversation.public_conversation_id, public_device_id=devices[0].public_device_id,
                       client_message_id=client_id or uuid4(), envelopes=[{"recipient_device_id": devices[1].public_device_id,
                       "message_type": 3, "ciphertext": encode_blob(b"opaque-ciphertext")}])


def key_upload(device, *, kind="ec_signed", key_id=1, seed=1):
    return KeysUpload(public_device_id=device.public_device_id, prekeys=[PreKeyUpload(
        key_kind=kind, key_id=key_id, public_key=ec(seed) if kind.startswith("ec") else encode_blob(bytes([8]) + bytes([seed]) * 1568),
        signature=None if kind == "ec_one_time" else encode_blob(bytes([seed]) * 64))])


def test_conversation_canonical_idempotency_and_no_self(world):
    _, service, (alice, bob, _), _, conversation = world
    assert service.create_conversation(bob, ConversationCreate(recipient_handle="alice")).public_conversation_id == conversation.public_conversation_id
    assert len(service.list_conversations(alice)) == 1
    with pytest.raises(UnprocessableError):
        service.create_conversation(alice, ConversationCreate(recipient_handle="alice"))


def test_conversation_membership_and_user_inactivity(world):
    _, service, (alice, bob, mallory), _, conversation = world
    with pytest.raises(NotFoundError):
        service.get_conversation(mallory, conversation.public_conversation_id)
    bob.is_active = False
    with pytest.raises(ForbiddenError):
        service.send_message(alice, message(world))


def test_ciphertext_send_offline_pending_and_scoped_history(world):
    repo, service, (alice, bob, mallory), devices, conversation = world
    accepted, deliveries = service.send_message(alice, message(world))
    assert not accepted.duplicate
    assert len(deliveries) == 1
    assert len(repo.rows[ChatMessage]) == 1
    assert repo.rows[ChatMessageEnvelope][0].ciphertext == b"opaque-ciphertext"
    pending = service.pending(bob, devices[1].public_device_id)
    assert pending.items[0].public_message_id == accepted.public_message_id
    assert pending.items[0].sender_device.public_device_id == devices[0].public_device_id
    history = service.history(alice, conversation.public_conversation_id, devices[0].public_device_id)
    assert history.items[0].ciphertext is None  # Original sender keeps encrypted local history.
    with pytest.raises(ForbiddenError):
        service.pending(mallory, devices[1].public_device_id)
    with pytest.raises(NotFoundError):
        service.history(mallory, conversation.public_conversation_id, devices[2].public_device_id)


def test_idempotent_retry_and_conflicting_replay(world):
    repo, service, users, _, _ = world
    data = message(world)
    first, _ = service.send_message(users[0], data)
    second, deliveries = service.send_message(users[0], data)
    assert second.duplicate and first.public_message_id == second.public_message_id and deliveries == []
    data.envelopes[0].ciphertext = encode_blob(b"different")
    with pytest.raises(ConflictError):
        service.send_message(users[0], data)
    assert len(repo.rows[ChatMessage]) == 1


def test_sender_and_exact_fanout_enforced(world):
    _, service, (alice, bob, mallory), devices, _ = world
    data = message(world)
    with pytest.raises(NotFoundError):
        service.send_message(mallory, data)
    second = service.register_device(alice, registration(2, 5))
    with pytest.raises(ConflictError):
        service.send_message(alice, data)
    data.envelopes.append(type(data.envelopes[0])(recipient_device_id=second.public_device_id, ciphertext=encode_blob(b"sync"), message_type=3))
    accepted, events = service.send_message(alice, data)
    assert len(events) == 2


def test_receipts_are_explicit_monotonic_and_destination_scoped(world):
    _, service, (alice, bob, mallory), devices, _ = world
    accepted, _ = service.send_message(alice, message(world))
    with pytest.raises(ForbiddenError):
        service.receipt(alice, accepted.public_message_id, ReceiptInput(public_device_id=devices[0].public_device_id, status="read"))
    read, _ = service.receipt(bob, accepted.public_message_id, ReceiptInput(public_device_id=devices[1].public_device_id, status="read"))
    assert read.status == "read"
    assert service.pending(bob, devices[1].public_device_id).items == []
    delivered, _ = service.receipt(bob, accepted.public_message_id, ReceiptInput(public_device_id=devices[1].public_device_id, status="delivered"))
    assert delivered.status == "read"


def test_revocation_never_recycles_identity_or_accepts_old_device(world):
    _, service, (alice, _, _), devices, _ = world
    same = service.register_device(alice, registration())
    assert same.public_device_id == devices[0].public_device_id
    service.revoke_device(alice, devices[0].public_device_id)
    with pytest.raises(ConflictError):
        service.register_device(alice, registration())
    with pytest.raises(ForbiddenError):
        service.send_message(alice, message(world))


def test_public_keys_only_idempotent_upload_rotation_and_claim(world):
    repo, service, (alice, bob, _), devices, _ = world
    for kind in ("ec_signed", "ec_one_time", "kem_one_time", "kem_last_resort"):
        service.upload_keys(bob, key_upload(devices[1], kind=kind))
    claim = KeyClaim(public_device_id=devices[0].public_device_id)
    first = service.claim_keys(alice, "bob", claim)[0]
    assert {key.key_kind for key in first.prekeys} == {"ec_signed", "ec_one_time", "kem_one_time"}
    second = service.claim_keys(alice, "bob", claim)[0]
    assert {key.key_kind for key in second.prekeys} == {"ec_signed", "kem_last_resort"}
    service.upload_keys(bob, key_upload(devices[1], kind="ec_one_time"))
    assert repo.prekey(2, "ec_one_time", 1).claimed_at is not None
    service.upload_keys(bob, key_upload(devices[1], key_id=2, seed=4))
    assert repo.prekey(2, "ec_signed", 1).retired_at is not None
    directory = service.key_directory(alice, "bob")[0]
    assert next(key for key in directory.prekeys if key.key_kind == "ec_signed").key_id == 2
    with pytest.raises(ConflictError):
        service.upload_keys(bob, key_upload(devices[1], key_id=2, seed=5))


def test_key_management_rejects_unrelated_or_revoked_device(world):
    _, service, (alice, bob, mallory), devices, _ = world
    with pytest.raises(ForbiddenError):
        service.upload_keys(alice, key_upload(devices[1]))
    with pytest.raises(ForbiddenError):
        service.key_directory(mallory, "bob")
    service.revoke_device(bob, devices[1].public_device_id)
    with pytest.raises(ForbiddenError):
        service.upload_keys(bob, key_upload(devices[1]))


def test_claims_lock_users_then_devices_then_prekeys_in_stable_order(world):
    repo, service, (alice, bob, _), devices, _ = world
    for kind in ("ec_signed", "kem_last_resort"):
        service.upload_keys(bob, key_upload(devices[1], kind=kind))
    repo.locks.clear()
    service.claim_keys(alice, "bob", KeyClaim(public_device_id=devices[0].public_device_id))
    assert repo.locks[:2] == [("user", alice.id), ("user", bob.id)]
    kinds = [kind for kind, _ in repo.locks]
    assert max(index for index, kind in enumerate(kinds) if kind == "user") < min(index for index, kind in enumerate(kinds) if kind == "device")
    assert max(index for index, kind in enumerate(kinds) if kind == "device") < min(index for index, kind in enumerate(kinds) if kind == "prekey")


@pytest.mark.parametrize("mutation", [
    {"plaintext": "secret"}, {"private_key": "secret"}, {"protocol_version": "custom"},
])
def test_message_dto_rejects_plaintext_and_unknown_fields(world, mutation):
    payload = message(world).model_dump(mode="json") | mutation
    with pytest.raises(ValidationError):
        MessageSend.model_validate(payload)


@pytest.mark.parametrize("value", ["%%%!", "YQ", "YQ==\n", "", "YQ==" * 100000])
def test_base64_validation_is_bounded_and_strict(value):
    with pytest.raises(ValueError):
        decode_blob(value)


@pytest.mark.parametrize("payload", [
    {"key_kind": "ec_signed", "key_id": 1, "public_key": ec()},
    {"key_kind": "ec_one_time", "key_id": 1, "public_key": ec(), "private_key": "secret"},
    {"key_kind": "kem_one_time", "key_id": 1, "public_key": ec(), "signature": encode_blob(b"s" * 64)},
])
def test_invalid_key_fields_rejected(payload):
    with pytest.raises(ValidationError):
        PreKeyUpload.model_validate(payload)


@pytest.fixture
def client(world, monkeypatch):
    from app.controllers import chat_controller as controller
    from app.core.chat_realtime import ChatHub
    from app.main import app
    from app.core.security import create_access_token

    repo, chat, users, _, _ = world
    monkeypatch.setattr(controller, "hub", ChatHub())
    for name in ("chat_enabled", "chat_schema_ready", "chat_crypto_ready"):
        monkeypatch.setattr(controller.settings, name, True)
    monkeypatch.setattr(controller.settings, "chat_auth_timeout_seconds", 1)
    monkeypatch.setattr(controller, "SessionLocal", lambda: FakeSession(repo))
    monkeypatch.setattr(controller, "ChatService", lambda db, **kwargs: chat)
    app.dependency_overrides[controller.chat_db] = lambda: FakeSession(repo)
    app.dependency_overrides[controller.service] = lambda: chat
    with TestClient(app) as result:
        result.tokens = [create_access_token(str(user.id)) for user in users]
        yield result
    app.dependency_overrides.clear()


def test_http_auth_conversation_send_and_offline_retrieval(client, world):
    _, _, _, devices, conversation = world
    assert client.get("/api/v1/chat/conversations").status_code == 401
    assert client.get("/api/v1/chat/conversations", headers={"Authorization": "Bearer invalid"}).status_code == 401
    alice = {"Authorization": f"Bearer {client.tokens[0]}"}
    bob = {"Authorization": f"Bearer {client.tokens[1]}"}
    other = {"Authorization": f"Bearer {client.tokens[2]}"}
    assert client.get("/api/v1/chat/conversations", headers=alice).json()[0]["peer"]["user_handle"] == "bob"
    assert client.get(f"/api/v1/chat/conversations/{conversation.public_conversation_id}", headers=other).status_code == 404
    response = client.post("/api/v1/chat/messages", headers=alice, json=message(world).model_dump(mode="json"))
    assert response.status_code == 200
    pending = client.get(f"/api/v1/chat/devices/{devices[1].public_device_id}/pending", headers=bob)
    assert pending.status_code == 200 and len(pending.json()["items"]) == 1


def test_http_redacts_invalid_inputs_and_disabled_readiness(client, monkeypatch):
    from app.controllers import chat_controller as controller

    secret = "SHOULD_NOT_BE_REFLECTED"
    response = client.post("/api/v1/chat/messages", headers={"Authorization": f"Bearer {client.tokens[0]}"}, json={"plaintext": secret})
    assert response.status_code == 422 and secret not in response.text
    monkeypatch.setattr(controller.settings, "chat_crypto_ready", False)
    assert client.get("/api/v1/chat/config").json()["enabled"] is False
    # Clear DB dependency override to exercise the actual gate before auth/SQL.
    from app.main import app
    app.dependency_overrides.pop(controller.chat_db)
    assert client.get("/api/v1/chat/conversations", headers={"Authorization": f"Bearer {client.tokens[0]}"}).status_code == 503


def test_production_chat_requires_https_without_changing_existing_auth(client, monkeypatch):
    from app.controllers import chat_controller as controller

    monkeypatch.setattr(controller.settings, "app_env", "production")
    response = client.get("/api/v1/chat/conversations", headers={"Authorization": f"Bearer {client.tokens[0]}"})
    assert response.status_code == 403 and response.json()["detail"] == "Encrypted messaging requires HTTPS"
    assert client.get("/api/v1/chat/config").status_code == 200  # Public config contains no credentials.


def test_websocket_auth_origin_live_ciphertext_and_receipt(client, world):
    _, service, (alice, bob, _), devices, conversation = world
    with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "http://localhost:5173"}) as receiver:
        receiver.send_json({"type": "auth", "token": client.tokens[1], "public_device_id": devices[1].public_device_id})
        assert receiver.receive_json()["type"] == "auth.ok"
        assert receiver.receive_json()["type"] == "user.offline"
        response = client.post("/api/v1/chat/messages", headers={"Authorization": f"Bearer {client.tokens[0]}"}, json=message(world).model_dump(mode="json"))
        event = receiver.receive_json()
        assert event["type"] == "message.receive"
        assert event["data"]["ciphertext"] == encode_blob(b"opaque-ciphertext")
        receiver.send_json({"type": "message.read", "data": {"public_message_id": response.json()["public_message_id"]}})
        assert receiver.receive_json()["type"] == "message.read"
        assert receiver.receive_json()["type"] == "receipt.ok"
        receiver.send_json({"type": "typing.start", "data": {"public_conversation_id": "chat_unknown123456"}})
        assert receiver.receive_json()["type"] == "error"


def test_websocket_rejects_invalid_origin_and_foreign_device(client, world):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "https://evil.example"}):
            pass
    with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "http://localhost:5173"}) as socket:
        socket.send_json({"type": "auth", "token": client.tokens[0], "public_device_id": world[3][1].public_device_id})
        with pytest.raises(WebSocketDisconnect):
            socket.receive_json()


def test_websocket_reconnect_recovers_offline_delivery(client, world):
    _, service, users, devices, _ = world
    with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "http://localhost:5173"}) as socket:
        socket.send_json({"type": "auth", "token": client.tokens[1], "public_device_id": devices[1].public_device_id})
        socket.receive_json()
        socket.receive_json()
    accepted, _ = service.send_message(users[0], message(world))
    with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "http://localhost:5173"}) as socket:
        socket.send_json({"type": "auth", "token": client.tokens[1], "public_device_id": devices[1].public_device_id})
        assert socket.receive_json()["type"] == "auth.ok"
        pending = client.get(f"/api/v1/chat/devices/{devices[1].public_device_id}/pending", headers={"Authorization": f"Bearer {client.tokens[1]}"}).json()
        assert pending["items"][0]["public_message_id"] == accepted.public_message_id


def test_pending_pagination_does_not_starve_later_messages(world):
    _, service, users, devices, _ = world
    accepted = [service.send_message(users[0], message(world))[0] for _ in range(3)]
    first = service.pending(users[1], devices[1].public_device_id, limit=1)
    assert first.items[0].public_message_id == accepted[0].public_message_id
    assert first.next_after_id == accepted[0].public_message_id
    # Leave the first envelope unacknowledged (e.g. unverified identity) but
    # still fetch later messages during this transient scan.
    second = service.pending(users[1], devices[1].public_device_id, limit=1, after_id=first.next_after_id)
    assert second.items[0].public_message_id == accepted[1].public_message_id
    last = service.pending(users[1], devices[1].public_device_id, limit=1, after_id=second.next_after_id)
    assert last.items[0].public_message_id == accepted[2].public_message_id
    assert last.next_after_id is None
    assert service.pending(users[1], devices[1].public_device_id, limit=1).items[0].public_message_id == accepted[0].public_message_id


def test_websocket_send_uses_same_service_and_presence_typing_membership(client, world):
    _, _, _, devices, conversation = world
    origin = {"Origin": "http://localhost:5173"}
    with client.websocket_connect("/api/v1/chat/ws", headers=origin) as bob:
        bob.send_json({"type": "auth", "token": client.tokens[1], "public_device_id": devices[1].public_device_id})
        assert bob.receive_json()["type"] == "auth.ok"
        assert bob.receive_json()["type"] == "user.offline"
        with client.websocket_connect("/api/v1/chat/ws", headers=origin) as alice:
            alice.send_json({"type": "auth", "token": client.tokens[0], "public_device_id": devices[0].public_device_id})
            assert alice.receive_json()["type"] == "auth.ok"
            assert alice.receive_json()["type"] == "user.online"
            assert bob.receive_json()["type"] == "user.online"
            alice.send_json({"type": "typing.start", "data": {"public_conversation_id": conversation.public_conversation_id}})
            assert bob.receive_json()["type"] == "typing.start"
            alice.send_json({"type": "message.send", "request_id": "request1", "data": message(world).model_dump(mode="json")})
            assert bob.receive_json()["type"] == "message.receive"
            event = alice.receive_json()
            assert event["type"] == "message.sent" and event["request_id"] == "request1"
        assert bob.receive_json()["type"] == "user.offline"


def test_another_device_sync_receipt_does_not_mark_peer_delivery(world):
    _, service, (alice, bob, _), devices, _ = world
    other = service.register_device(alice, registration(2, 3))
    data = message(world)
    data.envelopes.append(type(data.envelopes[0])(recipient_device_id=other.public_device_id, message_type=3, ciphertext=encode_blob(b"sync")))
    accepted, _ = service.send_message(alice, data)
    result, _ = service.receipt(alice, accepted.public_message_id, ReceiptInput(public_device_id=other.public_device_id, status="read"))
    assert result.status == "sent"


def test_history_cursor_is_conversation_scoped_and_device_counts_are_own(world):
    _, service, (alice, bob, mallory), devices, conversation = world
    service.upload_keys(bob, key_upload(devices[1], kind="ec_one_time"))
    service.upload_keys(bob, key_upload(devices[1], kind="kem_one_time"))
    own = service.list_devices(bob)[0]
    assert own.available_ec_one_time == 1 and own.available_kem_one_time == 1
    directory = service.key_directory(alice, "bob")[0]
    assert directory.device.available_ec_one_time is None
    first, _ = service.send_message(alice, message(world))
    service.send_message(alice, message(world))
    history = service.history(bob, conversation.public_conversation_id, devices[1].public_device_id, limit=1)
    assert history.next_before_id
    older = service.history(bob, conversation.public_conversation_id, devices[1].public_device_id, limit=1, before_id=history.next_before_id)
    assert older.items[0].public_message_id == first.public_message_id
    other_conversation = service.create_conversation(alice, ConversationCreate(recipient_handle="mallory"))
    with pytest.raises(NotFoundError):
        service.history(alice, other_conversation.public_conversation_id, devices[0].public_device_id, before_id=first.public_message_id)


def test_socket_expiry_and_device_revocation_are_rechecked(client, world):
    from app.controllers import chat_controller as controller
    from app.core.security import create_access_token
    from starlette.websockets import WebSocketDisconnect

    expired = create_access_token("1", {"exp": int(time.time()) - 1})
    with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "http://localhost:5173"}) as socket:
        socket.send_json({"type": "auth", "token": expired, "public_device_id": world[3][0].public_device_id})
        with pytest.raises(WebSocketDisconnect):
            socket.receive_json()
    with client.websocket_connect("/api/v1/chat/ws", headers={"Origin": "http://localhost:5173"}) as socket:
        socket.send_json({"type": "auth", "token": client.tokens[0], "public_device_id": world[3][0].public_device_id})
        socket.receive_json()
        socket.receive_json()
        result = client.post(f"/api/v1/chat/devices/{world[3][0].public_device_id}/revoke", headers={"Authorization": f"Bearer {client.tokens[0]}"})
        assert result.status_code == 200
        try:
            first = socket.receive_json()
            assert first["type"] == "device.revoked"
            with pytest.raises(WebSocketDisconnect):
                socket.receive_json()
        except WebSocketDisconnect:
            pass


def test_rate_limiter_is_bounded_and_multiworker_fails_closed(monkeypatch):
    from app.core.chat_realtime import RateLimiter
    from app.controllers import chat_controller as controller

    limiter = RateLimiter(maximum_entries=2)
    assert limiter.consume("one", rate=0, burst=1)
    assert not limiter.consume("one", rate=0, burst=1)
    assert limiter.consume("two", rate=0, burst=1)
    assert not limiter.consume("three", rate=0, burst=1)
    monkeypatch.setattr(controller.settings, "chat_enabled", True)
    monkeypatch.setattr(controller.settings, "chat_worker_count", 2)
    with pytest.raises(RuntimeError):
        controller.validate_chat_runtime()
