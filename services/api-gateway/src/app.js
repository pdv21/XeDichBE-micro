const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(cookieParser());
app.use(morgan('[api-gateway] :method :url :status :response-time ms - :remote-addr'));

app.get('/health', (req, res) => res.json({ service: 'api-gateway', status: 'ok' }));

// Proxy mỏng theo path prefix — KHÔNG parse body (express.json()) ở gateway vì
// http-proxy-middleware cần forward request stream nguyên vẹn (parse trước rồi
// proxy lại sẽ làm mất/đổi body). KHÔNG verify JWT ở đây — mỗi service tự verify
// độc lập bằng JWT_SECRET dùng chung (giữ tính stateless, giảm rủi ro đổi hành
// vi so với monolith cũ).
//
// LƯU Ý http-proxy-middleware v3: khi mount qua app.use(prefix, proxy(...)),
// Express đã TỰ tách bỏ `prefix` khỏi req.url trước khi middleware nhận được
// (khác hành vi v2 vốn tự giữ nguyên qua req.originalUrl) — nếu không bù lại,
// request tới downstream service sẽ mất tiền tố (vd "/auth/register" → "/register",
// service map lỗi 404 "Cannot POST /register"). pathRewrite dưới đây bù lại đúng
// tiền tố đã bị Express tách, để service nhận nguyên path gốc.
const proxy = (prefix, target) => createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => prefix + path,
    // Giữ nguyên cookie httpOnly + Authorization header khi forward — mặc định
    // http-proxy-middleware đã forward toàn bộ header/cookie, không cần cấu hình thêm.
});

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:4001';
const HOTEL_SERVICE_URL = process.env.HOTEL_SERVICE_URL || 'http://hotel-service:4002';
const TRANSPORT_SERVICE_URL = process.env.TRANSPORT_SERVICE_URL || 'http://transport-service:4003';
const RECOMMENDATION_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://recommendation-service:4004';

// user-service — auth + user (không mount /internal/* — chỉ dùng service-to-service)
app.use('/auth', proxy('/auth', USER_SERVICE_URL));
app.use('/users', proxy('/users', USER_SERVICE_URL));

// hotel-service
app.use('/hotels', proxy('/hotels', HOTEL_SERVICE_URL));

// transport-service
app.use('/flights', proxy('/flights', TRANSPORT_SERVICE_URL));

// recommendation-service — trip (kèm itinerary/budget mount lồng), place, jobs, locations
app.use('/trips', proxy('/trips', RECOMMENDATION_SERVICE_URL));
app.use('/places', proxy('/places', RECOMMENDATION_SERVICE_URL));
app.use('/jobs', proxy('/jobs', RECOMMENDATION_SERVICE_URL));
app.use('/locations', proxy('/locations', RECOMMENDATION_SERVICE_URL));

// ai-service KHÔNG mount — chỉ nội bộ, không public qua Gateway.

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Không tìm thấy endpoint', data: null });
});

module.exports = app;
