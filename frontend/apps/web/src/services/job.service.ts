import { API_ENDPOINTS } from "@workspace/constants"

import type {
  Application,
  ApplicationCreateRequest,
  ApplicationStatusChangeRequest,
  CandidateProfile,
  CandidateProfileUpdateRequest,
  Decision,
  DecisionCreateRequest,
  Job,
  JobCreateRequest,
  JobType,
  ListParams,
  MessageResponse,
  Receipt,
  ReceiptCreateRequest,
  ReceiptVerifyRequest,
  Result,
  ResultImportRequest,
} from "@/types"

import { api } from "./api"

export interface JobSearchParams extends ListParams {
  type?: JobType
  status?: string
  q?: string
}

/** Mirrors job_controller.py (jobs, receipts, applications, decisions, results). */
export const jobService = {
  // ---------------------------------------------------------- job postings
  async createJob(data: JobCreateRequest): Promise<Job> {
    const response = await api.post<Job>(API_ENDPOINTS.jobs.create, data)
    return response.data
  },

  async search(params?: JobSearchParams): Promise<Job[]> {
    const response = await api.get<Job[]>(API_ENDPOINTS.jobs.search, { params })
    return response.data
  },

  async getJob(publicJobId: string): Promise<Job> {
    const response = await api.get<Job>(
      API_ENDPOINTS.jobs.byPublicId(publicJobId)
    )
    return response.data
  },

  async publishJob(jobId: number): Promise<Job> {
    const response = await api.post<Job>(API_ENDPOINTS.jobs.publish(jobId))
    return response.data
  },

  async pauseJob(jobId: number): Promise<Job> {
    const response = await api.post<Job>(API_ENDPOINTS.jobs.pause(jobId))
    return response.data
  },

  async closeJob(jobId: number): Promise<Job> {
    const response = await api.post<Job>(API_ENDPOINTS.jobs.close(jobId))
    return response.data
  },

  // -------------------------------------------------------------- receipts
  async recordReceipt(
    jobId: number,
    data: ReceiptCreateRequest
  ): Promise<Receipt> {
    const response = await api.post<Receipt>(
      API_ENDPOINTS.jobs.receipts(jobId),
      data
    )
    return response.data
  },

  async verifyReceipt(
    receiptId: number,
    data: ReceiptVerifyRequest
  ): Promise<Receipt> {
    const response = await api.post<Receipt>(
      API_ENDPOINTS.jobs.verifyReceipt(receiptId),
      data
    )
    return response.data
  },

  // ----------------------------------------------------- candidate profiles
  async getMyProfile(): Promise<CandidateProfile> {
    const response = await api.get<CandidateProfile>(
      API_ENDPOINTS.jobs.myCandidateProfile
    )
    return response.data
  },

  async upsertMyProfile(
    data: CandidateProfileUpdateRequest
  ): Promise<CandidateProfile> {
    const response = await api.patch<CandidateProfile>(
      API_ENDPOINTS.jobs.myCandidateProfile,
      data
    )
    return response.data
  },

  // ---------------------------------------------------------- applications
  async apply(
    jobId: number,
    data: ApplicationCreateRequest
  ): Promise<Application> {
    const response = await api.post<Application>(
      API_ENDPOINTS.jobs.apply(jobId),
      data
    )
    return response.data
  },

  async changeApplicationStatus(
    applicationId: number,
    data: ApplicationStatusChangeRequest
  ): Promise<Application> {
    const response = await api.post<Application>(
      API_ENDPOINTS.jobs.applicationStatus(applicationId),
      data
    )
    return response.data
  },

  // ------------------------------------------------------------- decisions
  async createDecision(
    applicationId: number,
    data: DecisionCreateRequest
  ): Promise<Decision> {
    const response = await api.post<Decision>(
      API_ENDPOINTS.jobs.decisions(applicationId),
      data
    )
    return response.data
  },

  async publishDecision(decisionId: number): Promise<Decision> {
    const response = await api.post<Decision>(
      API_ENDPOINTS.jobs.publishDecision(decisionId)
    )
    return response.data
  },

  async acknowledgeDecision(decisionId: number): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.jobs.acknowledgeDecision(decisionId)
    )
    return response.data
  },

  // --------------------------------------------------------------- results
  async importResult(
    applicationId: number,
    data: ResultImportRequest
  ): Promise<Result> {
    const response = await api.post<Result>(
      API_ENDPOINTS.jobs.importResult(applicationId),
      data
    )
    return response.data
  },

  // ------------------------------------------------------------ saved jobs
  async toggleSavedJob(jobId: number): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.jobs.save(jobId)
    )
    return response.data
  },
}
