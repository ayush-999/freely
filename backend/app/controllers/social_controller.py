"""Social controller: posts, feed, interactions, follows, moderation (LLD §2.3)."""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.identity import User
from app.schemas.common import MessageResponse, Page
from app.schemas.social import (
    CollectionCreateRequest,
    CollectionResponse,
    CommentCreateRequest,
    CommentResponse,
    CommentUpdateRequest,
    MediaResponse,
    ModerationRequest,
    PostCreateRequest,
    PostPublicView,
    PostResponse,
    PostUpdateRequest,
    ProfilePostResponse,
    RepostRequest,
    RelationshipPersonResponse,
    UserRelationshipResponse,
    SavedPostResponse,
    TrendingHashtag,
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


@router.post(
    "/posts/{post_id}/media",
    response_model=MediaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload media (PDF, image, video) to an existing post",
)
async def upload_post_media(
    post_id: int,
    file: UploadFile = File(...),
    alt_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    content = await file.read()
    return SocialService(db).upload_post_media(
        author=current,
        post_id=post_id,
        file_name=file.filename or "attachment",
        content_type=file.content_type,
        content=content,
        alt_text=alt_text,
    )


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
    "/trending/hashtags",
    response_model=list[TrendingHashtag],
    summary="Trending hashtags from recent public posts",
)
def trending_hashtags(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    return SocialService(db).trending_hashtags(days, limit)


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


@router.patch(
    "/posts/{post_id}",
    response_model=PostResponse,
    summary="Edit your own post's text (marks it as edited)",
)
def edit_post(
    post_id: int,
    data: PostUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).edit_post(current, post_id, data)


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
    reposted = SocialService(db).repost(current, post_id, data)
    return MessageResponse(message="reposted" if reposted else "unreposted")


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


@router.get(
    "/bookmarks",
    response_model=list[SavedPostResponse],
    summary="My saved posts (optionally one collection), newest save first",
)
def saved_posts(
    collection_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).saved_posts(current, collection_id, limit, offset)


@router.get(
    "/bookmark-collections",
    response_model=list[CollectionResponse],
    summary="My collections with post counts",
)
def list_collections(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).list_collections(current)


@router.post(
    "/bookmark-collections",
    response_model=CollectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a collection",
)
def create_collection(
    data: CollectionCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).create_collection(current, data)


@router.delete(
    "/bookmark-collections/{collection_id}",
    response_model=MessageResponse,
    summary="Delete a collection (its posts stay saved)",
)
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    SocialService(db).delete_collection(current, collection_id)
    return MessageResponse(message="Collection deleted")


@router.put(
    "/bookmark-collections/{collection_id}/posts/{post_id}",
    response_model=MessageResponse,
    summary="Add a saved post to a collection",
)
def add_to_collection(
    collection_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    SocialService(db).add_to_collection(current, collection_id, post_id)
    return MessageResponse(message="Added to collection")


@router.delete(
    "/bookmark-collections/{collection_id}/posts/{post_id}",
    response_model=MessageResponse,
    summary="Remove a post from a collection (it stays saved)",
)
def remove_from_collection(
    collection_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    SocialService(db).remove_from_collection(current, collection_id, post_id)
    return MessageResponse(message="Removed from collection")


@router.get(
    "/users/{handle}/posts",
    response_model=list[ProfilePostResponse],
    summary="Profile feed: a user's own posts and reposts (visibility-filtered)",
)
def profile_posts(
    handle: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).profile_posts(current, handle, limit, offset)


@router.patch(
    "/comments/{comment_id}",
    response_model=CommentResponse,
    summary="Edit your own comment (within 30 minutes of posting)",
)
def edit_comment(
    comment_id: int,
    data: CommentUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).edit_comment(current, comment_id, data)


@router.delete(
    "/comments/{comment_id}",
    response_model=MessageResponse,
    summary="Delete your own comment or a comment on your post",
)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    SocialService(db).delete_comment(current, comment_id)
    return MessageResponse(message="Comment deleted")


@router.post(
    "/comments/{comment_id}/likes",
    response_model=MessageResponse,
    summary="Like / unlike a comment",
)
def toggle_comment_like(
    comment_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    liked = SocialService(db).toggle_comment_like(current, comment_id)
    return MessageResponse(message="liked" if liked else "unliked")


@router.get(
    "/users/{handle}/relationships", response_model=UserRelationshipResponse,
    summary="Public follower/following counts and viewer relationship",
)
def user_relationship(
    handle: str,
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).relationship(current, handle)


@router.get(
    "/users/{handle}/followers", response_model=Page[RelationshipPersonResponse],
    summary="Active followers with public profiles and viewer relationship",
)
def user_followers(
    handle: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).relationship_people(current, handle, "followers", limit, offset)


@router.get(
    "/users/{handle}/following", response_model=Page[RelationshipPersonResponse],
    summary="Active followed users with public profiles and viewer relationship",
)
def user_following(
    handle: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: Optional[User] = Depends(get_optional_user),
):
    return SocialService(db).relationship_people(current, handle, "following", limit, offset)


@router.put(
    "/users/{handle}/relationships/follow", response_model=UserRelationshipResponse,
    summary="Follow an active user by handle (idempotent)",
)
def follow_user(
    handle: str,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).set_follow(current, handle, True)


@router.delete(
    "/users/{handle}/relationships/follow", response_model=UserRelationshipResponse,
    summary="Unfollow a user by handle (idempotent)",
)
def unfollow_user(
    handle: str,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SocialService(db).set_follow(current, handle, False)


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
