const { createServiceClient } = require("@xedich/shared");

const client = createServiceClient(process.env.RECOMMENDATION_SERVICE_URL, { timeoutMs: 15_000 });

// Gọi ở đầu mỗi lần chạy cron tuần (hotel.sync.job.js) để đồng bộ bản sao
// chỉ đọc `locations` — recommendation-service là nguồn thật duy nhất.
const getAllLocations = async () => {
  const { data } = await client.get("/internal/locations");
  return data.data;
};

module.exports = { getAllLocations };
