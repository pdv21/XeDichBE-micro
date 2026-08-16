const express = require("express");
const router = express.Router();
const { response } = require("@xedich/shared");
const flightService = require("./flight.service");

// GET /flights?origin=&destination=&departure_date=&adults= — tra cứu vé một
// chiều (không cần đăng nhập). Cũng dùng làm endpoint nội bộ mà
// recommendation-service gọi cho budget-aware planning (không cần route
// /internal riêng vì bản thân route này vốn đã public/không auth).
router.get("/", async (req, res) => {
    const { origin, destination, departure_date, adults } = req.query;

    if (!origin || !destination || !departure_date) {
        return response.error(res, "Missing required query parameters: origin, destination, departure_date", 400);
    }

    try {
        const data = await flightService.searchOneWay({
            origin,
            destination,
            departureDate: departure_date,
            adults: adults ? parseInt(adults, 10) : 1,
        });

        response.ok(res, data, "Flights retrieved successfully", 200);
    } catch (error) {
        console.error(error);
        response.error(res, error.message, 500, error.response?.data);
    }
});

// GET /flights/cheapest?...&adults= — trả thẳng giá rẻ nhất (số hoặc null),
// dùng bởi recommendation-service/budget thay cho gọi hàm getCheapestOneWayPrice
// trong-process như lúc còn monolith.
router.get("/cheapest", async (req, res) => {
    const { origin, destination, departure_date, adults } = req.query;

    if (!origin || !destination || !departure_date) {
        return response.error(res, "Missing required query parameters: origin, destination, departure_date", 400);
    }

    const price = await flightService.getCheapestOneWayPrice({
        origin,
        destination,
        departureDate: departure_date,
        adults: adults ? parseInt(adults, 10) : 1,
    });

    return response.ok(res, { price }, "Lấy giá vé rẻ nhất thành công");
});

module.exports = router;
