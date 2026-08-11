const express = require("express");
const router = express.Router();
const itineraryController = require("./itinerary.controller");
const { authenticate } = require("@xedich/shared");

router.use(authenticate);

router.get("/:id", itineraryController.getJob);

module.exports = router;
