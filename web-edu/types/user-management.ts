/**
 * User Management Types
 * 사용자 관리 페이지에서 사용할 데이터 타입 정의
 */

// 사용자 정보 타입 (Account 기반)
export interface UserAccount {
  id: string;                    // Account.id (UUID)
  email: string;                 // Account.email
  name: string;                  // Account.name
  status: 'active' | 'banned';   // Account.status (활성/차단됨)
  created_at: string;            // ISO 8601 형식
  last_login_at?: string;        // 마지막 로그인 시간 (선택적)
  role?: 'owner' | 'admin' | 'student';    // TenantAccountJoin.role (시스템 역할)
}

// 사용자 생성 요청 타입
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;              // 최소 8자, 영문+숫자 조합
  role?: 'admin' | 'student';    // 기본값: 'student'
}

// 사용자 수정 요청 타입
export interface UpdateUserRequest {
  name?: string;
  status?: 'active' | 'banned';
  role?: 'owner' | 'admin' | 'student';
  password?: string;             // 새 비밀번호 (최소 8자)
}

// 사용자 목록 응답 타입
export interface UserListResponse {
  users: UserAccount[];
  total: number;
  page: number;
  limit: number;
}

// CSV 일괄 생성 요청 타입
export interface BulkCreateRequest {
  file: File;                    // CSV 파일
  session_id?: string;           // 선택적 세션 ID
}

// CSV 일괄 생성 응답 타입
export interface BulkCreateResponse {
  task_id: string;               // Celery Task ID
  message: string;
}

// 일괄 생성 작업 상태 타입
export interface BulkCreateStatus {
  task_id: string;
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
  progress?: {
    current: number;             // 현재 처리된 사용자 수
    total: number;               // 전체 사용자 수
    created: number;             // 성공적으로 생성된 수
    failed: number;              // 실패한 수
    errors: Array<{
      email: string;
      error: string;
    }>;
  };
}

// Admin 역할 할당 요청 타입
export interface AssignAdminRoleRequest {
  account_id: string;
  session_id: string;
  role: 'admin' | 'student';
}
