import { API_ENDPOINTS } from "@workspace/constants"

import type {
  Comment,
  CommentCreateRequest,
  ListParams,
  MessageResponse,
  ModerationRequest,
  Post,
  PostCreateRequest,
  PostPublicView,
  RepostRequest,
} from "@/types"

import { api } from "./api"

/** Mirrors social_controller.py (posts, feed, interactions, moderation). */
export const socialService = {
  async createPost(data: PostCreateRequest): Promise<Post> {
    const response = await api.post<Post>(API_ENDPOINTS.social.posts, data)
    return response.data
  },

  async lookupPost(publicPostId: string): Promise<PostPublicView> {
    const response = await api.get<PostPublicView>(
      API_ENDPOINTS.social.lookupPost(publicPostId)
    )
    return response.data
  },

  async getFeed(params?: ListParams): Promise<Post[]> {
    const response = await api.get<Post[]>(API_ENDPOINTS.social.feed, {
      params,
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
