const jwt = require('jsonwebtoken');
const response = require('./response');

// Xác thực JWT stateless — giống hệt Backend/src/shared/middlewares/auth.middleware.js
// cũ. Mỗi service cần req.user.id (user-service, recommendation-service) tự verify
// bằng JWT_SECRET dùng chung, KHÔNG gọi ngược user-service mỗi request (giữ tính
// stateless của JWT khi tách microservices).
const authenticate = (req, res, next) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
    const token = req.cookies?.token || bearer;

    if (!token) {
        return response.error(res, 'Yêu cầu đăng nhập', 401);
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: payload.userId };
        next();
    } catch (error) {
        return response.error(res, 'Token không hợp lệ hoặc đã hết hạn', 401);
    }
};

module.exports = { authenticate };
