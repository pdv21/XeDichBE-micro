const db = require("../../config/database");

// Bản sao chỉ đọc của bảng `locations` (nguồn thật: recommendation-service).
// upsertAll được gọi bởi location.sync.js — KHÔNG có route ghi public.

const findByCityName = async (countryCode, cityName) => {
  const [rows] = await db.execute(
    `SELECT id, city_code, city_name, country_code FROM locations
     WHERE country_code = ? AND LOWER(city_name) = LOWER(?)
     LIMIT 1`,
    [countryCode, cityName]
  );
  return rows[0] ?? null;
};

const getAll = async () => {
  const [rows] = await db.execute(
    `SELECT id, city_code, city_name, country_code, latitude, longitude, crawl_radius_m, airport_code
     FROM locations`
  );
  return rows;
};

const upsertAll = async (locations) => {
  if (!locations || locations.length === 0) return 0;

  for (const l of locations) {
    await db.execute(
      `INSERT INTO locations (id, city_code, city_name, country_code, latitude, longitude, crawl_radius_m, airport_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         city_name = VALUES(city_name), country_code = VALUES(country_code),
         latitude = VALUES(latitude), longitude = VALUES(longitude),
         crawl_radius_m = VALUES(crawl_radius_m), airport_code = VALUES(airport_code),
         synced_at = NOW()`,
      [l.id, l.city_code, l.city_name, l.country_code, l.latitude, l.longitude, l.crawl_radius_m, l.airport_code]
    );
  }
  return locations.length;
};

module.exports = { findByCityName, getAll, upsertAll };
