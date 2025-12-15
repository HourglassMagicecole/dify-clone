/**
 * Dashboard Type Definitions
 * 대시보드에서 사용하는 모든 데이터 타입 정의
 */

/**
 * 리소스 요약 타입
 */
export interface ResourceSummary {
  agents: number; // Agent 개수
  workflows: number; // Workflow 개수
  datasets: number; // Dataset(RAG) 개수
  total: number; // 전체 리소스 개수
}

/**
 * 최근 활동 타입
 */
export interface RecentActivity {
  id: string;
  type: 'agent' | 'workflow' | 'dataset'; // 리소스 타입
  resourceName: string; // 리소스 이름
  action: 'created' | 'updated' | 'executed' | 'deleted'; // 액션
  timestamp: string; // ISO 8601 형식
  status?: 'success' | 'failed'; // 실행 상태 (선택적)
  userName?: string; // 활동을 수행한 사용자 이름 (Owner/Admin 대시보드용)
}

/**
 * 일별 사용량 타입 (기존 호환성 유지)
 */
export interface DailyUsage {
  date: string; // YYYY-MM-DD 형식
  calls: number; // 해당 날짜의 API 호출 수
  tokens: number; // 해당 날짜의 토큰 사용량
}

/**
 * 일별 API 사용량 데이터 (Story 3.8)
 * 백엔드 DailyApiUsage와 일치
 */
export interface DailyApiUsage {
  date: string; // ISO date format (YYYY-MM-DD)
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * API 사용량 요약 데이터 (Story 3.8)
 * 백엔드 ApiUsageSummary와 일치
 */
export interface ApiUsageSummary {
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  dailyUsage: DailyApiUsage[];
}

/**
 * API 사용량 타입 (기존 호환성 유지)
 */
export interface ApiUsage {
  totalCalls: number; // 총 API 호출 수
  totalTokens: number; // 총 토큰 사용량
  estimatedCost: number; // 추정 비용 (USD)
  dailyUsage: DailyUsage[]; // 일별 사용량 (차트용)
}

/**
 * 대시보드 전체 데이터 타입
 */
export interface DashboardData {
  scope: 'system' | 'my_resources';
  resourceSummary: ResourceSummary;
  recentActivities: RecentActivity[];
  apiUsage: ApiUsageSummary;
}
