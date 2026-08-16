const db = require('../../config/database');

const getAllLocations = async () => {
  const [rows] = await db.execute(
    `SELECT id, city_code, city_name, country_code, latitude, longitude, crawl_radius_m, airport_code
     FROM locations WHERE is_active = 1`
  );
  return rows;
};

const findByCityName = async (countryCode, cityName) => {
  const [rows] = await db.execute(
    `SELECT id, city_code, city_name, country_code FROM locations
     WHERE country_code = ? AND LOWER(city_name) = LOWER(?) AND is_active = 1
     LIMIT 1`,
    [countryCode, cityName]
  );
  return rows[0] ?? null;
};

const findByCityCode = async (cityCode) => {
  const [rows] = await db.execute(
    `SELECT id, city_code, city_name, country_code FROM locations
     WHERE city_code = ? AND is_active = 1
     LIMIT 1`,
    [cityCode]
  );
  return rows[0] ?? null;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, latitude, longitude, crawl_radius_m, airport_code FROM locations WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
};

module.exports = { getAllLocations, findByCityName, findByCityCode, findById };
