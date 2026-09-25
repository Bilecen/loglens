"""
Native embedding. FastAPI process'inin İÇİNDE çalışır, dışarıya HİÇ çağrı yapmaz.
Model bir kez (startup'ta) yüklenir, sonra bellekte kalır.
"""
from sentence_transformers import SentenceTransformer
from config import settings

_model: SentenceTransformer | None = None


def load_model() -> SentenceTransformer:
    """Startup'ta çağrılır. İlk sefer HuggingFace'ten indirir, sonra yerelden yükler."""
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.embed_model)
    return _model


def embed(text: str) -> list[float]:
    """Metni vektöre çevirir. normalize_embeddings=True -> cosine için ideal."""
    model = load_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()