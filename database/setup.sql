-- ─── attendance_system database setup (multi-tenant) ─────────────────────────
-- Run once: mysql -u root -p < database/setup.sql

CREATE DATABASE IF NOT EXISTS attendance_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE attendance_system;

-- ─── tenants ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. "acme-corp"
  admin_pass  VARCHAR(255) NOT NULL DEFAULT 'admin123',
  user_pass   VARCHAR(255) NOT NULL DEFAULT '1234',
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT          NOT NULL,
  name          VARCHAR(100) NOT NULL,
  employee_id   VARCHAR(50)  NOT NULL,
  department    VARCHAR(100) DEFAULT '',
  face_encoding LONGTEXT     NOT NULL,       -- JSON array of 128 floats
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_emp (tenant_id, employee_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── attendance_windows ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_windows (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT          NOT NULL,
  label        VARCHAR(50)  NOT NULL,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  enabled      BOOLEAN      DEFAULT TRUE,
  late_absent  BOOLEAN      DEFAULT FALSE,
  late_cutoff  TIME         DEFAULT NULL,  -- attendance after this time = 'late'
  window_type  VARCHAR(10)  NOT NULL DEFAULT 'in',  -- 'in' | 'out'
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add columns to existing installations
ALTER TABLE attendance_windows ADD COLUMN IF NOT EXISTS late_cutoff TIME DEFAULT NULL;
ALTER TABLE attendance_windows ADD COLUMN IF NOT EXISTS window_type VARCHAR(10) NOT NULL DEFAULT 'in';

-- ─── attendance ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT          NOT NULL,
  user_id     INT          NOT NULL,
  name        VARCHAR(100) NOT NULL,
  date        DATE         NOT NULL,
  time        TIME         NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'present',  -- 'present' | 'late' | 'absent'
  punch_type  VARCHAR(5)   NOT NULL DEFAULT 'in',       -- 'in' | 'out'
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add punch_type to existing installations
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_type VARCHAR(5) NOT NULL DEFAULT 'in';

-- Indexes for fast daily lookups
CREATE INDEX IF NOT EXISTS idx_att_tenant_date    ON attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_att_user_id        ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_att_user_date      ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_users_tenant       ON users(tenant_id);

-- Verify
SELECT 'Setup complete.' AS message;
SHOW TABLES;
