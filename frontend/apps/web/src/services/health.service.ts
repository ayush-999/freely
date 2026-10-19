import { API_ENDPOINTS } from "@workspace/constants"

import { api } from "./api"

interface HealthStatus {
  status: string
}

interface DatabaseHealthStatus extends HealthStatus {
  database: string
}

export const healthService = {
  async liveness(): Promise<HealthStatus> {
    const { data } = await api.get<HealthStatus>(API_ENDPOINTS.health.liveness)
    return data
  },

  async database(): Promise<DatabaseHealthStatus> {
    const { data } = await api.get<DatabaseHealthStatus>(
      API_ENDPOINTS.health.database
    )
    return data
  },
}
