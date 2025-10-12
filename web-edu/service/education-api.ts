import { apiClient, type ApiResponse } from './base-api'

export interface EducationSession {
  id: string
  session_name: string
  session_tag: string
  instructor_account_id: string
  start_date: string
  end_date: string
  max_students: number
  is_active: boolean
  created_at: string
}

export class EducationAPI {
  // 세션 관리 API (Story 1.6+ 에서 구현 예정)
  async getSessions(): Promise<ApiResponse<{ data: EducationSession[] }>> {
    return apiClient.get('/console/api/edu/sessions')
  }

  // 추후 다른 교육 관리 API 추가 예정
}

export const educationAPI = new EducationAPI()
