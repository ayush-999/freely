/** Social graph & microblogging DTOs (mirrors backend/app/schemas/social.py). */

export type PostVisibility = "public" | "followers" | "department" | "private"
export type MediaType = "image" | "video" | "document"
export type RepostType = "repost" | "quote"
export type ModerationStatus = "visible" | "hidden" | "removed" | "under_review"

export interface MediaIn {
  id?: number
  post_id?: number
  uploaded_by_user_id?: number | null
  file_name: string
  storage_key: string
  mime_type?: string
  file_size_bytes?: number
  alt_text?: string
  media_type: MediaType
  sort_order?: number
  created_at?: string
}

export interface PostCreateRequest {
  body: string
  visibility?: PostVisibility
  is_anonymous?: boolean
  is_sensitive?: boolean
  reply_to_post_id?: number
  quote_post_id?: number
  media?: MediaIn[]
}

export interface Post {
  id: number
  public_post_id: string
  author_user_id: number | null
  is_anonymous: boolean
  body: string
  post_type: string
  visibility: string
  moderation_status: string
  created_at: string
  edited_at?: string | null
  like_count: number
  comment_count: number
  repost_count: number
  is_liked: boolean
  is_reposted: boolean
  is_bookmarked: boolean
  author_handle?: string | null
  author_full_name?: string | null
  author_avatar_storage_key?: string | null
  media?: MediaIn[]
}

/** A post on a profile feed; set `reposted_by_handle` when it is a repost. */
export interface ProfilePost extends Post {
  activity_at: string
  reposted_by_handle: string | null
  reposted_by_full_name: string | null
}

/** A saved post; `collection_ids` lists the collections it is filed in. */
export interface SavedPost extends Post {
  saved_at: string
  collection_ids: number[]
}

export interface BookmarkCollection {
  id: number
  name: string
  created_at: string
  post_count: number
}

export interface TrendingHashtag {
  tag: string
  post_count: number
}

export interface PostPublicView {
  public_post_id: string
  body: string
  post_type: string
  is_sensitive: boolean
  created_at: string
  media?: MediaIn[]
}

export interface CommentCreateRequest {
  body: string
  parent_comment_id?: number
}

export interface Comment {
  id: number
  post_id: number
  user_id: number
  user_handle: string
  full_name: string
  parent_comment_id: number | null
  body: string
  moderation_status: string
  created_at: string
  updated_at: string | null
  like_count: number
  is_liked: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface RepostRequest {
  repost_type?: RepostType
  quote_post_id?: number
}

export interface ModerationRequest {
  moderation_status: ModerationStatus
  reason?: string
}
