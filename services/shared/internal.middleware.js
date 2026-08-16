const response = require('./response');

// Bảo vệ route /internal/* — chỉ gọi được bởi service khác trong hệ thống
// (không public qua API Gateway). Xác thực đơn giản bằng khoá tĩnh dùng chung
// (INTERNAL_API_KEY) thay vì JWT người dùng, vì các cuộc gọi này không gắn với
// một request của user cụ thể (vd hotel-service đồng bộ locations theo cron).
const requireInternalKey = (req, res, next) => {
    const key = req.headers['x-internal-key'];
    if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
        return response.error(res, 'Không có quyền truy cập nội bộ', 403);
    }
    next();
};

module.exports = { requireInternalKey };
