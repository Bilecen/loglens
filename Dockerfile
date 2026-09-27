# ---- Aşama 1: frontend build (statik dosyalar) ----
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# Prod'da backend aynı origin'den sunar — "/api" prefix'i gerekmez (bkz. api.js).
ENV VITE_API_BASE=""
RUN npm run build

# ---- Aşama 2: backend + gömülü frontend ----
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

# Sonra kod (app/ paketi kökte)
COPY . .

# Build edilmiş frontend statikleri — app/main.py bunu /app/static'ten sunar.
COPY --from=frontend-build /frontend/dist ./static

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
