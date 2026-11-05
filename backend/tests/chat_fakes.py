"""Purpose-built in-memory repository. Not a substitute for MSSQL execution tests."""

from uuid import UUID

from app.models.chat import ChatConversation, ChatDevice, ChatMessage, ChatMessageEnvelope, ChatPreKey
from app.models.identity import User


class FakeRepository:
    def __init__(self):
        self.rows = {model: [] for model in (User, ChatConversation, ChatDevice, ChatPreKey, ChatMessage, ChatMessageEnvelope)}
        self.commits = 0
        self.locks = []

    def add_row(self, row):
        if hasattr(type(row), "id") and row.id is None:
            row.id = len(self.rows[type(row)]) + 1
        self.rows[type(row)].append(row)
        return row

    def user(self, user_id, lock=False):
        if lock:
            self.locks.append(("user", user_id))
        return next((row for row in self.rows[User] if row.id == user_id), None)

    def user_by_handle(self, handle):
        return next((row for row in self.rows[User] if row.user_handle.lower() == handle.lower() and row.is_active), None)

    def conversations(self, user_id, limit=50, offset=0):
        rows = [row for row in self.rows[ChatConversation] if user_id in (row.participant_low_user_id, row.participant_high_user_id)]
        return sorted(rows, key=lambda row: row.id, reverse=True)[offset:offset + limit]

    def conversation(self, public_id):
        return next((row for row in self.rows[ChatConversation] if row.public_conversation_id == public_id), None)

    def conversation_pair(self, low, high):
        return next((row for row in self.rows[ChatConversation] if (row.participant_low_user_id, row.participant_high_user_id) == (low, high)), None)

    def conversation_by_id(self, row_id):
        return next((row for row in self.rows[ChatConversation] if row.id == row_id), None)

    def devices(self, user_id, active_only=True):
        return [row for row in self.rows[ChatDevice] if row.user_id == user_id and (not active_only or row.revoked_at is None)]

    def device(self, public_id, lock=False):
        if lock:
            self.locks.append(("device", public_id))
        return next((row for row in self.rows[ChatDevice] if row.public_device_id == public_id), None)

    def device_by_id(self, row_id):
        return next((row for row in self.rows[ChatDevice] if row.id == row_id), None)

    def device_number(self, user_id, number):
        return next((row for row in self.rows[ChatDevice] if row.user_id == user_id and row.signal_device_id == number), None)

    def prekey(self, device_id, kind, key_id):
        return next((row for row in self.rows[ChatPreKey] if (row.device_id, row.key_kind, row.key_id) == (device_id, kind, key_id)), None)

    def prekeys(self, device_id, kind):
        return [row for row in self.rows[ChatPreKey] if row.device_id == device_id and row.key_kind == kind]

    def available_prekey(self, device_id, kind, now):
        keys = [row for row in self.prekeys(device_id, kind) if row.claimed_at is None and row.retired_at is None and (row.expires_at is None or row.expires_at > now)]
        return max(keys, key=lambda row: (row.created_at, row.key_id)) if keys else None

    def available_prekey_count(self, device_id, kind, now):
        return sum(row.claimed_at is None and row.retired_at is None and (row.expires_at is None or row.expires_at > now) for row in self.prekeys(device_id, kind))

    def claim_one_time(self, device_id, kind, now):
        self.locks.append(("prekey", device_id))
        key = self.available_prekey(device_id, kind, now)
        if key:
            key.claimed_at = now
        return key

    def duplicate(self, device_id, client_id):
        return next((row for row in self.rows[ChatMessage] if row.sender_device_id == device_id and row.client_message_id == UUID(str(client_id))), None)

    def message(self, public_id):
        return next((row for row in self.rows[ChatMessage] if row.public_message_id == public_id), None)

    def message_by_id(self, row_id):
        return next((row for row in self.rows[ChatMessage] if row.id == row_id), None)

    def envelopes(self, message_id):
        return [row for row in self.rows[ChatMessageEnvelope] if row.message_id == message_id]

    def envelope(self, message_id, device_id):
        return next((row for row in self.envelopes(message_id) if row.recipient_device_id == device_id), None)

    def pending(self, device_id, limit, after=None):
        return sorted((row for row in self.rows[ChatMessageEnvelope] if row.recipient_device_id == device_id and row.delivered_at is None and (after is None or row.id > after)), key=lambda row: row.id)[:limit]

    def history(self, conversation_id, before, limit):
        return sorted((row for row in self.rows[ChatMessage] if row.conversation_id == conversation_id and (before is None or row.id < before)), key=lambda row: row.id, reverse=True)[:limit]

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass

    def flush(self):
        pass


class FakeSession:
    def __init__(self, repo):
        self.repo = repo

    def get(self, model, row_id):
        return next((row for row in self.repo.rows[model] if row.id == row_id), None)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass
