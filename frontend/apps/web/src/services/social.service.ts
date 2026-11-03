import { API_ENDPOINTS } from "@workspace/constants"

import type {
  BookmarkCollection,
  Comment,
  CommentCreateRequest,
  ListParams,
  MediaIn,
  MessageResponse,
  ModerationRequest,
  Post,
  PostCreateRequest,
  PostPublicView,
  ProfilePost,
  RepostRequest,
  SavedPost,
  TrendingHashtag,
} from "@/types"

import { api } from "./api"

/** Mirrors social_controller.py (posts, timeline, interactions, moderation). */
export const socialService = {
  async createPost(data: PostCreateRequest): Promise<Post> {
    const response = await api.post<Post>(API_ENDPOINTS.social.posts, data)
    return response.data
  },

  async uploadPostMedia(
    postId: number,
    file: File,
    altText?: string
  ): Promise<MediaIn> {
    const formData = new FormData()
    formData.append("file", file)
    if (altText) {
      formData.append("alt_text", altText)
    }
    const response = await api.post<MediaIn>(
      API_ENDPOINTS.social.uploadMedia(postId),
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    )
    return response.data
  },

  async lookupPost(publicPostId: string): Promise<PostPublicView> {
    const response = await api.get<PostPublicView>(
      API_ENDPOINTS.social.lookupPost(publicPostId)
    )
    return response.data
  },

  async getHomePosts(params?: ListParams): Promise<Post[]> {
    const response = await api.get<Post[]>(API_ENDPOINTS.social.feed, {
      params,
    })
    return response.data
  },

  async getTrendingHashtags(): Promise<TrendingHashtag[]> {
    const response = await api.get<TrendingHashtag[]>(
      API_ENDPOINTS.social.trendingHashtags
    )
    return response.data
  },

  async editPost(postId: number, body: string): Promise<Post> {
    const response = await api.patch<Post>(API_ENDPOINTS.social.post(postId), {
      body,
    })
    return response.data
  },

  async deletePost(postId: number): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(
      API_ENDPOINTS.social.post(postId)
    )
    return response.data
  },

  async toggleLike(postId: number): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.social.likes(postId)
    )
    return response.data
  },

  async toggleBookmark(postId: number): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.social.bookmarks(postId)
    )
    return response.data
  },

  async repost(postId: number, data: RepostRequest): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.social.reposts(postId),
      data
    )
    return response.data
  },

  async comment(postId: number, data: CommentCreateRequest): Promise<Comment> {
    const response = await api.post<Comment>(
      API_ENDPOINTS.social.comments(postId),
      data
    )
    return response.data
  },

  async getComments(postId: number, params?: ListParams): Promise<Comment[]> {
    const response = await api.get<Comment[]>(
      API_ENDPOINTS.social.comments(postId),
      { params }
    )
    return response.data
  },

  async editComment(commentId: number, body: string): Promise<Comment> {
    const response = await api.patch<Comment>(
      API_ENDPOINTS.social.comment(commentId),
      { body }
    )
    return response.data
  },

  async deleteComment(commentId: number): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(
      API_ENDPOINTS.social.deleteComment(commentId)
    )
    return response.data
  },

  async toggleCommentLike(commentId: number): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.social.commentLikes(commentId)
    )
    return response.data
  },

  async getSavedPosts(collectionId?: number): Promise<SavedPost[]> {
    const response = await api.get<SavedPost[]>(
      API_ENDPOINTS.social.savedPosts,
      {
        params:
          collectionId === undefined ? {} : { collection_id: collectionId },
      }
    )
    return response.data
  },

  async getCollections(): Promise<BookmarkCollection[]> {
    const response = await api.get<BookmarkCollection[]>(
      API_ENDPOINTS.social.collections
    )
    return response.data
  },

  async createCollection(name: string): Promise<BookmarkCollection> {
    const response = await api.post<BookmarkCollection>(
      API_ENDPOINTS.social.collections,
      { name }
    )
    return response.data
  },

  async deleteCollection(collectionId: number): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(
      API_ENDPOINTS.social.collection(collectionId)
    )
    return response.data
  },

  async addToCollection(
    collectionId: number,
    postId: number
  ): Promise<MessageResponse> {
    const response = await api.put<MessageResponse>(
      API_ENDPOINTS.social.collectionPost(collectionId, postId)
    )
    return response.data
  },

  async removeFromCollection(
    collectionId: number,
    postId: number
  ): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(
      API_ENDPOINTS.social.collectionPost(collectionId, postId)
    )
    return response.data
  },

  async getUserPosts(
    handle: string,
    params?: ListParams
  ): Promise<ProfilePost[]> {
    const response = await api.get<ProfilePost[]>(
      API_ENDPOINTS.social.userPosts(handle),
      { params }
    )
    return response.data
  },

  async toggleFollow(userId: number): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.social.follow(userId)
    )
    return response.data
  },

  async moderatePost(postId: number, data: ModerationRequest): Promise<Post> {
    const response = await api.post<Post>(
      API_ENDPOINTS.social.moderatePost(postId),
      data
    )
    return response.data
  },
}
