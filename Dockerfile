FROM python:3.12-slim

# Model cache buraya iner (compose'ta volume ile kalıcı yapılır)
ENV HF_HOME=/models \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Önce bağımlılıklar (Docker layer cache'i için ayrı adım).
# CPU-only torch'u ÖNCE kur: aksi halde sentence-transformers CUDA'lı torch'u çeker
# (~3GB nvidia kütüphanesi + import'ta cuda preload). CPU sürümü hem küçük hem CPU deploy için doğru.
COPY requirements.txt .
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install --no-cache-dir -r requirements.txt

# Embedding modelini build sırasında imaja GÖM → runtime'da HF indirme YOK, offline çalışır.
# requirements'tan sonra / koddan önce: bu katman cache'lenir, kod değişince tekrar inmez.
ARG EMBED_MODEL=BAAI/bge-m3
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('$EMBED_MODEL')"

# Sonra kod (düz yapı: main.py, db.py, ... kökte)
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
