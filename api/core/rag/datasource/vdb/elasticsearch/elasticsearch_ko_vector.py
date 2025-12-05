import json
import logging
from typing import Any

from flask import current_app

from core.rag.datasource.vdb.elasticsearch.elasticsearch_vector import (
    ElasticSearchConfig,
    ElasticSearchVector,
    ElasticSearchVectorFactory,
)
from core.rag.datasource.vdb.field import Field
from core.rag.datasource.vdb.vector_type import VectorType
from core.rag.embedding.embedding_base import Embeddings
from extensions.ext_redis import redis_client
from models.dataset import Dataset

logger = logging.getLogger(__name__)


class ElasticSearchKoVector(ElasticSearchVector):
    """
    Elasticsearch vector store with Korean language support using Nori tokenizer.

    Nori tokenizer provides morphological analysis for Korean text:
    - "침묵을 지키다" → ["침묵", "지키다"]
    - "학습하다" → ["학습", "하다"]
    - "인공지능" → ["인공", "지능"] or ["인공지능"] depending on settings

    This enables proper full-text search for Korean documents.
    """

    def create_collection(
        self,
        embeddings: list[list[float]],
        metadatas: list[dict[Any, Any]] | None = None,
        index_params: dict | None = None,
    ):
        lock_name = f"vector_indexing_lock_{self._collection_name}"
        with redis_client.lock(lock_name, timeout=20):
            collection_exist_cache_key = f"vector_indexing_{self._collection_name}"
            if redis_client.get(collection_exist_cache_key):
                logger.info("Collection %s already exists.", self._collection_name)
                return

            if not self._client.indices.exists(index=self._collection_name):
                dim = len(embeddings[0])
                settings = {
                    "analysis": {
                        "analyzer": {
                            "ko_analyzer": {
                                "type": "custom",
                                "tokenizer": "nori_tokenizer",
                                "filter": [
                                    "nori_readingform",
                                    "nori_part_of_speech",
                                    "lowercase",
                                ],
                            }
                        },
                        "tokenizer": {
                            "nori_tokenizer": {
                                "type": "nori_tokenizer",
                                "decompound_mode": "mixed",
                            }
                        },
                        "filter": {
                            "nori_part_of_speech": {
                                "type": "nori_part_of_speech",
                                "stoptags": [
                                    "E",  # Verbal endings
                                    "J",  # Particles (조사)
                                    "IC",  # Interjection
                                    "MAJ",  # Conjunctive adverb
                                    "SP",  # Space
                                    "SSC",  # Closing bracket
                                    "SSO",  # Opening bracket
                                    "SC",  # Separator
                                    "SE",  # Ellipsis
                                    "SF",  # Terminal punctuation
                                    "XPN",  # Prefix
                                    "XSA",  # Adjective suffix
                                    "XSN",  # Noun suffix
                                    "XSV",  # Verb suffix
                                ],
                            }
                        },
                    }
                }
                mappings = {
                    "properties": {
                        Field.CONTENT_KEY.value: {
                            "type": "text",
                            "analyzer": "ko_analyzer",
                            "search_analyzer": "ko_analyzer",
                        },
                        Field.VECTOR.value: {
                            "type": "dense_vector",
                            "dims": dim,
                            "index": True,
                            "similarity": "cosine",
                        },
                        Field.METADATA_KEY.value: {
                            "type": "object",
                            "properties": {"doc_id": {"type": "keyword"}},
                        },
                    }
                }
                self._client.indices.create(index=self._collection_name, settings=settings, mappings=mappings)

            redis_client.set(collection_exist_cache_key, 1, ex=3600)


class ElasticSearchKoVectorFactory(ElasticSearchVectorFactory):
    def init_vector(self, dataset: Dataset, attributes: list, embeddings: Embeddings) -> ElasticSearchKoVector:
        if dataset.index_struct_dict:
            class_prefix: str = dataset.index_struct_dict["vector_store"]["class_prefix"]
            collection_name = class_prefix
        else:
            dataset_id = dataset.id
            collection_name = Dataset.gen_collection_name_by_id(dataset_id)
            dataset.index_struct = json.dumps(self.gen_index_struct_dict(VectorType.ELASTICSEARCH_KO, collection_name))

        config = current_app.config
        return ElasticSearchKoVector(
            index_name=collection_name,
            config=ElasticSearchConfig(
                host=config.get("ELASTICSEARCH_HOST", "localhost"),
                port=config.get("ELASTICSEARCH_PORT", 9200),
                username=config.get("ELASTICSEARCH_USERNAME", ""),
                password=config.get("ELASTICSEARCH_PASSWORD", ""),
            ),
            attributes=[],
        )
