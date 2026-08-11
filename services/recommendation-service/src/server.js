require('dotenv').config();

// CHỈ chạy API HTTP — worker BullMQ + cron place.sync.job tách sang src/worker.js
// (process riêng, cùng image, xem Dockerfile/docker-compose command override).
const app = require('./app');
const PORT = process.env.PORT || 4004;

app.listen(PORT, () => {
  console.log(`[recommendation-service] API server is running on port ${PORT}`);
});
