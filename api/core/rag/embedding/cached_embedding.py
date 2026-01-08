import base64
import logging
from typing import Any, cast

import numpy as np
from sqlalchemy.exc import IntegrityError

from configs import dify_config
from core.entities.embedding_type import EmbeddingInputType
from core.model_manager import ModelInstance
from core.model_runtime.entities.model_entities import ModelPropertyKey
from core.model_runtime.model_providers.__base.text_embedding_model import TextEmbeddingModel
from core.rag.embedding.embedding_base import Embeddings
from extensions.ext_database import db
from extensions.ext_redis import redis_client
from libs import helper
from models.dataset import Embedding

logger = logging.getLogger(__name__)


class CacheEmbedding(Embeddings):
    def __init__(
        self,
        model_instance: ModelInstance,
        user: str | None = None,
        # Optional context for usage tracking
        tenant_id: str | None = None,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        invoke_source: str | None = None,
    ):
        self._model_instance = model_instance
        self._user = user
        # Usage tracking context (optional)
        self._tenant_id = tenant_id
        self._app_id = app_id
        self._app_name = app_name
        self._account_id = account_id
        self._session_id = session_id
        self._invoke_source = invoke_source

    def _record_embedding_usage(self, input_tokens: int) -> None:
        """Record embedding usage if context is available."""
        # Only require tenant_id; app_id is optional (may not exist during indexing)
        if not self._tenant_id:
            logger.warning("Skipping embedding usage - no tenant_id")
            return

        try:
            from models.model import App
            from services.api_usage_tracking_service import ApiUsageTrackingService

            # Get session_id from app_id if not provided
            session_id = self._session_id
            if not session_id and self._app_id:
                session_id = ApiUsageTrackingService.get_session_id_for_app(
                    db.session,
                    self._app_id,
                )

            # Get app_name from app_id if not provided
            app_name = self._app_name
            if not app_name and self._app_id:
                app = db.session.query(App).filter(App.id == self._app_id).first()
                if app:
                    app_name = app.name

            result = ApiUsageTrackingService.record_embedding_usage(
                session=db.session,
                tenant_id=self._tenant_id,
                model_provider=self._model_instance.provider,
                model_id=self._model_instance.model,
                input_tokens=input_tokens,
                app_id=self._app_id,
                app_name=app_name,
                account_id=self._account_id,
                session_id=session_id,
                invoke_source=self._invoke_source,
            )
        except Exception:
            logger.exception("Failed to record embedding usage")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed search docs in batches of 10."""
        # use doc embedding cache or store if not exists
        text_embeddings: list[Any] = [None for _ in range(len(texts))]
        embedding_queue_indices = []
        for i, text in enumerate(texts):
            hash = helper.generate_text_hash(text)
            embedding = (
                db.session.query(Embedding)
                .filter_by(
                    model_name=self._model_instance.model, hash=hash, provider_name=self._model_instance.provider
                )
                .first()
            )
            if embedding:
                text_embeddings[i] = embedding.get_embedding()
            else:
                embedding_queue_indices.append(i)

        # release database connection, because embedding may take a long time
        db.session.close()

        if embedding_queue_indices:
            embedding_queue_texts = [texts[i] for i in embedding_queue_indices]
            embedding_queue_embeddings = []
            total_tokens = 0
            try:
                model_type_instance = cast(TextEmbeddingModel, self._model_instance.model_type_instance)
                model_schema = model_type_instance.get_model_schema(
                    self._model_instance.model, self._model_instance.credentials
                )
                max_chunks = (
                    model_schema.model_properties[ModelPropertyKey.MAX_CHUNKS]
                    if model_schema and ModelPropertyKey.MAX_CHUNKS in model_schema.model_properties
                    else 1
                )
                for i in range(0, len(embedding_queue_texts), max_chunks):
                    batch_texts = embedding_queue_texts[i : i + max_chunks]

                    embedding_result = self._model_instance.invoke_text_embedding(
                        texts=batch_texts, user=self._user, input_type=EmbeddingInputType.DOCUMENT
                    )

                    # Track tokens for usage recording
                    if embedding_result.usage:
                        total_tokens += embedding_result.usage.tokens

                    for vector in embedding_result.embeddings:
                        try:
                            # FIXME: type ignore for numpy here
                            normalized_embedding = (vector / np.linalg.norm(vector)).tolist()  # type: ignore
                            # stackoverflow best way: https://stackoverflow.com/questions/20319813/how-to-check-list-containing-nan
                            if np.isnan(normalized_embedding).any():
                                # for issue #11827  float values are not json compliant
                                logger.warning("Normalized embedding is nan: %s", normalized_embedding)
                                continue
                            embedding_queue_embeddings.append(normalized_embedding)
                        except IntegrityError:
                            db.session.rollback()
                        except Exception:
                            logger.exception("Failed transform embedding")

                # Record embedding usage if context available
                if total_tokens > 0:
                    self._record_embedding_usage(total_tokens)
                elif len(embedding_queue_texts) > 0:
                    # Some models don't report token usage, estimate based on text length
                    estimated_tokens = sum(len(t) // 4 for t in embedding_queue_texts)
                    if estimated_tokens > 0:
                        self._record_embedding_usage(estimated_tokens)

                cache_embeddings = []
                try:
                    for i, n_embedding in zip(embedding_queue_indices, embedding_queue_embeddings):
                        text_embeddings[i] = n_embedding
                        hash = helper.generate_text_hash(texts[i])
                        if hash not in cache_embeddings:
                            embedding_cache = Embedding(
                                model_name=self._model_instance.model,
                                hash=hash,
                                provider_name=self._model_instance.provider,
                            )
                            embedding_cache.set_embedding(n_embedding)
                            db.session.add(embedding_cache)
                            cache_embeddings.append(hash)
                    db.session.commit()
                except IntegrityError:
                    db.session.rollback()
            except Exception as ex:
                db.session.rollback()
                logger.exception("Failed to embed documents")
                raise ex

        return text_embeddings

    def embed_query(self, text: str) -> list[float]:
        """Embed query text."""
        # use doc embedding cache or store if not exists
        hash = helper.generate_text_hash(text)
        embedding_cache_key = f"{self._model_instance.provider}_{self._model_instance.model}_{hash}"
        embedding = redis_client.get(embedding_cache_key)
        if embedding:
            redis_client.expire(embedding_cache_key, 600)
            decoded_embedding = np.frombuffer(base64.b64decode(embedding), dtype="float")
            return [float(x) for x in decoded_embedding]
        try:
            embedding_result = self._model_instance.invoke_text_embedding(
                texts=[text], user=self._user, input_type=EmbeddingInputType.QUERY
            )

            # Record embedding usage if context available
            if embedding_result.usage and embedding_result.usage.tokens > 0:
                self._record_embedding_usage(embedding_result.usage.tokens)

            embedding_results = embedding_result.embeddings[0]
            # FIXME: type ignore for numpy here
            embedding_results = (embedding_results / np.linalg.norm(embedding_results)).tolist()  # type: ignore
            if np.isnan(embedding_results).any():
                raise ValueError("Normalized embedding is nan please try again")
        except Exception as ex:
            if dify_config.DEBUG:
                logger.exception("Failed to embed query text '%s...(%s chars)'", text[:10], len(text))
            raise ex

        try:
            # encode embedding to base64
            embedding_vector = np.array(embedding_results)
            vector_bytes = embedding_vector.tobytes()
            # Transform to Base64
            encoded_vector = base64.b64encode(vector_bytes)
            # Transform to string
            encoded_str = encoded_vector.decode("utf-8")
            redis_client.setex(embedding_cache_key, 600, encoded_str)
        except Exception as ex:
            if dify_config.DEBUG:
                logger.exception(
                    "Failed to add embedding to redis for the text '%s...(%s chars)'", text[:10], len(text)
                )
            raise ex

        return embedding_results  # type: ignore
