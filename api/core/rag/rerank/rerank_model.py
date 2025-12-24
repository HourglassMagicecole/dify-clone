import logging

from core.model_manager import ModelInstance
from core.rag.models.document import Document
from core.rag.rerank.rerank_base import BaseRerankRunner

logger = logging.getLogger(__name__)


class RerankModelRunner(BaseRerankRunner):
    def __init__(
        self,
        rerank_model_instance: ModelInstance,
        # Optional context for usage tracking
        tenant_id: str | None = None,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
    ):
        self.rerank_model_instance = rerank_model_instance
        # Usage tracking context (optional)
        self._tenant_id = tenant_id
        self._app_id = app_id
        self._app_name = app_name
        self._account_id = account_id
        self._session_id = session_id

    def _record_rerank_usage(self, doc_count: int) -> None:
        """Record rerank usage if context is available."""
        if not self._tenant_id or not self._app_id:
            return

        try:
            from extensions.ext_database import db
            from services.api_usage_tracking_service import ApiUsageTrackingService

            ApiUsageTrackingService.record_rerank_usage(
                session=db.session,
                tenant_id=self._tenant_id,
                model_provider=self.rerank_model_instance.provider,
                model_id=self.rerank_model_instance.model,
                doc_count=doc_count,
                app_id=self._app_id,
                app_name=self._app_name,
                account_id=self._account_id,
                session_id=self._session_id,
            )
        except Exception:
            logger.exception("Failed to record rerank usage")

    def run(
        self,
        query: str,
        documents: list[Document],
        score_threshold: float | None = None,
        top_n: int | None = None,
        user: str | None = None,
    ) -> list[Document]:
        """
        Run rerank model
        :param query: search query
        :param documents: documents for reranking
        :param score_threshold: score threshold
        :param top_n: top n
        :param user: unique user id if needed
        :return:
        """
        docs = []
        doc_ids = set()
        unique_documents = []
        for document in documents:
            if (
                document.provider == "dify"
                and document.metadata is not None
                and document.metadata["doc_id"] not in doc_ids
            ):
                doc_ids.add(document.metadata["doc_id"])
                docs.append(document.page_content)
                unique_documents.append(document)
            elif document.provider == "external":
                if document not in unique_documents:
                    docs.append(document.page_content)
                    unique_documents.append(document)

        documents = unique_documents

        rerank_result = self.rerank_model_instance.invoke_rerank(
            query=query, docs=docs, score_threshold=score_threshold, top_n=top_n, user=user
        )

        # Record rerank usage if context available
        if len(docs) > 0:
            self._record_rerank_usage(len(docs))

        rerank_documents = []

        for result in rerank_result.docs:
            if score_threshold is None or result.score >= score_threshold:
                # format document
                rerank_document = Document(
                    page_content=result.text,
                    metadata=documents[result.index].metadata,
                    provider=documents[result.index].provider,
                )
                if rerank_document.metadata is not None:
                    rerank_document.metadata["score"] = result.score
                    rerank_documents.append(rerank_document)

        rerank_documents.sort(key=lambda x: x.metadata.get("score", 0.0), reverse=True)
        return rerank_documents[:top_n] if top_n else rerank_documents
