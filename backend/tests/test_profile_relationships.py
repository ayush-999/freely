"""Existing follow-graph UI support, verified without executing SQL."""

from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import mssql
from sqlalchemy.exc import IntegrityError

from app.controllers import social_controller
from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError, register_exception_handlers
from app.core.security import create_access_token
from app.models.identity import User
from app.models.social import UserFollow
from app.repositories.social_repository import UserFollowRepository
from app.services.social_service import SocialService


class MemoryGraph:
    def __init__(self):
        self.users = {
            number: User(id=number, user_handle=handle, full_name=handle.title(),
                         is_active=active, is_verified=False, created_at=datetime(2026, 1, 1),
                         email=f"{handle}@private.test", phone="private", password_hash="private")
            for number, handle, active in ((1, "alice", True), (2, "bob", True),
                                            (3, "carol", True), (4, "inactive", False))
        }
        self.edges = {}
        self.commits = 0
        self.rollbacks = 0
        self.race = False

    def get_by_handle(self, handle):
        return next((user for user in self.users.values() if user.user_handle == handle), None)

    def get_or_404(self, user_id):
        if user_id not in self.users:
            raise NotFoundError("User not found")
        return self.users[user_id]

    def get(self, model, key):
        if model is User:
            return self.users.get(key)
        if model is UserFollow:
            return self.edges.get(key)
        raise AssertionError("Unexpected persistence access")

    def get_pair(self, follower, followed):
        return self.edges.get((follower, followed))

    def add(self, edge):
        key = (edge.follower_user_id, edge.followed_user_id)
        edge.created_at = datetime(2026, 1, 1) + timedelta(seconds=len(self.edges))
        self.edges[key] = edge

    def commit(self):
        self.commits += 1
        if self.race:
            self.race = False
            raise IntegrityError("simulated duplicate follow", {}, Exception("duplicate"))

    def rollback(self):
        self.rollbacks += 1

    def remove_pair(self, follower, followed):
        self.edges.pop((follower, followed), None)

    def delete(self, edge):
        self.remove_pair(edge.follower_user_id, edge.followed_user_id)

    def count_people(self, user_id, direction):
        return len(self.people(user_id, direction, 1000, 0))

    def people(self, user_id, direction, limit, offset):
        ids = [follower if direction == "followers" else followed
               for follower, followed in self.edges
               if (followed if direction == "followers" else follower) == user_id]
        people = [self.users[number] for number in ids if self.users[number].is_active]
        return sorted(people, key=lambda user: user.id, reverse=True)[offset:offset + limit]

    def viewer_pairs(self, viewer_id, user_ids):
        return {(follower, followed) for follower, followed in self.edges
                if (follower == viewer_id and followed in user_ids)
                or (followed == viewer_id and follower in user_ids)}


@pytest.fixture
def graph_service():
    graph = MemoryGraph()
    service = SocialService(graph)
    service.users = graph
    service.follows = graph
    return graph, service


def test_summary_counts_guest_self_and_mutual_relationship(graph_service):
    graph, service = graph_service
    for pair in ((1, 2), (2, 1), (3, 2), (4, 2)):
        graph.add(UserFollow(follower_user_id=pair[0], followed_user_id=pair[1]))
    summary = service.relationship(graph.users[1], "bob")
    assert summary.model_dump() == {
        "user_handle": "bob", "followers_count": 2, "following_count": 1,
        "is_following": True, "follows_you": True, "is_self": False,
    }
    guest = service.relationship(None, "bob")
    assert not guest.is_following and not guest.follows_you and not guest.is_self
    own = service.relationship(graph.users[2], "bob")
    assert own.is_self and not own.is_following and not own.follows_you


def test_follow_and_unfollow_are_idempotent_and_mutate_only_the_caller_edge(graph_service):
    graph, service = graph_service
    graph.add(UserFollow(follower_user_id=3, followed_user_id=2))
    for _ in range(2):
        assert service.set_follow(graph.users[1], "bob", True).is_following
    assert set(graph.edges) == {(1, 2), (3, 2)}
    for _ in range(2):
        assert not service.set_follow(graph.users[1], "bob", False).is_following
    assert set(graph.edges) == {(3, 2)}


def test_concurrent_duplicate_follow_returns_the_existing_relationship(graph_service):
    graph, service = graph_service
    graph.race = True
    assert service.set_follow(graph.users[1], "bob", True).is_following
    assert graph.rollbacks == 1
    assert set(graph.edges) == {(1, 2)}


def test_missing_inactive_and_self_targets_fail_before_writes(graph_service):
    graph, service = graph_service
    for handle in ("missing", "inactive"):
        with pytest.raises(NotFoundError):
            service.relationship(None, handle)
        with pytest.raises(NotFoundError):
            service.set_follow(graph.users[1], handle, True)
    with pytest.raises(ForbiddenError):
        service.set_follow(graph.users[1], "alice", True)
    assert not graph.edges and graph.commits == 0


def test_people_pagination_and_flags_never_expose_private_fields(graph_service):
    graph, service = graph_service
    for pair in ((1, 2), (3, 2), (2, 1), (4, 2)):
        graph.add(UserFollow(follower_user_id=pair[0], followed_user_id=pair[1]))
    first = service.relationship_people(graph.users[1], "bob", "followers", 1, 0)
    assert first["total"] == 2 and first["items"][0].user_handle == "carol"
    second = service.relationship_people(graph.users[1], "bob", "followers", 1, 1)
    assert second["items"][0].is_self
    following = service.relationship_people(graph.users[1], "bob", "following", 20, 0)
    assert following["items"][0].user_handle == "alice"
    for item in first["items"] + second["items"]:
        assert {"id", "email", "phone", "password_hash", "preferred_language"}.isdisjoint(item.model_dump())


@pytest.fixture
def client(graph_service, monkeypatch):
    graph, service = graph_service
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(social_controller.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = lambda: graph
    monkeypatch.setattr(social_controller, "SocialService", lambda db: service)
    with TestClient(app) as client:
        client.alice = {"Authorization": f"Bearer {create_access_token('1')}"}
        yield client


def test_http_guest_reads_authenticated_idempotent_writes_and_paging(client):
    url = "/api/v1/users/bob/relationships/follow"
    assert client.get("/api/v1/users/bob/relationships").json()["followers_count"] == 0
    assert client.put(url).status_code == 401
    assert client.delete(url).status_code == 401
    for _ in range(2):
        result = client.put(url, headers=client.alice)
        assert result.status_code == 200 and result.json()["is_following"]
    followers = client.get("/api/v1/users/bob/followers?limit=1&offset=0", headers=client.alice).json()
    assert followers["total"] == 1 and followers["items"][0]["is_self"]
    assert "email" not in followers["items"][0]
    assert client.get("/api/v1/users/bob/followers?limit=101").status_code == 422
    assert client.get("/api/v1/users/bob/following?offset=-1").status_code == 422
    for _ in range(2):
        assert not client.delete(url, headers=client.alice).json()["is_following"]


def test_http_self_missing_inactive_and_legacy_route_preserved(client):
    assert client.put("/api/v1/users/alice/relationships/follow", headers=client.alice).status_code == 403
    assert client.put("/api/v1/users/inactive/relationships/follow", headers=client.alice).status_code == 404
    assert client.get("/api/v1/users/missing/followers").status_code == 404
    assert client.post("/api/v1/users/2/follow", headers=client.alice).json() == {"message": "following"}
    assert client.post("/api/v1/users/2/follow", headers=client.alice).json() == {"message": "unfollowed"}


def test_repository_queries_compile_as_bound_mssql_without_running_them():
    # Real dialect compilation checks active filtering and stable ordering syntax
    # without opening a connection or substituting a different database engine.
    for direction in ("followers", "following"):
        statement = UserFollowRepository._people_query(123, direction).order_by(
            UserFollow.created_at.desc(), User.id.desc()
        ).offset(2).limit(20)
        compiled = statement.compile(dialect=mssql.dialect())
        assert "user_follows" in str(compiled) and "is_active" in str(compiled)
        assert 123 in compiled.params.values()
        assert "123" not in str(compiled)
