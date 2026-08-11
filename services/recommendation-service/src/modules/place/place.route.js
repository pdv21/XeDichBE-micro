const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const placeController = require("./place.controller");

const placesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu, vui lòng thử lại sau" },
});

router.get("/", placesLimiter, placeController.getPlaces);

module.exports = router;
