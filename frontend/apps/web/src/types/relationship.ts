import type { UserPublic } from "./identity"

export interface RelationshipSummary {
  user_handle: string
  followers_count: number
  following_count: number
  is_following: boolean
  follows_you: boolean
  is_self: boolean
}

export interface NetworkPerson extends UserPublic {
  is_following: boolean
  follows_you: boolean
  is_self: boolean
}

export interface PeoplePage {
  items: NetworkPerson[]
  total: number
  limit: number
  offset: number
}

export type NetworkList = "followers" | "following"
