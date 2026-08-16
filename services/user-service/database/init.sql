-- ========================================================
-- user-service — DB riêng (xedich_user_db)
-- Sở hữu: users, user_preferences (tách từ Backend/database/init.sql gốc,
-- xem Backend/services/README-split.md để biết bảng nào thuộc service nào).
-- ========================================================
CREATE DATABASE IF NOT EXISTS xedich_user_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xedich_user_db;

SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255),
  avatar      VARCHAR(255),
  provider    ENUM('local', 'google') DEFAULT 'local',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sở thích du lịch — 1 dòng/user, dùng bởi recommendation-service (Scoring)
-- qua GET /internal/users/:id/preferences. 4 trọng số w_* phải cộng lại = 1.0,
-- validate ở tầng service (không phải DB constraint).
CREATE TABLE IF NOT EXISTS user_preferences (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL UNIQUE,
  interests    JSON,
  pace         ENUM('relaxed','moderate','packed') DEFAULT 'moderate',
  w_price      DECIMAL(3,2) DEFAULT 0.35,
  w_rating     DECIMAL(3,2) DEFAULT 0.25,
  w_distance   DECIMAL(3,2) DEFAULT 0.25,
  w_preference DECIMAL(3,2) DEFAULT 0.15,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_prefs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
