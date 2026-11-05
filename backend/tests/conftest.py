"""Tests cannot connect to the configured SQL Server. All persistence is fake."""

import os

os.environ["DEBUG"] = "false"
os.environ["CHAT_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-only-chat-secret-which-is-not-for-production-0123456789"

import pytest


@pytest.fixture(autouse=True)
def prohibit_database_connections(monkeypatch):
    from app.core.database import engine

    def prohibited(*args, **kwargs):
        raise AssertionError("Tests must not connect to any database or execute SQL")

    monkeypatch.setattr(engine, "connect", prohibited)
    monkeypatch.setattr(engine.dialect, "connect", prohibited)
