"""Social controller: posts, feed, interactions, follows, moderation (LLD §2.3)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.identity import User
from app.schemas.common import MessageResponse
from app.schemas.social import (
    CommentCreateRequest,
    CommentResponse,
    ModerationRequest,
    PostCreateRequest,
    PostPublicView,
    PostResponse,
    RepostRequest,
)
from app.services.social_service import SocialService

router = APIRouter()


@router.post(
    "/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a post (guest or authenticated; TX: post + media + hashtags + mentions)",
)
def create_post(
    data: PostCreateRequest,
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).create_post(current, data)


@router.get(
    "/posts/lookup/{public_post_id}",
    response_model=PostPublicView,
    summary="Anonymous post lookup by public ID (public-safe fields only)",
)
def lookup_post(public_post_id: str, db: Session = Depends(get_db)):
    return SocialService(db).lookup_public(public_post_id)


@router.get("/feed", response_model=list[PostResponse], summary="Timeline (visibility-filtered)")
def feed(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).feed(current, limit, offset)


@router.get(
    "/posts/{post_id}/comments",
    response_model=list[CommentResponse],
    summary="List visible comments on a viewable post",
)
def list_comments(
    post_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).comments_for_post(current, post_id, limit, offset)


@router.delete("/posts/{post_id}", response_model=MessageResponse, summary="Soft delete a post")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    SocialService(db).delete_post(current, post_id)
    return MessageResponse(message="Post deleted")


@router.post("/posts/{post_id}/likes", response_model=MessageResponse, summary="Like / unlike")
def toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    liked = SocialService(db).toggle_like(current, post_id)
    return MessageResponse(message="liked" if liked else "unliked")


@router.post("/posts/{post_id}/bookmarks", response_model=MessageResponse, summary="Bookmark / unbookmark")
def toggle_bookmark(
    post_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    saved = SocialService(db).toggle_bookmark(current, post_id)
    return MessageResponse(message="bookmarked" if saved else "bookmark removed")


@router.post("/posts/{post_id}/reposts", response_model=MessageResponse, summary="Repost / quote")
def repost(
    post_id: int,
    data: RepostRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    SocialService(db).repost(current, post_id, data)
    return MessageResponse(message="repost toggled")


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a post",
)
def comment(
    post_id: int,
    data: CommentCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).comment(current, post_id, data)


@router.post("/users/{user_id}/follow", response_model=MessageResponse, summary="Follow / unfollow")
def toggle_follow(
    user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    following = SocialService(db).toggle_follow(current, user_id)
    return MessageResponse(message="following" if following else "unfollowed")


@router.post(
    "/moderation/posts/{post_id}",
    response_model=PostResponse,
    summary="Set post moderation status (moderation_admin)",
)
def moderate_post(
    post_id: int,
    data: ModerationRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).moderate_post(current, post_id, data)
