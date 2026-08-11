-- ========================================================
-- recommendation-service — DB riêng (xedich_recommendation_db)
-- Sở hữu: locations (NGUỒN THẬT — hotel-service giữ bản sao chỉ đọc),
-- places, trips, trip_activities, ai_jobs.
-- Đây là core "Travel Planning Engine" — trip/itinerary/budget/place/location
-- gộp chung 1 service vì phụ thuộc thuật toán vòng tròn (xem README-split.md):
-- budget.fitBudgetForPlanning gọi thẳng itinerary/planning.engine.js#generateItinerary.
--
-- LƯU Ý: 2 FK xuyên DB đã BỊ BỎ so với schema monolith gốc (users nay ở
-- user-service, DB khác): trips.user_id, ai_jobs.user_id KHÔNG còn FK REFERENCES
-- users(id) — chỉ còn INT thường, validate qua JWT req.user.id ở tầng ứng dụng.
-- ========================================================
CREATE DATABASE IF NOT EXISTS xedich_recommendation_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xedich_recommendation_db;

SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS locations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  city_code      VARCHAR(50)  NOT NULL UNIQUE,
  city_name      VARCHAR(150) NOT NULL,
  country_code   VARCHAR(5)   NOT NULL DEFAULT 'VN',
  latitude       DECIMAL(9,6),
  longitude      DECIMAL(9,6),
  crawl_radius_m INT DEFAULT 10000,
  airport_code   VARCHAR(5) NULL,
  is_active      TINYINT(1)   DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS places (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  xid            VARCHAR(50)  NOT NULL UNIQUE,
  location_id    INT NOT NULL,

  name           VARCHAR(255) NOT NULL,
  name_vi        VARCHAR(255) NULL,
  category       ENUM('attraction','food') NOT NULL,
  kinds          VARCHAR(500),
  address        VARCHAR(500),

  latitude       DECIMAL(9,6) NOT NULL,
  longitude      DECIMAL(9,6) NOT NULL,

  rate           TINYINT UNSIGNED DEFAULT 0,
  description    TEXT,
  description_vi TEXT NULL,
  image          VARCHAR(500),
  wikipedia      VARCHAR(500),

  visit_minutes  SMALLINT UNSIGNED DEFAULT 90,
  avg_cost       DECIMAL(12,2) NULL,

  source         ENUM('api','manual','ai_draft') DEFAULT 'api',
  is_active      TINYINT(1) DEFAULT 1,
  last_synced_at TIMESTAMP NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_places_location
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_places_location_category_rate ON places(location_id, category, rate);

CREATE TABLE IF NOT EXISTS trips (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL, -- KHÔNG còn FK tới users (khác DB/service) — validate qua JWT
  location_id  INT NOT NULL,
  title        VARCHAR(200),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  budget_total DECIMAL(12,2),
  num_people   TINYINT UNSIGNED DEFAULT 1,
  meal_cost_vnd DECIMAL(10,0) NULL,
  status       ENUM('draft','planning','planned','failed') DEFAULT 'draft',
  ai_summary   JSON NULL,
  budget_summary JSON NULL,
  itinerary_adjustments JSON NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_trips_location
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_trips_user_status ON trips(user_id, status);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  trip_id    INT NOT NULL,
  user_id    INT NOT NULL, -- KHÔNG còn FK tới users (khác DB/service)
  type       ENUM('plan_trip') DEFAULT 'plan_trip',
  status     ENUM('queued','processing','completed','failed') DEFAULT 'queued',
  error      VARCHAR(1000) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_jobs_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_activities (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  trip_id       INT NOT NULL,
  place_id      INT NOT NULL,
  day_index     TINYINT UNSIGNED NOT NULL,
  order_index   TINYINT UNSIGNED NOT NULL,
  start_time    TIME NULL,
  activity_type ENUM('visit','meal') DEFAULT 'visit',
  score         DECIMAL(5,4) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_trip_day_order (trip_id, day_index, order_index),

  CONSTRAINT fk_activities_trip
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_place
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
