/** Jobs & recruitment DTOs (mirrors backend/app/schemas/job.py). */

export type JobType = "government" | "private" | "individual" | "ngo" | "other"
export type EmploymentType =
  "full_time" | "part_time" | "contract" | "internship" | "temporary"
export type WorkplaceType = "onsite" | "hybrid" | "remote"
export type SalaryPeriod = "hourly" | "monthly" | "yearly"
export type ApplicationMethod =
  "platform" | "external_url" | "email" | "offline"
export type JobStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "paused"
  | "closed"
  | "rejected"
  | "archived"
export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "interview"
  | "offered"
  | "hired"
  | "rejected"
  | "withdrawn"
export type DecisionType =
  | "selected"
  | "not_selected"
  | "waitlisted"
  | "conditional_offer"
  | "offer"
  | "hired"
  | "cancelled"
  | "pending"
export type RecruitmentStage =
  | "application_screening"
  | "written_exam"
  | "prelims"
  | "mains"
  | "interview"
  | "skill_test"
  | "document_verification"
  | "merit_list"
  | "waiting_list"
  | "final_selection"
export type ResultStatus =
  | "pending"
  | "qualified"
  | "not_qualified"
  | "selected"
  | "not_selected"
  | "waitlisted"
  | "absent"
  | "disqualified"
export type ProfileVisibility = "private" | "employers" | "public"
export type ReceiptMethod = "manual" | "email" | "api" | "import" | "other"

export interface GovernmentDetailsIn {
  recruitment_name?: string
  advertisement_number?: string
  department_name?: string
  post_name?: string
  number_of_vacancies?: number
  eligibility_criteria?: string
  minimum_age?: number
  maximum_age?: number
  educational_qualification?: string
  application_start_at?: string
  application_end_at?: string
  examination_date?: string
  official_notification_url?: string
  official_application_url?: string
}

export interface JobCreateRequest {
  job_type: JobType
  organization_id?: number
  employer_user_id?: number
  title: string
  description: string
  employment_type?: EmploymentType
  experience_level?: string
  workplace_type?: WorkplaceType
  city?: string
  state?: string
  country?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  salary_period?: SalaryPeriod
  application_method?: ApplicationMethod
  application_url?: string
  application_email?: string
  application_deadline?: string
  government_details?: GovernmentDetailsIn
}

export interface Job {
  id: number
  public_job_id: string
  job_type: string
  organization_id: number | null
  employer_user_id: number | null
  posted_by_user_id: number
  title: string
  description: string
  employment_type: string | null
  workplace_type: string | null
  city: string | null
  state: string | null
  country: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_period: string | null
  application_method: string
  application_url: string | null
  application_email: string | null
  status: string
  published_at: string | null
  application_deadline: string | null
  created_at: string
}

export interface ReceiptCreateRequest {
  source_organization_id: number
  source_reference?: string
  source_url?: string
  receipt_batch_id?: string
  receipt_method?: ReceiptMethod
}

export interface Receipt {
  id: number
  job_posting_id: number
  source_organization_id: number
  received_by_user_id: number | null
  received_at: string
  source_reference: string | null
  source_url: string | null
  receipt_batch_id: string | null
  receipt_method: string | null
  verification_status: string
}

export interface ReceiptVerifyRequest {
  verified: boolean
  verification_notes?: string
}

export interface CandidateProfileUpdateRequest {
  headline?: string
  professional_summary?: string
  current_job_title?: string
  total_experience_months?: number
  current_city?: string
  current_state?: string
  resume_storage_key?: string
  portfolio_url?: string
  linkedin_url?: string
  profile_visibility?: ProfileVisibility
}

export interface CandidateProfile {
  user_id: number
  headline: string | null
  professional_summary: string | null
  current_job_title: string | null
  total_experience_months: number | null
  current_city: string | null
  current_state: string | null
  resume_storage_key: string | null
  portfolio_url: string | null
  linkedin_url: string | null
  profile_visibility: string
}

export interface ApplicationCreateRequest {
  resume_storage_key?: string
  cover_letter?: string
  external_application_reference?: string
}

export interface Application {
  id: number
  job_posting_id: number
  applicant_user_id: number
  submission_status: string
  status: string
  status_source: string
  applied_at: string
  withdrawn_at: string | null
}

export interface ApplicationStatusChangeRequest {
  new_status: ApplicationStatus
  change_reason?: string
  reason_code?: string
  candidate_visible_reason?: string
  internal_notes?: string
  is_candidate_visible?: boolean
}

export interface DecisionCreateRequest {
  decision_type: DecisionType
  reason_code?: string
  candidate_message?: string
  internal_notes?: string
  is_official?: boolean
  is_final?: boolean
  decision_reference?: string
}

export interface Decision {
  id: number
  application_id: number
  decision_type: string
  reason_code: string | null
  candidate_message: string | null
  decision_source: string
  is_official: boolean
  is_final: boolean
  decision_reference: string | null
  decision_at: string | null
  published_at: string | null
}

export interface ResultImportRequest {
  recruitment_stage: RecruitmentStage
  result_status: ResultStatus
  marks_obtained?: number
  maximum_marks?: number
  rank_number?: number
  roll_number?: string
  result_reference?: string
  official_result_url?: string
  result_document_storage_key?: string
  candidate_message?: string
  is_official?: boolean
  result_date?: string
}

export interface Result {
  id: number
  application_id: number
  recruitment_stage: string
  result_status: string
  marks_obtained: number | null
  maximum_marks: number | null
  rank_number: number | null
  roll_number: string | null
  result_reference: string | null
  official_result_url: string | null
  candidate_message: string | null
  is_official: boolean
  result_date: string | null
  published_at: string | null
}
