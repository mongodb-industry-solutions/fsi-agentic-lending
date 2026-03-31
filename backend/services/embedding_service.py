"""Voyage AI embedding service using voyage-multimodal-3.5."""
import os
import logging
import voyageai

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


def embed_image(image, input_type: str = "document") -> list[float]:
    """Embed a PIL Image (for future multimodal PDF page embedding).

    Args:
        image: PIL.Image.Image object
        input_type: "document" for indexing, "query" for search
    """
    client = _get_client()
    result = client.multimodal_embed(
        inputs=[[image]],
        model=MODEL,
        input_type=input_type,
        truncation=True,
    )
    return result.embeddings[0]
