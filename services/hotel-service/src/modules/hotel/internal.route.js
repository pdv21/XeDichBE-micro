const express = require("express");
const router = express.Router();
const hotelController = require("./hotel.controller");
const { requireInternalKey } = require("@xedich/shared");

router.use(requireInternalKey);

// Gọi bởi recommendation-service#budget.service.js khi cần tên+sao khách sạn
// đã chọn (thay cho query chéo DB `hotels` lúc còn cùng DB monolith).
router.get("/:hotelId", hotelController.getBasicInfoInternal);

module.exports = router;
