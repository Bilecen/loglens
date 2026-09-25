-- LogLens şeması
-- Postgres + pgvector. docker-compose ilk (boş) açılışta otomatik çalıştırır.

CREATE EXTENSION IF NOT EXISTS vector;

-- Her benzersiz hata bir "küme". Aynı hata tekrar geldiğinde yeni satır DEĞİL,
-- occurrence_count artar. LLM yorumu (title/summary/...) burada saklanır.
CREATE TABLE IF NOT EXISTS error_clusters (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_key          TEXT        NOT NULL UNIQUE,
    fingerprint        TEXT        NOT NULL UNIQUE,
    title              TEXT,
    summary            TEXT,
    source             TEXT,
    origin             TEXT        NOT NULL DEFAULT 'unknown',  -- mobile | web | service | unknown
    severity           TEXT        NOT NULL DEFAULT 'medium',
    embedding          vector(1024),
    occurrence_count   INTEGER     NOT NULL DEFAULT 1,
    first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_seen_version TEXT,
    last_seen_version  TEXT,
    -- CMS: hata yaşam döngüsü yönetimi
    status             TEXT        NOT NULL DEFAULT 'open',  -- open|investigating|resolved|ignored
    assignee_id        BIGINT,     -- users.id (atanan kişi), NULL = atanmamış
    note               TEXT,       -- serbest not
    -- GitHub: LLM'e beslenen kaynak kod snippet'i ve derin link (önbellek)
    source_snippet     TEXT,
    source_url         TEXT,
    -- LLM yorumu üretildi mi? (dış model erişilemezse false → kartta uyarı + yeniden yorumla)
    llm_ok             BOOLEAN NOT NULL DEFAULT true,
    template           TEXT,     -- LLM'e verilen metin (yeniden yorumlama için saklanır)
    llm_model          TEXT      -- yorumu üreten model (örn. claude-sonnet-5, gpt-4o-mini)
);

-- Kümeye düşen her tekil olay (ham mesaj + meta). Zaman serisi / drill-down için.
CREATE TABLE IF NOT EXISTS error_occurrences (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cluster_id   BIGINT      NOT NULL REFERENCES error_clusters(id) ON DELETE CASCADE,
    app_version  TEXT,
    platform     TEXT,
    raw_message  TEXT,
    seen_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh token'lar (mobil uzun oturum). Ham token değil, SHA-256 hash'i saklanır.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);

-- CMS kullanıcıları. İlk kayıt olan otomatik 'admin' olur (backend'de karar verilir).
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT        NOT NULL UNIQUE,
    name          TEXT,
    password_hash TEXT        NOT NULL,
    role          TEXT        NOT NULL DEFAULT 'developer',  -- admin | developer | po | tester
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uygulama ayarları (AI/entegrasyon anahtarları vb.) — UI'dan admin düzenler.
-- .env değerlerini RUNTIME'da geçersiz kılar; boş/eksikse .env fallback devreye girer.
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- assignee_id -> users.id (kullanıcı silinirse atama düşer)
ALTER TABLE error_clusters
    DROP CONSTRAINT IF EXISTS fk_clusters_assignee;
ALTER TABLE error_clusters
    ADD CONSTRAINT fk_clusters_assignee
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;

-- Küme "ikinci görüş"leri: birincil yorumun yanında başka AI sağlayıcılarının yorumu.
-- On-demand üretilir (kullanıcı "GPT'ye de sor" der), küme başına birden çok olabilir.
CREATE TABLE IF NOT EXISTS cluster_opinions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cluster_id BIGINT      NOT NULL REFERENCES error_clusters(id) ON DELETE CASCADE,
    provider   TEXT        NOT NULL,
    model      TEXT,
    title      TEXT, summary TEXT, severity TEXT, source TEXT, origin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opinions_cluster ON cluster_opinions (cluster_id, created_at);

-- Küme not akışı (yorum thread'i). Her not bir kullanıcıya bağlı, üzerine yazılmaz.
CREATE TABLE IF NOT EXISTS cluster_notes (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cluster_id BIGINT      NOT NULL REFERENCES error_clusters(id) ON DELETE CASCADE,
    author_id  BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_cluster ON cluster_notes (cluster_id, created_at DESC);

-- Bağlı kod repoları (GitHub). Stack trace -> kaynak kod eşlemesi için.
CREATE TABLE IF NOT EXISTS repos (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider       TEXT        NOT NULL DEFAULT 'github',  -- şimdilik github
    full_name      TEXT        NOT NULL,                   -- owner/repo
    default_branch TEXT        NOT NULL DEFAULT 'main',
    token          TEXT,                                   -- PAT (yoksa env GITHUB_TOKEN)
    path_prefix    TEXT,                                   -- stack path'i repo köküne indirger (örn. "app/src/")
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, full_name)
);

-- Inbound webhook'lar: dış servisler token'lı URL'e hata POST'lar (/ingest/hook/<token>).
CREATE TABLE IF NOT EXISTS webhooks (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           TEXT        NOT NULL,               -- insan-okur etiket (örn. "Ödeme servisi")
    token          TEXT        NOT NULL UNIQUE,        -- URL'deki gizli anahtar
    source         TEXT,                               -- log'lara yazılacak varsayılan kaynak
    active         BOOLEAN     NOT NULL DEFAULT true,
    delivery_count INTEGER     NOT NULL DEFAULT 0,     -- kaç kez tetiklendi
    last_used_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. katman: fingerprint ile tam eşleşme (unique index zaten UNIQUE'ten geliyor)
-- 2. katman: vektör benzerlik araması için ANN index (cosine)
CREATE INDEX IF NOT EXISTS idx_clusters_embedding
    ON error_clusters USING hnsw (embedding vector_cosine_ops);

-- Listeleme / sıralama için yardımcı indexler
CREATE INDEX IF NOT EXISTS idx_clusters_last_seen ON error_clusters (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_count     ON error_clusters (occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_origin    ON error_clusters (origin);
CREATE INDEX IF NOT EXISTS idx_clusters_status    ON error_clusters (status);
CREATE INDEX IF NOT EXISTS idx_occ_cluster        ON error_occurrences (cluster_id, seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_occ_seen_at        ON error_occurrences (seen_at DESC);

-- ======================= Projeler (çok-proje) =======================
-- Tek instance içinde birden fazla proje. Hatalar/repolar/webhook'lar projeye bağlı;
-- dedup (fingerprint + vektör) PROJE BAZINDA. project_members = kullanıcı görevlendirmesi.
CREATE TABLE IF NOT EXISTS projects (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT        NOT NULL,
    key        TEXT        NOT NULL UNIQUE,      -- kısa slug (örn. "mobile-app")
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id BIGINT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

ALTER TABLE error_clusters ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE repos          ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE webhooks       ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE;

-- İlk kurulum: bir varsayılan proje + mevcut veriyi ona bağla (idempotent)
INSERT INTO projects (name, key)
    SELECT 'Varsayılan Proje', 'default' WHERE NOT EXISTS (SELECT 1 FROM projects);
UPDATE error_clusters SET project_id = (SELECT id FROM projects ORDER BY id LIMIT 1) WHERE project_id IS NULL;
UPDATE repos          SET project_id = (SELECT id FROM projects ORDER BY id LIMIT 1) WHERE project_id IS NULL;
UPDATE webhooks       SET project_id = (SELECT id FROM projects ORDER BY id LIMIT 1) WHERE project_id IS NULL;
INSERT INTO project_members (project_id, user_id)
    SELECT (SELECT id FROM projects ORDER BY id LIMIT 1), id FROM users ON CONFLICT DO NOTHING;

-- fingerprint global unique -> (project_id, fingerprint); repos da proje bazında unique
ALTER TABLE error_clusters DROP CONSTRAINT IF EXISTS error_clusters_fingerprint_key;
DO $$ BEGIN
    ALTER TABLE error_clusters ADD CONSTRAINT error_clusters_project_fp_key UNIQUE (project_id, fingerprint);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
ALTER TABLE repos DROP CONSTRAINT IF EXISTS repos_provider_full_name_key;
DO $$ BEGIN
    ALTER TABLE repos ADD CONSTRAINT repos_project_provider_name_key UNIQUE (project_id, provider, full_name);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Otomatik veri kaynakları (Firebase/BigQuery). Backend zamanlanmış görevle çeker.
CREATE TABLE IF NOT EXISTS data_sources (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id       BIGINT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type             TEXT        NOT NULL,        -- crashlytics | analytics
    name             TEXT        NOT NULL,
    bq_project       TEXT        NOT NULL,
    bq_table         TEXT,                        -- crashlytics: dataset.table
    ga_dataset       TEXT,                        -- analytics: analytics_<id>
    event_pattern    TEXT,
    credentials_json TEXT,                        -- service account JSON (gizli)
    enabled          BOOLEAN     NOT NULL DEFAULT true,
    interval_minutes INTEGER     NOT NULL DEFAULT 5,
    watermark        TEXT,
    last_run_at      TIMESTAMPTZ,
    last_status      TEXT,
    last_error       TEXT,
    last_count       INTEGER     DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clusters_project ON error_clusters (project_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks (project_id);
CREATE INDEX IF NOT EXISTS idx_repos_project    ON repos (project_id);

-- ======================= Bildirimler (in-app inbox) =======================
-- Her alıcı için AYRI satır (okundu durumu kişiye özel). Push gelmese de kullanıcı
-- uygulama içinden görür; polling ile çekilir, ileride push relay bunu tetikler.
CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT        NOT NULL,              -- new_error | assigned
    title      TEXT        NOT NULL,
    body       TEXT,
    cluster_id BIGINT      REFERENCES error_clusters(id) ON DELETE CASCADE,
    project_id BIGINT      REFERENCES projects(id) ON DELETE CASCADE,
    is_read    BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, is_read, created_at DESC);

-- ======================= Presence + ekip sohbeti =======================
ALTER TABLE users ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL DEFAULT 'available';  -- available|away|busy
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;  -- profil fotoğrafı (data-URI base64)

CREATE TABLE IF NOT EXISTS messages (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);
