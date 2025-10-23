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
  description?: string
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
  page: number
  limit: number
}
