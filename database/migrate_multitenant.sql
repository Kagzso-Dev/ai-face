-- ─── Multi-tenant migration for existing single-tenant databases ──────────────
-- Run ONCE on existing databases: mysql -u root -p attendance_system < database/migrate_multitenant.sql
-- Safe to run multiple times (uses IF NOT EXISTS / IGNORE patterns)

USE attendance_system;

-- Step 1: Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  admin_pass  VARCHAR(255) NOT NULL DEFAULT 'admin123',
  user_pass   VARCHAR(255) NOT NULL DEFAULT '1234',
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Step 2: Seed default tenant (existing data belongs to this)
INSERT IGNORE INTO tenants (id, name, slug, admin_pass, user_pass)
VALUES (1, 'Default Organization', 'default', 'admin123', '1234');

-- Step 3: Add tenant_id to users (if not exists)
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tenant_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id',
  'SELECT "tenant_id already exists on users" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: Add tenant_id to attendance (if not exists)
SET @col_exists2 = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'tenant_id'
);
SET @sql2 = IF(@col_exists2 = 0,
  'ALTER TABLE attendance ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 AFTER id',
  'SELECT "tenant_id already exists on attendance" AS info'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Step 5: Add FK from users.tenant_id → tenants.id (if not exists)
SET @fk_users = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_tenant'
);
SET @sql3 = IF(@fk_users = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT "FK fk_users_tenant already exists" AS info'
);
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- Step 6: Add FK from attendance.tenant_id → tenants.id (if not exists)
SET @fk_att = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND CONSTRAINT_NAME = 'fk_att_tenant'
);
SET @sql4 = IF(@fk_att = 0,
  'ALTER TABLE attendance ADD CONSTRAINT fk_att_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT "FK fk_att_tenant already exists" AS info'
);
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

-- Step 7: Drop old global UNIQUE on employee_id, add per-tenant unique
SET @old_uq = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'employee_id'
);
SET @sql5 = IF(@old_uq > 0,
  'ALTER TABLE users DROP INDEX employee_id',
  'SELECT "global employee_id index already removed" AS info'
);
PREPARE stmt5 FROM @sql5; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

SET @new_uq = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'uq_tenant_emp'
);
SET @sql6 = IF(@new_uq = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_tenant_emp (tenant_id, employee_id)',
  'SELECT "uq_tenant_emp already exists" AS info'
);
PREPARE stmt6 FROM @sql6; EXECUTE stmt6; DEALLOCATE PREPARE stmt6;

-- Step 8: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_att_tenant_date ON attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_users_tenant    ON users(tenant_id);

SELECT 'Migration complete. Existing data assigned to tenant_id=1 (Default Organization).' AS message;
