/** Social graph & microblogging DTOs (mirrors backend/app/schemas/social.py). */

export type PostVisibility = "public" | "followers" | "department" | "private"
export type MediaType = "image" | "video" | "document"
export type RepostType = "repost" | "quote"
export type ModerationStatus = "visible" | "hidden" | "removed" | "under_review"

export interface MediaIn {
  file_name: string
  storage_key: string
  mime_type?: string
  file_size_bytes?: number
  alt_text?: string
  media_type: MediaType
  sort_order?: number
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
}

export interface PostPublicView {
  public_post_id: string
  body: string
  post_type: string
  is_sensitive: boolean
  created_at: string
}

export interface CommentCreateRequest {
  body: string
  parent_comment_id?: number
}

export interface Comment {
  id: number
  post_id: number
  user_id: number
  parent_comment_id: number | null
  body: string
  moderation_status: string
  created_at: string
}

export interface RepostRequest {
  repost_type?: RepostType
  quote_post_id?: number
}

export interface ModerationRequest {
  moderation_status: ModerationStatus
  reason?: string
}
