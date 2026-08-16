const { createServiceClient } = require("@xedich/shared");

// hotel-service không auth cho các route /hotels/* (public y hệt lúc còn
// monolith) — client này gọi thẳng route public, không cần internal key.
const client = createServiceClient(process.env.HOTEL_SERVICE_URL, { timeoutMs: 15_000 });

// Thay cho require("hotel_liteapi/hotel.service").getRates trực tiếp —
// dùng bởi budget.service.js#getHotelOptionsForTrip.
const getRates = async (payload) => {
  const { data } = await client.post("/hotels/rates", payload);
  return { total: data.meta?.total ?? data.data.length, rates: data.data };
};

// Thay cho query trực tiếp bảng `hotels` (SELECT name, star_rating WHERE
// hotel_id = ?) trong budget.service.js#buildPlanBudgetSummary lúc còn cùng DB
// — giờ đọc qua route nội bộ của hotel-service (DB riêng).
const getHotelBasicInfo = async (hotelId) => {
  const { data } = await client.get(`/internal/hotels/${hotelId}`, {
    headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
  });
  return data.data; // { name, star_rating } hoặc null
};

module.exports = { getRates, getHotelBasicInfo };
