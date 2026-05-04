-- ════════════════════════════════════════════
--  Health Tracker — database.sql
--  Complete MySQL schema
--  Run this in phpMyAdmin or MySQL CLI
-- ════════════════════════════════════════════

-- Step 1: Create and select the database
CREATE DATABASE IF NOT EXISTS health_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE health_tracker;

-- ────────────────────────────────────────────
--  TABLE: users
--  Stores registered user accounts
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  email      VARCHAR(255)  NOT NULL UNIQUE,
  password   VARCHAR(255)  NOT NULL,            -- bcrypt hashed
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────
--  TABLE: health_records
--  Core daily health metrics per user
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_records (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  date         DATE            NOT NULL,
  weight       DECIMAL(5,2)    NOT NULL COMMENT 'kg',
  height       DECIMAL(5,2)    NOT NULL COMMENT 'cm',
  bmi          DECIMAL(4,1)    NOT NULL COMMENT 'auto-calculated',
  steps        INT             NOT NULL DEFAULT 0,
  water_intake DECIMAL(4,2)    NOT NULL DEFAULT 0 COMMENT 'litres',
  created_at   TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────
--  TABLE: advanced_health
--  Detailed clinical & lifestyle metrics per user
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advanced_health (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  date              DATE            NOT NULL,

  -- Blood Pressure
  systolic          SMALLINT UNSIGNED  DEFAULT NULL COMMENT 'mmHg',
  diastolic         SMALLINT UNSIGNED  DEFAULT NULL COMMENT 'mmHg',

  -- Heart Rate
  heart_rate        SMALLINT UNSIGNED  DEFAULT NULL COMMENT 'bpm',

  -- Blood Sugar
  blood_sugar       DECIMAL(5,1)       DEFAULT NULL COMMENT 'mg/dL',
  sugar_type        ENUM('fasting','after_meal') DEFAULT 'fasting',

  -- Sleep
  sleep_hours       DECIMAL(3,1)       DEFAULT NULL COMMENT 'hours slept',
  sleep_quality     ENUM('poor','good','excellent') DEFAULT 'good',

  -- Nutrition
  calories          SMALLINT UNSIGNED  DEFAULT NULL COMMENT 'kcal',
  protein           DECIMAL(5,1)       DEFAULT NULL COMMENT 'grams',
  carbs             DECIMAL(5,1)       DEFAULT NULL COMMENT 'grams',
  fat               DECIMAL(5,1)       DEFAULT NULL COMMENT 'grams',

  -- Activity
  activity_type     ENUM('walking','running','cycling') DEFAULT NULL,
  activity_duration SMALLINT UNSIGNED  DEFAULT NULL COMMENT 'minutes',

  created_at        TIMESTAMP          DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP          DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_adv_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ════════════════════════════════════════════
--  SAMPLE DATA (optional — for testing)
--  Remove before production use
-- ════════════════════════════════════════════
-- INSERT INTO users (name, email, password) VALUES
--   ('Test User', 'test@example.com', '$2y$10$...'); -- use PHP hash

-- ════════════════════════════════════════════
--  DONE ✓
-- ════════════════════════════════════════════
