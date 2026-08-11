const { client, withRetry } = require("./liteapi.client");
const { getOrSet } = require("../../utils/cache");
const db = require("../../config/database");
const locationRepository = require("../location/location.repository");

const SEARCH_TTL_MS = 5 * 60 * 1000;
const DETAIL_TTL_MS = 60 * 60 * 1000;

const rowToApiShape = (row) => ({
  id: row.hotel_id,
  name: row.name,
  address: row.address,
  country: row.country_code,
  city: row.city_name,
  latitude: row.latitude != null ? Number(row.latitude) : null,
  longitude: row.longitude != null ? Number(row.longitude) : null,
  stars: row.star_rating != null ? Number(row.star_rating) : null,
  rating: row.review_score != null ? Number(row.review_score) : null,
  reviewCount: row.review_count,
  currency: row.currency,
  chain: row.chain,
  main_photo: row.main_photo,
  thumbnail: row.thumbnail,
  facilityIds: Array.isArray(row.facility_ids)
    ? row.facility_ids
    : row.facility_ids
      ? JSON.parse(row.facility_ids)
      : [],
});

const findByCity = async ({ countryCode, cityName, limit, offset }) => {
  const location = await locationRepository.findByCityName(countryCode, cityName);

  if (location) {
    const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [rows] = await db.execute(
      `SELECT * FROM hotels WHERE location_id = ?
       ORDER BY star_rating DESC, review_score DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [location.id]
    );
    if (rows.length > 0) return rows.map(rowToApiShape);
  }

  const key = `hotels:city:${countryCode}:${cityName}:${limit}:${offset}`;
  return getOrSet(key, SEARCH_TTL_MS, async () => {
    const { data } = await withRetry(() =>
      client.get("/data/hotels", { params: { countryCode, cityName, limit, offset } })
    );
    return data.data ?? [];
  });
};

const fetchCityHotelsFromApi = async (countryCode, cityName, limit) => {
  const { data } = await withRetry(() =>
    client.get("/data/hotels", { params: { countryCode, cityName, limit, offset: 0 } })
  );
  return data.data ?? [];
};

const BULK_CHUNK = 500;

const bulkUpsertHotels = async (hotels) => {
  if (!hotels || hotels.length === 0) return 0;

  for (let i = 0; i < hotels.length; i += BULK_CHUNK) {
    const chunk = hotels.slice(i, i + BULK_CHUNK);
    const placeholders = chunk
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())")
      .join(", ");
    const values = chunk.flatMap((h) => [
      h.hotel_id, h.location_id, h.name, h.address, h.country_code, h.city_name,
      h.latitude, h.longitude, h.star_rating, h.review_score, h.review_count,
      h.currency, h.chain, h.main_photo, h.thumbnail,
      JSON.stringify(h.facility_ids ?? []),
    ]);

    await db.execute(
      `INSERT INTO hotels (
         hotel_id, location_id, name, address, country_code, city_name,
         latitude, longitude, star_rating, review_score, review_count,
         currency, chain, main_photo, thumbnail, facility_ids, last_synced_at
       )
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         location_id    = VALUES(location_id),
         name           = VALUES(name),
         address        = VALUES(address),
         country_code   = VALUES(country_code),
         city_name      = VALUES(city_name),
         latitude       = VALUES(latitude),
         longitude      = VALUES(longitude),
         star_rating    = VALUES(star_rating),
         review_score   = VALUES(review_score),
         review_count   = VALUES(review_count),
         currency       = VALUES(currency),
         chain          = VALUES(chain),
         main_photo     = VALUES(main_photo),
         thumbnail      = VALUES(thumbnail),
         facility_ids   = VALUES(facility_ids),
         last_synced_at = NOW()`,
      values
    );
  }

  return hotels.length;
};

const findByIds = async (hotelIds) => {
  const key = `hotels:ids:${[...hotelIds].sort().join(",")}`;
  return getOrSet(key, SEARCH_TTL_MS, async () => {
    const { data } = await withRetry(() =>
      client.get("/data/hotels", {
        params: { hotelIds: hotelIds.join(","), limit: hotelIds.length },
      })
    );
    return data.data ?? [];
  });
};

const findById = async (hotelId) => {
  const key = `hotel:detail:${hotelId}`;
  return getOrSet(key, DETAIL_TTL_MS, async () => {
    const { data } = await withRetry(() => client.get("/data/hotel", { params: { hotelId } }));
    return data.data ?? null;
  });
};

const getRates = async (payload) => {
  const key = `rates:${JSON.stringify(payload)}`;
  return getOrSet(key, SEARCH_TTL_MS, async () => {
    const { data } = await withRetry(() => client.post("/hotels/rates", payload));
    return data.data ?? [];
  });
};

// Đọc trực tiếp bảng `hotels` (đã crawl sẵn) — dùng bởi route nội bộ
// GET /internal/hotels/:hotelId (thay cho query chéo DB `hotels` mà
// budget.service.js làm trực tiếp lúc còn chung 1 DB monolith).
const findBasicInfoById = async (hotelId) => {
  const [rows] = await db.execute(
    "SELECT name, star_rating FROM hotels WHERE hotel_id = ? LIMIT 1",
    [hotelId]
  );
  return rows[0] ?? null;
};

module.exports = {
  findByCity,
  findByIds,
  findById,
  getRates,
  fetchCityHotelsFromApi,
  bulkUpsertHotels,
  findBasicInfoById,
};
