"""
Dashboard Service
대시보드 데이터 조회 서비스
"""

import logging
from operator import itemgetter
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from models.dataset import Dataset
from models.education.resource_tag import SessionResourceTag
from models.engine import db
from models.model import App

logger = logging.getLogger(__name__)


class DashboardService:
    """대시보드 데이터 조회 서비스"""

    def get_user_dashboard(self, account_id: str) -> dict[str, Any]:
        """
        사용자 대시보드 데이터 조회

        Args:
            account_id: 현재 로그인한 사용자 ID

        Returns:
            대시보드 데이터 딕셔너리

        Raises:
            SQLAlchemyError: 데이터베이스 조회 실패 시
        """
        try:
            logger.info("Fetching dashboard data for user: %s", account_id)

            # 1. 리소스 요약 집계
            resource_summary = self._get_resource_summary(account_id)
            logger.debug("Resource summary: %s", resource_summary)

            # 2. 최근 활동 조회
            recent_activities = self._get_recent_activities(account_id)
            logger.debug("Recent activities count: %d", len(recent_activities))

            # 3. API 사용량 조회
            api_usage = self._get_api_usage(account_id)

            logger.info("Dashboard data fetched successfully for user: %s", account_id)
            return {"resourceSummary": resource_summary, "recentActivities": recent_activities, "apiUsage": api_usage}

        except SQLAlchemyError as e:
            logger.error("Database error while fetching dashboard data for user %s: %s", account_id, e, exc_info=True)
            raise
        except Exception as e:
            logger.error("Unexpected error while fetching dashboard data for user %s: %s", account_id, e, exc_info=True)
            raise

    def _get_resource_summary(self, account_id: str) -> dict[str, int]:
        """
        리소스 요약 집계 - Agent, Workflow, Dataset 개수
        SessionResourceTag를 통해 태그된 리소스만 집계
        App.mode를 확인하여 Agent와 Workflow 구분

        Args:
            account_id: 사용자 ID

        Returns:
            리소스 요약 딕셔너리

        Raises:
            SQLAlchemyError: 데이터베이스 조회 실패 시
        """
        try:
            # Agent 개수 (App.mode != 'workflow'인 App)
            agents_count = (
                db.session.query(func.count(SessionResourceTag.id.distinct()))
                .join(App, SessionResourceTag.resource_id == App.id)
                .filter(
                    SessionResourceTag.account_id == account_id,
                    SessionResourceTag.resource_type == "app",
                    App.mode != "workflow",
                )
                .scalar()
                or 0
            )

            # Workflow 개수 (App.mode == 'workflow'인 App)
            workflows_count = (
                db.session.query(func.count(SessionResourceTag.id.distinct()))
                .join(App, SessionResourceTag.resource_id == App.id)
                .filter(
                    SessionResourceTag.account_id == account_id,
                    SessionResourceTag.resource_type == "app",
                    App.mode == "workflow",
                )
                .scalar()
                or 0
            )

            # Dataset 개수 (SessionResourceTag를 통해 태그된 Dataset)
            datasets_count = (
                db.session.query(func.count(SessionResourceTag.id.distinct()))
                .join(Dataset, SessionResourceTag.resource_id == Dataset.id)
                .filter(
                    SessionResourceTag.account_id == account_id,
                    SessionResourceTag.resource_type == "dataset",
                )
                .scalar()
                or 0
            )

            return {
                "agents": agents_count,
                "workflows": workflows_count,
                "datasets": datasets_count,
                "total": agents_count + workflows_count + datasets_count,
            }

        except SQLAlchemyError as e:
            logger.error("Failed to fetch resource summary for user %s: %s", account_id, e, exc_info=True)
            raise

    def _get_recent_activities(self, account_id: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        최근 활동 조회 - 최근 10개 리소스 생성/수정/삭제 이력
        SessionResourceTag를 통해 태그된 리소스만 조회

        참고: 이 스토리에서는 간단한 버전으로 구현
        Phase 1.7 모니터링 시스템 구현 후 실제 활동 로그 연동 예정

        Args:
            account_id: 사용자 ID
            limit: 조회할 최대 활동 개수

        Returns:
            최근 활동 리스트

        Raises:
            SQLAlchemyError: 데이터베이스 조회 실패 시
        """
        try:
            # SessionResourceTag를 통해 태그된 리소스 조회
            activities = []

            # 최근 Agent 생성 이력 (SessionResourceTag와 JOIN)
            recent_agents = (
                db.session.query(App, SessionResourceTag)
                .join(SessionResourceTag, SessionResourceTag.resource_id == App.id)
                .filter(
                    SessionResourceTag.account_id == account_id,
                    SessionResourceTag.resource_type == "app",
                )
                .order_by(SessionResourceTag.tagged_at.desc())
                .limit(limit)
                .all()
            )

            for app, tag in recent_agents:
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
                    }
                )

            # 최근 Dataset 생성 이력 (SessionResourceTag와 JOIN)
            recent_datasets = (
                db.session.query(Dataset, SessionResourceTag)
                .join(SessionResourceTag, SessionResourceTag.resource_id == Dataset.id)
                .filter(
                    SessionResourceTag.account_id == account_id,
                    SessionResourceTag.resource_type == "dataset",
                )
                .order_by(SessionResourceTag.tagged_at.desc())
                .limit(limit)
                .all()
            )

            for dataset, tag in recent_datasets:
                activities.append(
                    {
                        "id": dataset.id,
                        "type": "dataset",
                        "resourceName": dataset.name,
                        "action": "created",
                        "timestamp": tag.tagged_at.isoformat(),
                        "status": "success",
                    }
                )

            # 타임스탬프 기준으로 정렬하여 최근 10개만 반환
            activities.sort(key=itemgetter("timestamp"), reverse=True)
            return activities[:limit]

        except SQLAlchemyError as e:
            logger.error("Failed to fetch recent activities for user %s: %s", account_id, e, exc_info=True)
            raise

    def _get_api_usage(self, account_id: str) -> dict[str, Any]:
        """
        API 사용량 조회 - 임시 구현

        참고: Phase 1.7 모니터링 시스템 구현 후 실제 데이터 연동 예정
        현재는 더미 데이터 반환

        Args:
            account_id: 사용자 ID

        Returns:
            API 사용량 딕셔너리
        """
        return {"totalCalls": 0, "totalTokens": 0, "estimatedCost": 0.0, "dailyUsage": []}
