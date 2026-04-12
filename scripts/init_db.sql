-- GeoVision SaaS — PostgreSQL Schema
-- Run: psql -U postgres -d satellite_saas -f init_db.sql

-- Drop existing tables for clean re-initialization
DROP TABLE IF EXISTS compliance;
DROP TABLE IF EXISTS change_detection;
DROP TABLE IF EXISTS indices;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS projects;

CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    aoi_geojson JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS images (
    id           SERIAL PRIMARY KEY,
    project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    type         VARCHAR(4) NOT NULL CHECK (type IN ('t1','t2')),
    source       VARCHAR(50) NOT NULL DEFAULT 's2dr3',
    date         DATE NOT NULL,
    tci_png_path TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);

CREATE TABLE IF NOT EXISTS indices (
    id          SERIAL PRIMARY KEY,
    image_id    INTEGER REFERENCES images(id) ON DELETE CASCADE,
    index_type  VARCHAR(10) NOT NULL,
    image_path  TEXT,
    mean_value  DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_indices_image ON indices(image_id);

CREATE TABLE IF NOT EXISTS change_detection (
    id           SERIAL PRIMARY KEY,
    project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    t1_image_id  INTEGER REFERENCES images(id),
    t2_image_id  INTEGER REFERENCES images(id),
    mask_path    TEXT,
    confidence   DOUBLE PRECISION,
    change_percentage DOUBLE PRECISION,
    area_m2      DOUBLE PRECISION,
    area_km2      DOUBLE PRECISION,
    area_hectares DOUBLE PRECISION,
    ai_summary   JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    rule_name   VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(20) DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

\echo 'Schema initialized successfully.'
