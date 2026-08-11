require('dotenv').config();
const cron = require('node-cron');

const app = require('./app');
const hotelSyncJob = require('./modules/hotel/hotel.sync.job');
const PORT = process.env.PORT || 4002;

// Cron crawl dữ liệu tĩnh khách sạn — 0h thứ 2 hằng tuần. Giữ trong cùng
// process API (giống hành vi monolith cũ) — chấp nhận giả định single-instance,
// KHÔNG scale hotel-service > 1 replica nếu chưa tách cron ra worker riêng.
cron.schedule(
  "0 0 * * 1",
  async () => {
    console.log("[HotelSync] Cron hàng tuần bắt đầu...");
    try {
      await hotelSyncJob.syncAllCities();
    } catch (err) {
      console.error("[HotelSync] Cron gặp lỗi nghiêm trọng:", err.message);
    }
  },
  { timezone: "Asia/Ho_Chi_Minh" }
);
console.log("[HotelSync] Cron job đã được đăng ký — chạy 0h thứ 2 hằng tuần (Asia/Ho_Chi_Minh)");

app.listen(PORT, () => {
  console.log(`[hotel-service] Server is running on port ${PORT}`);
});
