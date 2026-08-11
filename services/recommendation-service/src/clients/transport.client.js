const { createServiceClient } = require("@xedich/shared");

const client = createServiceClient(process.env.TRANSPORT_SERVICE_URL, { timeoutMs: 30_000 });

// Thay cho require("flight/flight.service").getCheapestOneWayPrice trực tiếp —
// dùng bởi budget.service.js#estimateFlight. Không throw khi lỗi (vé bay là
// chi phí tuỳ chọn, giữ nguyên hành vi best-effort của bản gốc).
const getCheapestOneWayPrice = async ({ origin, destination, departureDate, adults = 1 }) => {
  try {
    const { data } = await client.get("/flights/cheapest", {
      params: { origin, destination, departure_date: departureDate, adults },
    });
    return data.data.price;
  } catch (err) {
    console.warn(`[TransportClient] Lỗi tìm vé ${origin}→${destination} ${departureDate}:`, err.message);
    return null;
  }
};

module.exports = { getCheapestOneWayPrice };
