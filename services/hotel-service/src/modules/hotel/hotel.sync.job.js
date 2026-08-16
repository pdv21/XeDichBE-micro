const hotelRepository = require("./hotel.repository");
const locationRepository = require("../location/location.repository");
const { syncLocations } = require("../location/location.sync");

const MAX_HOTELS_PER_CITY = Number(process.env.HOTEL_SYNC_MAX_PER_CITY) || 1000;

const mapHotelToRow = (h, location) => ({
  hotel_id: h.id,
  location_id: location.id,
  name: h.name || null,
  address: h.address || null,
  country_code: (h.country || location.country_code || "").toUpperCase() || null,
  city_name: h.city || location.city_name || null,
  latitude: h.latitude ?? null,
  longitude: h.longitude ?? null,
  star_rating: h.stars ?? null,
  review_score: h.rating ?? null,
  review_count: h.reviewCount ?? null,
  currency: h.currency || null,
  chain: h.chain || null,
  main_photo: h.main_photo || null,
  thumbnail: h.thumbnail || null,
  facility_ids: h.facilityIds ?? [],
});

const syncCity = async (location) => {
  console.log(`[HotelSync] Bắt đầu crawl: ${location.city_name} (${location.city_code})`);

  try {
    const hotels = await hotelRepository.fetchCityHotelsFromApi(
      location.country_code,
      location.city_name,
      MAX_HOTELS_PER_CITY
    );

    if (!hotels || hotels.length === 0) {
      console.warn(`[HotelSync] Không có dữ liệu cho: ${location.city_name}`);
      return { city: location.city_code, success: false, count: 0 };
    }

    const rows = hotels
      .filter((h) => h.id)
      .map((h) => mapHotelToRow(h, location));

    const count = await hotelRepository.bulkUpsertHotels(rows);
    console.log(`[HotelSync] Hoàn thành ${location.city_name}: ${count} khách sạn`);
    return { city: location.city_code, success: true, count };
  } catch (error) {
    console.error(`[HotelSync] Lỗi khi crawl ${location.city_name}:`, error.message);
    return { city: location.city_code, success: false, count: 0, error: error.message };
  }
};

// Đồng bộ locations từ recommendation-service TRƯỚC khi crawl — đảm bảo dùng
// danh sách thành phố mới nhất (xem README-split.md, nguyên tắc #2).
const syncAllCities = async () => {
  await syncLocations();
  const locations = await locationRepository.getAll();
  console.log(`[HotelSync] Bắt đầu crawl ${locations.length} thành phố lúc ${new Date().toISOString()}`);

  const results = [];
  for (const location of locations) {
    results.push(await syncCity(location));
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);
  console.log(`[HotelSync] Kết quả: ${succeeded}/${locations.length} thành phố thành công`);
  if (failed.length > 0) {
    console.warn(`[HotelSync] Thất bại:`, failed.map((r) => r.city).join(", "));
  }

  return results;
};

module.exports = { syncAllCities, syncCity };
