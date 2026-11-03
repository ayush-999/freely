/**
 * Utility to resolve local media storage keys to accessible URLs.
 */

export const DEFAULT_AVATAR = "/images/profile_img/default_profile.svg"
export const DEFAULT_COVER = "/images/cover_img/default_cover.png"

export function getMediaUrl(
  storageKey: string | null | undefined,
  fallback: string = ""
): string {
  if (!storageKey || !storageKey.trim()) {
    return fallback
  }

  const trimmed = storageKey.trim()

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }

  // Convert Windows backslashes and guarantee a single leading slash
  const clean = trimmed.replace(/\\/g, "/").replace(/^\/+/, "")
  return `/${clean}`
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

