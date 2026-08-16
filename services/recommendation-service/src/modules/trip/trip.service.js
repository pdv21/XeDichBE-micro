const tripRepository = require("./trip.repository");
const locationRepository = require("../location/location.repository");

const validationError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const MAX_NIGHTS = 14;

const parseDate = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const AIRPORT_CODE_RE = /^[A-Z]{3}$/;

const validateTripInput = ({ startDate, endDate, numPeople, budgetTotal, originAirport, mealCostVnd }, { isCreate }) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (isCreate && (!start || !end)) {
    throw validationError("start_date và end_date là bắt buộc (YYYY-MM-DD)", 400);
  }
  if (start && end) {
    if (end <= start) {
      throw validationError("end_date phải sau start_date", 400);
    }
    const nights = (end - start) / 86_400_000;
    if (nights > MAX_NIGHTS) {
      throw validationError(`Chuyến đi tối đa ${MAX_NIGHTS} đêm`, 400);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw validationError("start_date không được ở quá khứ", 400);
    }
  }
  if (numPeople !== undefined) {
    const n = Number(numPeople);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      throw validationError("num_people phải là số nguyên từ 1 đến 20", 400);
    }
  }
  if (budgetTotal !== undefined && budgetTotal !== null) {
    const b = Number(budgetTotal);
    if (Number.isNaN(b) || b < 0) {
      throw validationError("budget_total phải là số không âm", 400);
    }
  }
  if (mealCostVnd !== undefined && mealCostVnd !== null) {
    const m = Number(mealCostVnd);
    if (Number.isNaN(m) || m <= 0 || m > 5_000_000) {
      throw validationError("meal_cost_vnd phải là số dương, tối đa 5.000.000đ", 400);
    }
  }
  if (originAirport !== undefined && originAirport !== null && originAirport !== "" && !AIRPORT_CODE_RE.test(originAirport)) {
    throw validationError("origin_airport phải là mã sân bay 3 ký tự (vd HAN, SGN, DAD)", 400);
  }
};

const createTrip = async (userId, { cityCode, title, startDate, endDate, budgetTotal, numPeople, originAirport, mealCostVnd }) => {
  if (!cityCode) {
    throw validationError("city_code là bắt buộc", 400);
  }
  const normalizedOrigin = originAirport ? String(originAirport).toUpperCase() : originAirport;
  validateTripInput({ startDate, endDate, numPeople, budgetTotal, originAirport: normalizedOrigin, mealCostVnd }, { isCreate: true });

  const location = await locationRepository.findByCityCode(cityCode);
  if (!location) {
    throw validationError(`Thành phố "${cityCode}" chưa được hỗ trợ`, 404);
  }

  const tripId = await tripRepository.createTrip({
    userId,
    locationId: location.id,
    title,
    startDate,
    endDate,
    budgetTotal,
    numPeople,
    originAirport: normalizedOrigin || null,
    mealCostVnd,
  });

  return tripRepository.findByIdWithLocation(tripId);
};

const getOwnedTrip = async (userId, tripId) => {
  const trip = await tripRepository.findByIdWithLocation(tripId);
  if (!trip || trip.user_id !== userId) {
    throw validationError("Không tìm thấy chuyến đi", 404);
  }
  return trip;
};

const getMyTrips = async (userId, { page = 1, pageSize = 20 }) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 50);

  const { rows, total } = await tripRepository.findByUser(userId, {
    limit: safePageSize,
    offset: (safePage - 1) * safePageSize,
  });

  return {
    trips: rows,
    pagination: { total, page: safePage, page_size: safePageSize, total_pages: Math.ceil(total / safePageSize) },
  };
};

const updateTrip = async (userId, tripId, { cityCode, title, startDate, endDate, budgetTotal, numPeople, originAirport, mealCostVnd }) => {
  const trip = await getOwnedTrip(userId, tripId);

  if (trip.status !== "draft") {
    throw validationError("Chỉ sửa được chuyến đi ở trạng thái draft", 409);
  }

  const normalizedOrigin = originAirport ? String(originAirport).toUpperCase() : originAirport;
  validateTripInput(
    {
      startDate: startDate ?? trip.start_date,
      endDate: endDate ?? trip.end_date,
      numPeople,
      budgetTotal,
      originAirport: normalizedOrigin,
      mealCostVnd,
    },
    { isCreate: false }
  );

  let locationId;
  if (cityCode) {
    const location = await locationRepository.findByCityCode(cityCode);
    if (!location) {
      throw validationError(`Thành phố "${cityCode}" chưa được hỗ trợ`, 404);
    }
    locationId = location.id;
  }

  await tripRepository.updateTrip(tripId, {
    locationId,
    title,
    startDate,
    endDate,
    budgetTotal,
    numPeople,
    originAirport: normalizedOrigin === "" ? null : normalizedOrigin,
    mealCostVnd,
  });

  return tripRepository.findByIdWithLocation(tripId);
};

const deleteTrip = async (userId, tripId) => {
  await getOwnedTrip(userId, tripId);
  await tripRepository.deleteTrip(tripId);
};

module.exports = { createTrip, getOwnedTrip, getMyTrips, updateTrip, deleteTrip };
