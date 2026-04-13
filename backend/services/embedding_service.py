"""Voyage AI embedding service using voyage-multimodal-3.5."""
import math
import os
import logging
from pathlib import Path

import voyageai
from services.circuit_breaker import voyage_breaker

logger = logging.getLogger(__name__)

_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("VOYAGE_API_KEY")
        if not api_key:
            raise EnvironmentError("VOYAGE_API_KEY environment variable is required")
        _client = voyageai.Client(api_key=api_key)
    return _client

MODEL = "voyage-multimodal-3.5"
DIMENSIONS = 1024


@voyage_breaker
def embed_texts(texts: list[str], input_type: str = "document") -> list[list[float]]:
    """Embed a list of text strings via Voyage AI multimodal_embed.

    Args:
        texts: List of text strings to embed
        input_type: "document" for indexing, "query" for search queries
    Returns:
        List of embedding vectors (1024 dimensions each)
    """
    client = _get_client()
    inputs = [[text] for text in texts]
    result = client.multimodal_embed(
        inputs=inputs,
        model=MODEL,
        input_type=input_type,
        truncation=True,
    )
    logger.info(f"Embedded {len(texts)} texts ({result.total_tokens} tokens)")
    return result.embeddings


def embed_text(text: str, input_type: str = "document") -> list[float]:
    """Embed a single text string."""
    return embed_texts([text], input_type=input_type)[0]


def embed_query(query: str) -> list[float]:
    """Embed a search query (uses input_type='query' for retrieval optimization)."""
    return embed_text(query, input_type="query")


MAX_PIXELS = 16_000_000  # ~28,571 tokens at 560px/token; leaves headroom under 32K limit
DEFAULT_DPI = 200


def _render_pdf_pages(pdf_path: Path) -> list:
    """Render PDF pages as PIL Images, fitting within the Voyage pixel budget."""
    import fitz
    from PIL import Image
    import io

    with fitz.open(str(pdf_path)) as doc:
        page_count = len(doc)
        if page_count == 0:
            return []

        pixels_per_page = MAX_PIXELS // page_count
        first_page = doc[0]
        base_w, base_h = first_page.rect.width, first_page.rect.height
        base_pixels = (base_w * DEFAULT_DPI / 72) * (base_h * DEFAULT_DPI / 72)

        if base_pixels * page_count > MAX_PIXELS:
            scale = math.sqrt(pixels_per_page / base_pixels)
            dpi = max(int(DEFAULT_DPI * scale), 72)
        else:
            dpi = DEFAULT_DPI

        zoom = dpi / 72
        matrix = fitz.Matrix(zoom, zoom)
        images = []
        for page in doc:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            images.append(img)

    logger.info(
        "Rendered %d pages from %s at %d DPI (~%d pixels/page)",
        page_count, pdf_path.name, dpi,
        images[0].width * images[0].height if images else 0,
    )
    return images


def embed_document(pdf_path: Path | str) -> tuple[list[float], int]:
    """Embed a PDF by rendering its pages as images and passing them to Voyage.

    Returns:
        (embedding_vector, page_count)
    """
    pdf_path = Path(pdf_path)
    pages = _render_pdf_pages(pdf_path)
    if not pages:
        raise ValueError(f"PDF has no pages: {pdf_path}")

    client = _get_client()
    result = client.multimodal_embed(
        inputs=[pages],
        model=MODEL,
        input_type="document",
        truncation=True,
    )
    logger.info(
        "Multimodal embed for %s: %d pages, %d total tokens",
        pdf_path.name, len(pages), result.total_tokens,
    )
    return result.embeddings[0], len(pages)
