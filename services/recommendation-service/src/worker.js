require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const { Worker } = require('bullmq');
const redis = require('./config/redis');
const { QUEUE_NAME } = require('./modules/itinerary/plan.queue');
const itineraryService = require('./modules/itinerary/itinerary.service');
const jobRepository = require('./modules/itinerary/job.repository');
const { generateAiSummary } = require('./modules/itinerary/ai.personalizer');
const placeSyncJob = require('./modules/place/place.sync.job');

// Render deploy dùng type: web cho container này (Hobby plan không có Background
// Worker) — cần bind PORT để qua health check, dù worker không có route HTTP thật.
// TẬN DỤNG luôn HTTP server này thêm 1 route admin trigger crawl địa điểm thủ công
// (thay cho `docker exec ... syncAllCities()` — Render Hobby không có Shell để chạy
// lệnh đó). Bảo vệ bằng X-Internal-Key sẵn có, chạy fire-and-forget vì crawl 17
// thành phố mất nhiều phút, vượt timeout của 1 HTTP request.
const HEALTH_PORT = process.env.PORT || 4099;
let placeSyncRunning = false;
http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/internal/sync-places") {
      const key = req.headers["x-internal-key"];
      if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "Không có quyền truy cập nội bộ" }));
      }
      if (placeSyncRunning) {
        res.writeHead(409, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "Đang có 1 lượt crawl chạy rồi, xem log để theo dõi tiến độ" }));
      }
      placeSyncRunning = true;
      placeSyncJob.syncAllCities()
        .catch((err) => console.error("[PlaceSync] Trigger thủ công lỗi:", err.message))
        .finally(() => { placeSyncRunning = false; });
      res.writeHead(202, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, message: "Đã bắt đầu crawl — theo dõi tiến độ qua Logs (tag [PlaceSync])" }));
    }
    res.writeHead(200).end("worker ok");
  })
  .listen(HEALTH_PORT, () => console.log(`[Worker] Health check server đang lắng nghe cổng ${HEALTH_PORT}`));

// ─── Worker BullMQ 'trip-plan' — process riêng, tách khỏi API server ─────────
// Giữ nguyên hành vi y hệt Backend/src/modules/itinerary/plan.queue.js cũ,
// chỉ đổi chỗ chạy: trước đây worker khởi động cùng process HTTP server
// (require tại server.js), giờ khởi động ở process worker riêng (2 container
// trong docker-compose, cùng image recommendation-service, khác lệnh chạy).
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { jobId, tripId, userId } = job.data;
    console.log(`[Worker] Bắt đầu job #${jobId} (trip ${tripId})`);

    await jobRepository.updateJobStatus(jobId, "processing");
    await jobRepository.updateTripStatus(tripId, "planning");

    try {
      const itinerary = await itineraryService.planTrip(userId, tripId);

      try {
        const aiSummary = await generateAiSummary(itinerary, itinerary._preferences ?? {});
        await jobRepository.saveTripAiSummary(tripId, aiSummary);
        console.log(`[Worker] Job #${jobId}: AI summary OK`);
      } catch (aiErr) {
        console.warn(`[Worker] Job #${jobId}: AI summary lỗi (bỏ qua):`, aiErr.message);
      }

      await jobRepository.updateJobStatus(jobId, "completed");
      console.log(`[Worker] Hoàn thành job #${jobId}`);
    } catch (err) {
      await jobRepository.updateJobStatus(jobId, "failed", err.message);
      await jobRepository.updateTripStatus(tripId, "failed");
      console.error(`[Worker] Job #${jobId} thất bại:`, err.message);
      throw err;
    }
  },
  { connection: redis, concurrency: 2 }
);

worker.on("error", (err) => console.error("[Worker] Lỗi:", err.message));

console.log(`[Worker] '${QUEUE_NAME}' đã sẵn sàng (concurrency 2)`);

// ─── Cron đồng bộ địa điểm — 0h thứ 3 hằng tuần ──────────────────────────────
// Di dời từ place.sync.job.js (lúc còn monolith file này tự cron.schedule() khi
// require). Ở worker process, đăng ký cron TẠI ĐÂY để tách rõ trách nhiệm: file
// job chỉ export hàm thuần, việc "khi nào chạy" là của process worker.
cron.schedule(
  "0 0 * * 2",
  async () => {
    console.log("[PlaceSync] Cron hàng tuần bắt đầu...");
    try {
      await placeSyncJob.syncAllCities();
    } catch (err) {
      console.error("[PlaceSync] Cron gặp lỗi nghiêm trọng:", err.message);
    }
  },
  { timezone: "Asia/Ho_Chi_Minh" }
);

console.log("[PlaceSync] Cron job đã được đăng ký — chạy 0h thứ 3 hằng tuần (Asia/Ho_Chi_Minh)");
