const recommendationClient = require("../../clients/recommendation.client");
const locationRepository = require("./location.repository");

// Đồng bộ bản sao chỉ đọc `locations` từ recommendation-service (nguồn thật).
// Gọi ở đầu mỗi lần chạy cron tuần hotel.sync.job.js — locations gần như tĩnh
// (17 thành phố) nên tần suất này là đủ, không cần đồng bộ real-time.
const syncLocations = async () => {
  const locations = await recommendationClient.getAllLocations();
  const count = await locationRepository.upsertAll(locations);
  console.log(`[LocationSync] Đồng bộ ${count} thành phố từ recommendation-service`);
  return count;
};

module.exports = { syncLocations };
