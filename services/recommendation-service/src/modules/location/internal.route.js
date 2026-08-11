const express = require("express");
const router = express.Router();
const locationRepository = require("./location.repository");
const { response, requireInternalKey } = require("@xedich/shared");

router.use(requireInternalKey);

// Gọi bởi hotel-service ở đầu mỗi lần chạy cron tuần (hotel.sync.job.js) để
// đồng bộ bản sao chỉ đọc `locations` trong DB riêng của nó — locations là dữ
// liệu tham chiếu gần như tĩnh (17 thành phố), recommendation-service là nguồn
// thật duy nhất (xem README-split.md).
router.get("/", async (req, res) => {
  const locations = await locationRepository.getAllLocations();
  return response.ok(res, locations, "Lấy danh sách thành phố (nội bộ) thành công");
});

module.exports = router;
