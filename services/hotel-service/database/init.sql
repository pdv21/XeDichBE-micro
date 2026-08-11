-- ========================================================
-- hotel-service — DB riêng (xedich_hotel_db)
-- Sở hữu: hotels (crawl LiteAPI hàng tuần), locations (BẢN SAO CHỈ ĐỌC —
-- nguồn thật là recommendation-service, đồng bộ ở đầu mỗi lần chạy cron tuần
-- qua GET /internal/locations, xem src/modules/location/location.sync.js).
-- Giữ replica cục bộ (thay vì gọi HTTP mỗi request) vì search-by-city là
-- hot path người dùng gọi trực tiếp, không nên phụ thuộc mạng nội bộ.
--
-- LƯU Ý: hotels.location_id KHÔNG còn FK REFERENCES locations(id) như schema
-- monolith gốc — locations ở đây là bản sao (không phải nguồn thật), FK ràng
-- buộc theo bản sao dễ lệch khi đồng bộ. Validate location_id hợp lệ ở tầng
-- ứng dụng (đến từ chính GET /internal/locations trả về).
-- ========================================================
CREATE DATABASE IF NOT EXISTS xedich_hotel_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xedich_hotel_db;

SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS locations (
  id             INT PRIMARY KEY, -- giữ nguyên id từ recommendation-service (khoá tham chiếu chung)
  city_code      VARCHAR(50)  NOT NULL UNIQUE,
  city_name      VARCHAR(150) NOT NULL,
  country_code   VARCHAR(5)   NOT NULL DEFAULT 'VN',
  latitude       DECIMAL(9,6),
  longitude      DECIMAL(9,6),
  crawl_radius_m INT DEFAULT 10000,
  airport_code   VARCHAR(5) NULL,
  synced_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hotels (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id       VARCHAR(50)  NOT NULL UNIQUE,
  location_id    INT NOT NULL,

  name           VARCHAR(255) NOT NULL,
  address        VARCHAR(500),
  country_code   VARCHAR(5),
  city_name      VARCHAR(150),

  latitude       DECIMAL(9,6),
  longitude      DECIMAL(9,6),

  star_rating    DECIMAL(3,1),
  review_score   DECIMAL(4,2),
  review_count   INT,

  currency       VARCHAR(10),
  chain          VARCHAR(150),
  main_photo     VARCHAR(500),
  thumbnail      VARCHAR(500),
  facility_ids   JSON,

  last_synced_at TIMESTAMP NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_hotels_location_rating ON hotels(location_id, star_rating);
