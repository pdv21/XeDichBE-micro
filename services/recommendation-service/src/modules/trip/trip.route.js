const express = require("express");
const router = express.Router();
const tripController = require("./trip.controller");
const itineraryController = require("../itinerary/itinerary.controller");
const budgetController = require("../budget/budget.controller");
const { authenticate } = require("@xedich/shared");

router.use(authenticate);

router.post("/", tripController.createTrip);
router.get("/", tripController.getMyTrips);
router.get("/:id", tripController.getTripById);
router.put("/:id", tripController.updateTrip);
router.delete("/:id", tripController.deleteTrip);

// Travel Planning Engine: sinh + xem lịch trình tham quan (trip+itinerary+budget
// đều nằm trong CÙNG service — recommendation-service — nên vẫn mount trực tiếp
// controller nhau như lúc còn monolith, không cần gọi HTTP nội bộ)
router.post("/:id/plan", itineraryController.planTrip);
router.get("/:id/itinerary", itineraryController.getItinerary);
router.post("/:id/adjust", itineraryController.adjustTrip);

router.get("/:id/budget", budgetController.getBudget);

module.exports = router;
