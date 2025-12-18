/**
 * Education session types
 */

export interface Session {
  id: string
  session_name: string
  session_tag: string
  tenant_id: string
  instructor_account_id: string
  instructor_name?: string
  instructor_email?: string
  start_date: string // ISO 8601
  end_date?: string // ISO 8601
  max_students: number
  is_active: boolean
  force_status: boolean | null // null=auto (date-based), true=force active, false=force inactive
  is_currently_active: boolean // Calculated: actual active status based on force_status and dates
  description?: string
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface SessionMember {
  account_id: string
  name: string
  email: string
  status: 'active' | 'removed' | 'inactive'
  joined_at: string // ISO 8601
}

export interface CreateSessionRequest {
  session_name: string
  session_tag: string
  start_date: string // ISO 8601
  end_date?: string // ISO 8601
  max_students?: number
  description?: string
}

export interface UpdateSessionRequest {
  session_name?: string
  start_date?: string // ISO 8601
  end_date?: string // ISO 8601
  max_students?: number
  is_active?: boolean
  force_status?: boolean | null // null=auto, true=force active, false=force inactive
  description?: string
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
  page: number
  limit: number
}

// ============================================================================
// Session Resource Types
// ============================================================================

export interface SessionResource {
  resource_id: string
  resource_name: string
  account_id: string
  account_name: string | null
  account_email: string | null
  tagged_at: string // ISO 8601
  created_at: string // ISO 8601
}

export interface SessionResourcesSummary {
  total_apps: number
  total_datasets: number
}

export interface SessionResourcesResponse {
  apps: SessionResource[]
  datasets: SessionResource[]
  summary: SessionResourcesSummary
}

export interface ResourceAccount {
  account_id: string
  name: string
  email: string
}

export interface DeleteResourcesResponse {
  task_id: string
  message: string
}

export interface DeleteProgress {
  current: number
  total: number
  deleted_apps: number
  deleted_datasets: number
  phase: 'deleting_apps' | 'deleting_datasets' | 'cleanup'
}

export interface DeleteResult {
  status: string
  deleted_apps: number
  deleted_datasets: number
  verified_tags_remaining: number
  errors: string[]
}

export interface DeleteStatus {
  status: 'pending' | 'progress' | 'completed' | 'failed' | string
  progress: DeleteProgress | null
  result: DeleteResult | null
  error: string | null
}

// ============================================================================
// Member Removal Types
// ============================================================================

export interface RemoveMemberResponse {
  task_id: string
  message: string
}

export interface MemberRemoveProgress {
  current: number
  total: number
  deleted_apps: number
  deleted_datasets: number
  member_removed: boolean
  phase: 'deleting_apps' | 'deleting_datasets' | 'removing_member'
}

export interface MemberRemoveResult {
  status: string
  deleted_apps: number
  deleted_datasets: number
  member_removed: boolean
  errors: string[]
}

export interface MemberRemoveStatus {
  status: 'pending' | 'progress' | 'completed' | 'failed' | string
  progress: MemberRemoveProgress | null
  result: MemberRemoveResult | null
  error: string | null
}

// ============================================================================
// Session Deletion Types
// ============================================================================

export interface DeleteSessionResponse {
  task_id: string
  message: string
}

export interface SessionDeleteProgress {
  current: number
  total: number
  deleted_apps: number
  deleted_datasets: number
  session_deleted: boolean
  phase: 'deleting_apps' | 'deleting_datasets' | 'deleting_session'
}

export interface SessionDeleteResult {
  status: string
  deleted_apps: number
  deleted_datasets: number
  session_deleted: boolean
  errors: string[]
}

export interface SessionDeleteStatus {
  status: 'pending' | 'progress' | 'completed' | 'failed' | string
  progress: SessionDeleteProgress | null
  result: SessionDeleteResult | null
  error: string | null
}
