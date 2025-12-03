"""Abstract interface for document loader implementations."""

import contextlib
import logging
from collections.abc import Iterator

from core.rag.extractor.blob.blob import Blob
from core.rag.extractor.extractor_base import BaseExtractor
from core.rag.models.document import Document
from extensions.ext_storage import storage

logger = logging.getLogger(__name__)


class PdfExtractor(BaseExtractor):
    """Load pdf files.


    Args:
        file_path: Path to the file to load.
    """

    def __init__(self, file_path: str, file_cache_key: str | None = None):
        """Initialize with file path."""
        self._file_path = file_path
        self._file_cache_key = file_cache_key

    def extract(self) -> list[Document]:
        plaintext_file_exists = False
        if self._file_cache_key:
            with contextlib.suppress(FileNotFoundError):
                text = storage.load(self._file_cache_key).decode("utf-8")
                plaintext_file_exists = True
                return [Document(page_content=text)]
        documents = list(self.load())
        text_list = []
        for document in documents:
            text_list.append(document.page_content)
        text = "\n\n".join(text_list)

        # save plaintext file for caching
        if not plaintext_file_exists and self._file_cache_key:
            storage.save(self._file_cache_key, text.encode("utf-8"))

        return documents

    def load(
        self,
    ) -> Iterator[Document]:
        """Lazy load given path as pages."""
        blob = Blob.from_path(self._file_path)
        yield from self.parse(blob)

    def parse(self, blob: Blob) -> Iterator[Document]:
        """Lazily parse the blob."""
        import pypdfium2  # type: ignore

        pdf_reader = None
        try:
            with blob.as_bytes_io() as file_path:
                pdf_reader = pypdfium2.PdfDocument(file_path, autoclose=True)
                for page_number, page in enumerate(pdf_reader):
                    try:
                        text_page = page.get_textpage()
                        content = text_page.get_text_range()
                        text_page.close()
                        page.close()
                        metadata = {"source": blob.source, "page": page_number}
                        yield Document(page_content=content, metadata=metadata)
                    except Exception:
                        logger.warning("Failed to extract page %d from %s", page_number, blob.source, exc_info=True)
                        page.close()
                        continue
        except pypdfium2.PdfiumError as e:
            logger.exception("Failed to load PDF document %s", blob.source)
            raise ValueError(f"Failed to parse PDF file: {e}") from e
        except Exception as e:
            logger.exception("Unexpected error parsing PDF %s", blob.source)
            raise ValueError(f"Unexpected error parsing PDF file: {e}") from e
        finally:
            if pdf_reader is not None:
                try:
                    pdf_reader.close()
                except Exception:
                    logger.warning("Failed to close PDF reader for %s", blob.source, exc_info=True)
