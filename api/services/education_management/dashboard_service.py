"""
Dashboard Service
대시보드 데이터 조회 서비스
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from operator import itemgetter
from typing import Any, Literal

from sqlalchemy import Date, cast, func
from sqlalchemy.exc import SQLAlchemyError

from models.account import Account, TenantAccountRole
from models.dataset import Dataset
from models.education import LlmUsageLog
from models.education.resource_tag import SessionResourceTag
from models.engine import db
from models.model import App
from services.education_management.types import ApiUsageSummary, DailyApiUsage

logger = logging.getLogger(__name__)


class DashboardService:
    """대시보드 데이터 조회 서비스"""

    def get_user_dashboard(
        self,
        account_id: str,
        role: TenantAccountRole | None = None,
        session_id: str | None = None,
        admin_id: str | None = None,
    ) -> dict[str, Any]:
        """
        사용자 대시보드 데이터 조회

        Args:
            account_id: 현재 로그인한 사용자 ID
            role: 사용자 역할 (Owner, Admin, Normal 등)
            session_id: 세션 ID (Admin/Student용)
            admin_id: 관리자 ID (Owner 전용, 특정 관리자의 리소스만 필터링)

        Returns:
            대시보드 데이터 딕셔너리 (scope 필드 포함)

        Raises:
            SQLAlchemyError: 데이터베이스 조회 실패 시
        """
        try:
            logger.info(
                "Fetching dashboard data for user: %s (role: %s, session: %s, admin: %s)",
                account_id,
                role,
                session_id or "all",
                admin_id or "all",
            )

            # 역할에 따른 scope 결정
            # Owner와 Admin: 세션의 모든 리소스 조회 (system scope)
            # Student: 본인 리소스만 조회 (my_resources scope)
            scope: Literal["system", "my_resources"] = "my_resources"
            if role in (TenantAccountRole.OWNER, TenantAccountRole.ADMIN):
                scope = "system"

            # 1. 리소스 요약 집계 (역할별 필터링)
            resource_summary = self._get_resource_summary(account_id, scope, session_id=session_id, admin_id=admin_id)
            logger.info(
                "Resource summary for (session=%s, admin=%s): %s",
                session_id or "all",
                admin_id or "all",
                resource_summary,
            )

            # 2. 최근 활동 조회 (역할별 필터링)
            recent_activities = self._get_recent_activities(
                account_id, scope=scope, session_id=session_id, admin_id=admin_id
            )
            logger.debug("Recent activities count: %d", len(recent_activities))

            # 3. API 사용량 조회
            api_usage = self._get_api_usage(account_id, session_id=session_id)

            logger.info("Dashboard data fetched successfully for user: %s (scope: %s)", account_id, scope)
            return {
                "scope": scope,
                "resourceSummary": resource_summary,
                "recentActivities": recent_activities,
                "apiUsage": api_usage,
            }

        except SQLAlchemyError as e:
            logger.error("Database error while fetching dashboard data for user %s: %s", account_id, e, exc_info=True)
            raise
        except Exception as e:
            logger.error("Unexpected error while fetching dashboard data for user %s: %s", account_id, e, exc_info=True)
            raise

    def _get_resource_summary(
        self,
        account_id: str,
        scope: Literal["system", "my_resources"],
        session_id: str | None = None,
        admin_id: str | None = None,
    ) -> dict[str, int]:
        """
        리소스 요약 집계 - Agent, Workflow, Dataset 개수

        Owner (scope=system): 전체 시스템 리소스 집계 또는 특정 관리자의 리소스 집계 (admin_id로 필터링)
        Admin/Student (scope=my_resources): SessionResourceTag를 통해 태그된 본인 리소스만 집계
        App.mode를 확인하여 Agent와 Workflow 구분

        Args:
            account_id: 사용자 ID
            scope: 데이터 범위 ("system" 또는 "my_resources")
            session_id: 세션 ID (Admin/Student용, None이면 모든 세션)
            admin_id: 관리자 ID (Owner 전용, 특정 관리자의 리소스만 필터링)

        Returns:
            리소스 요약 딕셔너리

        Raises:
            SQLAlchemyError: 데이터베이스 조회 실패 시
        """
        try:
            if scope == "system":
                # Owner: session_id 또는 admin_id로 필터링
                # - admin_id + session_id: 특정 관리자의 특정 세션 리소스
                # - admin_id만: 특정 관리자의 모든 리소스
                # - session_id만: 해당 세션의 모든 리소스
                # - 둘 다 없음: 전체 시스템 리소스
                if admin_id or session_id:
                    # SessionResourceTag를 사용하여 필터링
                    agents_query = (
                        db.session.query(func.count(SessionResourceTag.id.distinct()))
                        .join(App, SessionResourceTag.resource_id == App.id)
                        .filter(
                            SessionResourceTag.resource_type == "app",
                            App.mode != "workflow",
                        )
                    )
                    if admin_id:
                        agents_query = agents_query.filter(SessionResourceTag.account_id == admin_id)
                    if session_id:
                        agents_query = agents_query.filter(SessionResourceTag.session_id == session_id)

                    logger.info(
                        "Agents query for admin=%s, session=%s: %s",
                        admin_id,
                        session_id or "all",
                        str(agents_query),
                    )
                    agents_count = agents_query.scalar() or 0
                    logger.info("Agents count result: %d", agents_count)

                    workflows_query = (
                        db.session.query(func.count(SessionResourceTag.id.distinct()))
                        .join(App, SessionResourceTag.resource_id == App.id)
                        .filter(
                            SessionResourceTag.resource_type == "app",
                            App.mode == "workflow",
                        )
                    )
                    if admin_id:
                        workflows_query = workflows_query.filter(SessionResourceTag.account_id == admin_id)
                    if session_id:
                        workflows_query = workflows_query.filter(SessionResourceTag.session_id == session_id)
                    workflows_count = workflows_query.scalar() or 0

                    datasets_query = (
                        db.session.query(func.count(SessionResourceTag.id.distinct()))
                        .join(Dataset, SessionResourceTag.resource_id == Dataset.id)
                        .filter(
                            SessionResourceTag.resource_type == "dataset",
                        )
                    )
                    if admin_id:
                        datasets_query = datasets_query.filter(SessionResourceTag.account_id == admin_id)
                    if session_id:
                        datasets_query = datasets_query.filter(SessionResourceTag.session_id == session_id)
                    datasets_count = datasets_query.scalar() or 0
                else:
                    # 전체 시스템 리소스 집계 (SessionResourceTag 없이)
                    agents_count = (
                        db.session.query(func.count(App.id.distinct())).filter(App.mode != "workflow").scalar() or 0
                    )

                    workflows_count = (
                        db.session.query(func.count(App.id.distinct())).filter(App.mode == "workflow").scalar() or 0
                    )

                    datasets_count = db.session.query(func.count(Dataset.id.distinct())).scalar() or 0

            else:
                # Admin/Student: 본인이 태그한 리소스만 집계
                # Agent 개수 (App.mode != 'workflow'인 App)
                agents_query = (
                    db.session.query(func.count(SessionResourceTag.id.distinct()))
                    .join(App, SessionResourceTag.resource_id == App.id)
                    .filter(
                        SessionResourceTag.account_id == account_id,
                        SessionResourceTag.resource_type == "app",
                        App.mode != "workflow",
                    )
                )
                if session_id:
                    agents_query = agents_query.filter(SessionResourceTag.session_id == session_id)
                agents_count = agents_query.scalar() or 0

                # Workflow 개수 (App.mode == 'workflow'인 App)
                workflows_query = (
                    db.session.query(func.count(SessionResourceTag.id.distinct()))
                    .join(App, SessionResourceTag.resource_id == App.id)
                    .filter(
                        SessionResourceTag.account_id == account_id,
                        SessionResourceTag.resource_type == "app",
                        App.mode == "workflow",
                    )
                )
                if session_id:
                    workflows_query = workflows_query.filter(SessionResourceTag.session_id == session_id)
                workflows_count = workflows_query.scalar() or 0

                # Dataset 개수 (SessionResourceTag를 통해 태그된 Dataset)
                datasets_query = (
                    db.session.query(func.count(SessionResourceTag.id.distinct()))
                    .join(Dataset, SessionResourceTag.resource_id == Dataset.id)
                    .filter(
                        SessionResourceTag.account_id == account_id,
                        SessionResourceTag.resource_type == "dataset",
                    )
                )
                if session_id:
                    datasets_query = datasets_query.filter(SessionResourceTag.session_id == session_id)
                datasets_count = datasets_query.scalar() or 0

            return {
                "agents": agents_count,
                "workflows": workflows_count,
                "datasets": datasets_count,
                "total": agents_count + workflows_count + datasets_count,
            }

        except SQLAlchemyError as e:
            logger.error(
                "Failed to fetch resource summary for user %s (scope: %s): %s", account_id, scope, e, exc_info=True
            )
            raise

    def _get_recent_activities(
        self,
        account_id: str,
        scope: Literal["system", "my_resources"],
        limit: int = 10,
        session_id: str | None = None,
        admin_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        최근 활동 조회 - 최근 10개 리소스 생성/수정/삭제 이력

        Owner (scope=system): 전체 시스템 리소스 또는 특정 관리자의 리소스 조회 (admin_id로 필터링)
        Admin/Student (scope=my_resources): SessionResourceTag를 통해 태그된 본인 리소스만 조회

        참고: 이 스토리에서는 간단한 버전으로 구현
        Phase 1.7 모니터링 시스템 구현 후 실제 활동 로그 연동 예정

        Args:
            account_id: 사용자 ID
            scope: 데이터 범위 ("system" 또는 "my_resources")
            limit: 조회할 최대 활동 개수
            session_id: 세션 ID (Admin/Student용, None이면 모든 세션)
            admin_id: 관리자 ID (Owner 전용, 특정 관리자의 리소스만 필터링)

        Returns:
            최근 활동 리스트

        Raises:
            SQLAlchemyError: 데이터베이스 조회 실패 시
        """
        try:
            activities = []

            if scope == "system":
                if admin_id or session_id:
                    # Owner: SessionResourceTag를 사용하여 필터링 (Account JOIN으로 userName 포함)
                    recent_apps_query = (
                        db.session.query(App, SessionResourceTag, Account)
                        .join(SessionResourceTag, SessionResourceTag.resource_id == App.id)
                        .join(Account, Account.id == SessionResourceTag.account_id)
                        .filter(
                            SessionResourceTag.resource_type == "app",
                        )
                    )
                    if admin_id:
                        recent_apps_query = recent_apps_query.filter(SessionResourceTag.account_id == admin_id)
                    if session_id:
                        recent_apps_query = recent_apps_query.filter(SessionResourceTag.session_id == session_id)
                    recent_apps = recent_apps_query.order_by(SessionResourceTag.tagged_at.desc()).limit(limit).all()

                    for app, tag, account in recent_apps:
                        resource_type = "workflow" if app.mode == "workflow" else "agent"
                        activities.append(
                            {
                                "id": app.id,
                                "type": resource_type,
                                "resourceName": app.name,
                                "action": "created",
                                "timestamp": tag.tagged_at.isoformat(),
                                "status": "success",
                                "userName": account.name,
                            }
                        )

                    recent_datasets_query = (
                        db.session.query(Dataset, SessionResourceTag, Account)
                        .join(SessionResourceTag, SessionResourceTag.resource_id == Dataset.id)
                        .join(Account, Account.id == SessionResourceTag.account_id)
                        .filter(
                            SessionResourceTag.resource_type == "dataset",
                        )
                    )
                    if admin_id:
                        recent_datasets_query = recent_datasets_query.filter(SessionResourceTag.account_id == admin_id)
                    if session_id:
                        recent_datasets_query = recent_datasets_query.filter(
                            SessionResourceTag.session_id == session_id
                        )
                    recent_datasets = (
                        recent_datasets_query.order_by(SessionResourceTag.tagged_at.desc()).limit(limit).all()
                    )

                    for dataset, tag, account in recent_datasets:
                        activities.append(
                            {
                                "id": dataset.id,
                                "type": "dataset",
                                "resourceName": dataset.name,
                                "action": "created",
                                "timestamp": tag.tagged_at.isoformat(),
                                "status": "success",
                                "userName": account.name,
                            }
                        )
                else:
                    # Owner: 전체 시스템 리소스 조회 (created_at 기준, Account JOIN으로 userName 포함)
                    recent_apps = (
                        db.session.query(App, Account)
                        .outerjoin(Account, Account.id == App.created_by)
                        .order_by(App.created_at.desc())
                        .limit(limit)
                        .all()
                    )

                    for app, account in recent_apps:
                        resource_type = "workflow" if app.mode == "workflow" else "agent"
                        activities.append(
                            {
                                "id": app.id,
                                "type": resource_type,
                                "resourceName": app.name,
                                "action": "created",
                                "timestamp": app.created_at.isoformat(),
                                "status": "success",
                                "userName": account.name if account else None,
                            }
                        )

                    recent_datasets = (
                        db.session.query(Dataset, Account)
                        .outerjoin(Account, Account.id == Dataset.created_by)
                        .order_by(Dataset.created_at.desc())
                        .limit(limit)
                        .all()
                    )

                    for dataset, account in recent_datasets:
                        activities.append(
                            {
                                "id": dataset.id,
                                "type": "dataset",
                                "resourceName": dataset.name,
                                "action": "created",
                                "timestamp": dataset.created_at.isoformat(),
                                "status": "success",
                                "userName": account.name if account else None,
                            }
                        )

            else:
                # Admin/Student: SessionResourceTag를 통해 태그된 리소스만 조회 (Account JOIN으로 userName 포함)
                # 최근 Agent 생성 이력 (SessionResourceTag와 JOIN)
                agents_query = (
                    db.session.query(App, SessionResourceTag, Account)
                    .join(SessionResourceTag, SessionResourceTag.resource_id == App.id)
                    .join(Account, Account.id == SessionResourceTag.account_id)
                    .filter(
                        SessionResourceTag.account_id == account_id,
                        SessionResourceTag.resource_type == "app",
                    )
                )
                if session_id:
                    agents_query = agents_query.filter(SessionResourceTag.session_id == session_id)
                recent_agents = agents_query.order_by(SessionResourceTag.tagged_at.desc()).limit(limit).all()

                for app, tag, account in recent_agents:
                    # App.mode로 agent와 workflow 구분
                    resource_type = "workflow" if app.mode == "workflow" else "agent"
                    activities.append(
                        {
                            "id": app.id,
                            "type": resource_type,
                            "resourceName": app.name,
                            "action": "created",
                            "timestamp": tag.tagged_at.isoformat(),
                            "status": "success",
                            "userName": account.name,
                        }
                    )

                # 최근 Dataset 생성 이력 (SessionResourceTag와 JOIN)
                datasets_query = (
                    db.session.query(Dataset, SessionResourceTag, Account)
                    .join(SessionResourceTag, SessionResourceTag.resource_id == Dataset.id)
                    .join(Account, Account.id == SessionResourceTag.account_id)
                    .filter(
                        SessionResourceTag.account_id == account_id,
                        SessionResourceTag.resource_type == "dataset",
                    )
                )
                if session_id:
                    datasets_query = datasets_query.filter(SessionResourceTag.session_id == session_id)
                recent_datasets = datasets_query.order_by(SessionResourceTag.tagged_at.desc()).limit(limit).all()

                for dataset, tag, account in recent_datasets:
                    activities.append(
                        {
                            "id": dataset.id,
                            "type": "dataset",
                            "resourceName": dataset.name,
                            "action": "created",
                            "timestamp": tag.tagged_at.isoformat(),
                            "status": "success",
                            "userName": account.name,
                        }
                    )

            # 타임스탬프 기준으로 정렬하여 최근 10개만 반환
            activities.sort(key=itemgetter("timestamp"), reverse=True)
            return activities[:limit]

        except SQLAlchemyError as e:
            logger.error(
                "Failed to fetch recent activities for user %s (scope: %s): %s", account_id, scope, e, exc_info=True
            )
            raise

    def _get_api_usage(
        self,
        account_id: str,
        session_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """
        API 사용량 조회 - llm_usage_logs 테이블에서 실제 데이터 집계

        llm_usage_logs 테이블은 Message/Conversation 삭제와 독립적으로 유지되므로
        대화를 삭제해도 API 사용량 기록은 보존됨.

        세션이 지정된 경우:
        - SessionResourceTag를 통해 해당 세션에 태그된 App의 사용량만 집계

        세션이 없는 경우 (Owner 전체 조회):
        - 전체 사용량 집계

        Args:
            account_id: 사용자 ID
            session_id: 세션 ID (None이면 전체 집계)
            days: 조회 기간 (기본 7일)

        Returns:
            API 사용량 딕셔너리 (ApiUsageSummary.to_dict() 형식)
        """
        try:
            end_date = date.today()
            start_date = end_date - timedelta(days=days - 1)
            start_datetime = datetime.combine(start_date, datetime.min.time())

            # 기본 쿼리: llm_usage_logs 테이블에서 일별 집계
            if session_id:
                # 세션별 필터링: LlmUsageLog.session_id로 직접 필터링 (App/SessionResourceTag 삭제되어도 유지)
                daily_query = (
                    db.session.query(
                        cast(LlmUsageLog.created_at, Date).label("date"),
                        func.count(LlmUsageLog.id).label("call_count"),
                        func.coalesce(func.sum(LlmUsageLog.input_tokens), 0).label("input_tokens"),
                        func.coalesce(func.sum(LlmUsageLog.output_tokens), 0).label("output_tokens"),
                        func.coalesce(func.sum(LlmUsageLog.total_price), Decimal(0)).label("total_cost"),
                    )
                    .filter(
                        LlmUsageLog.session_id == session_id,
                        LlmUsageLog.created_at >= start_datetime,
                    )
                    .group_by(cast(LlmUsageLog.created_at, Date))
                    .order_by(cast(LlmUsageLog.created_at, Date))
                )
            else:
                # 전체 집계 (Owner 전체 조회)
                daily_query = (
                    db.session.query(
                        cast(LlmUsageLog.created_at, Date).label("date"),
                        func.count(LlmUsageLog.id).label("call_count"),
                        func.coalesce(func.sum(LlmUsageLog.input_tokens), 0).label("input_tokens"),
                        func.coalesce(func.sum(LlmUsageLog.output_tokens), 0).label("output_tokens"),
                        func.coalesce(func.sum(LlmUsageLog.total_price), Decimal(0)).label("total_cost"),
                    )
                    .filter(LlmUsageLog.created_at >= start_datetime)
                    .group_by(cast(LlmUsageLog.created_at, Date))
                    .order_by(cast(LlmUsageLog.created_at, Date))
                )

            results = daily_query.all()

            # 결과를 DailyApiUsage 객체로 변환
            daily_usage: list[DailyApiUsage] = []
            total_calls = 0
            total_tokens = 0
            total_cost = Decimal(0)

            # 날짜별 데이터 맵 생성 (빈 날짜 채우기용)
            date_map: dict[date, DailyApiUsage] = {}
            for row in results:
                row_date = row.date
                input_tokens = int(row.input_tokens)
                output_tokens = int(row.output_tokens)
                call_count = int(row.call_count)
                cost = Decimal(str(row.total_cost)) if row.total_cost else Decimal(0)

                date_map[row_date] = DailyApiUsage(
                    date=row_date,
                    call_count=call_count,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    estimated_cost=cost,
                )

                total_calls += call_count
                total_tokens += input_tokens + output_tokens
                total_cost += cost

            # 빈 날짜 채우기 (7일 전체)
            current_date = start_date
            while current_date <= end_date:
                if current_date in date_map:
                    daily_usage.append(date_map[current_date])
                else:
                    daily_usage.append(
                        DailyApiUsage(
                            date=current_date,
                            call_count=0,
                            input_tokens=0,
                            output_tokens=0,
                            total_tokens=0,
                            estimated_cost=Decimal(0),
                        )
                    )
                current_date += timedelta(days=1)

            summary = ApiUsageSummary(
                total_calls=total_calls,
                total_tokens=total_tokens,
                estimated_cost=total_cost,
                daily_usage=daily_usage,
            )

            logger.info(
                "API usage fetched for session=%s: calls=%d, tokens=%d, cost=%.4f",
                session_id or "all",
                total_calls,
                total_tokens,
                float(total_cost),
            )

            return summary.to_dict()

        except SQLAlchemyError as e:
            logger.error(
                "Failed to fetch API usage for session %s: %s",
                session_id or "all",
                e,
                exc_info=True,
            )
            # 에러 시 빈 데이터 반환 (대시보드 렌더링 실패 방지)
            return ApiUsageSummary(
                total_calls=0,
                total_tokens=0,
                estimated_cost=Decimal(0),
                daily_usage=[],
            ).to_dict()
