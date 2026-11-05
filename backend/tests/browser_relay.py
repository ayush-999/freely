"""Loopback-only real HTTP/WebSocket relay for browser integration tests.

This is test infrastructure, not an application entry point. It includes the
actual chat router/service/JWT resolver and replaces persistence explicitly.
No engine/dialect connection is possible and no SQL is executed. Never expose
this test server publicly: its two account tokens are intentionally obtainable.
"""

import argparse
import os
import threading


def create_relay_app(origins: list[str]):
    os.environ["DEBUG"] = "false"
    os.environ["APP_ENV"] = "development"
    os.environ["SECRET_KEY"] = "isolated-browser-relay-test-only-secret-never-production-2026"
    os.environ["CHAT_ENABLED"] = "true"
    os.environ["CHAT_SCHEMA_READY"] = "true"
    os.environ["CHAT_CRYPTO_READY"] = "true"
    os.environ["CHAT_ALLOWED_ORIGINS"] = ",".join(origins)
    os.environ["CORS_ORIGINS"] = ",".join(origins)

    from fastapi import Depends, FastAPI, HTTPException, Query, Request
    from fastapi.middleware.cors import CORSMiddleware
    from app.core.database import engine

    attempts = {"database_connections": 0}

    def forbidden(*args, **kwargs):
        attempts["database_connections"] += 1
        raise AssertionError("Browser test relay forbids all database connections and SQL")

    engine.connect = forbidden
    engine.dialect.connect = forbidden

    from app.controllers import chat_controller as controller
    from app.core.chat_realtime import ChatHub
    from app.core.exceptions import register_exception_handlers
    from app.core.security import create_access_token, oauth2_scheme, resolve_token_user
    from app.models.chat import ChatMessage, ChatMessageEnvelope
    from app.models.identity import User
    from app.schemas.identity import UserMeResponse, UserPublicResponse
    from app.services.chat_service import ChatService
    from app.utils import utcnow
    from tests.chat_fakes import FakeRepository, FakeSession

    repo = FakeRepository()
    gate = threading.Lock()
    users = {}
    for number, handle in enumerate(("alice", "bob"), 1):
        users[handle] = repo.add_row(User(id=number, user_handle=handle, full_name=handle.title(),
                                        is_active=True, is_verified=False, created_at=utcnow()))
    chat = ChatService(None, repository=repo)

    class LockedSession(FakeSession):
        def __enter__(self):
            gate.acquire()
            return self

        def __exit__(self, *args):
            gate.release()

    def fake_db():
        gate.acquire()
        try:
            yield FakeSession(repo)
        finally:
            gate.release()

    controller.SessionLocal = lambda: LockedSession(repo)
    controller.ChatService = lambda db, **kwargs: chat
    controller.hub = ChatHub()
    app = FastAPI(title="Isolated browser relay — no database")
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
    register_exception_handlers(app)
    app.dependency_overrides[controller.chat_db] = fake_db
    app.dependency_overrides[controller.service] = lambda: chat
    app.include_router(controller.router, prefix="/api/v1")

    def current(token: str = Depends(oauth2_scheme)):
        return resolve_token_user(FakeSession(repo), token)

    @app.get("/api/v1/users/me", response_model=UserMeResponse)
    def me(user=Depends(current)):
        return user

    @app.get("/api/v1/users/search", response_model=list[UserPublicResponse])
    def search(q: str = Query(min_length=1, max_length=100)):
        return [user for handle, user in users.items() if q.lower() in handle or q.lower() in user.full_name.lower()]

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "test_only": True, "database": "forbidden"}

    @app.get("/__test__/token/{handle}")
    def token(handle: str):
        user = users.get(handle)
        if user is None:
            raise HTTPException(404)
        return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}

    @app.get("/__test__/state")
    def state():
        return {"messages": len(repo.rows[ChatMessage]), "envelopes": len(repo.rows[ChatMessageEnvelope]),
                "database_connection_attempts": attempts["database_connections"], "test_only": True}

    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=18081)
    parser.add_argument("--origin", action="append", default=[])
    args = parser.parse_args()
    origins = args.origin or ["http://127.0.0.1:15173", "http://localhost:15173"]
    import uvicorn
    uvicorn.run(create_relay_app(origins), host="127.0.0.1", port=args.port, workers=1,
                ws_max_size=2097152, ws_max_queue=4, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
