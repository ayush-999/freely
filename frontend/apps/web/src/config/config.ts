const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api"
const aiVoiceEnabled =
  import.meta.env.AI_VOICE_ENABLED?.trim().toLowerCase() === "true"

export const config = {
  apiBaseUrl: apiBaseUrl.replace(/\/+$/, "") || "/",
  aiVoiceEnabled,
}
