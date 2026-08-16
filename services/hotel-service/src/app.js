const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler, requireInternalKey } = require('@xedich/shared');
const app = express();

app.set('trust proxy', 1);

const hotelRoutes = require('./modules/hotel/hotel.route');
const hotelInternalRoutes = require('./modules/hotel/internal.route');
const hotelSyncJob = require('./modules/hotel/hotel.sync.job');

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(morgan('[hotel-service] :method :url :status :response-time ms - :remote-addr'));

app.get('/health', (req, res) => res.json({ service: 'hotel-service', status: 'ok' }));

// Trigger crawl khách sạn (LiteAPI) thủ công qua HTTP — thay cho `docker exec ...
// syncAllCities()` vì Render Hobby không có Shell. Fire-and-forget vì crawl nhiều
// thành phố mất nhiều phút, vượt timeout của 1 request.
let hotelSyncRunning = false;
app.post('/internal/sync-hotels', requireInternalKey, (req, res) => {
  if (hotelSyncRunning) {
    return res.status(409).json({ success: false, message: 'Đang có 1 lượt crawl chạy rồi, xem log để theo dõi tiến độ' });
  }
  hotelSyncRunning = true;
  hotelSyncJob.syncAllCities()
    .catch((err) => console.error('[HotelSync] Trigger thủ công lỗi:', err.message))
    .finally(() => { hotelSyncRunning = false; });
  res.status(202).json({ success: true, message: 'Đã bắt đầu crawl — theo dõi tiến độ qua Logs (tag [HotelSync])' });
});

app.use('/hotels', hotelRoutes);
app.use('/internal/hotels', hotelInternalRoutes);

app.use(errorHandler);

module.exports = app;
