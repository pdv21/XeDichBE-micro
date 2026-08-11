const { Queue, Worker } = require("bullmq");
const redis = require("../../config/redis");
const jobRepository = require("./job.repository");

// Queue sinh lịch trình bất đồng bộ — CHỈ định nghĩa Queue (producer) ở đây.
// Worker (consumer) tách sang src/worker.js — process riêng với API server
// (nguyên tắc #5 trong kế hoạch tách microservices: API process và Worker
// process của recommendation-service tách biệt, cùng image, khác lệnh chạy).
const QUEUE_NAME = "trip-plan";

const planQueue = new Queue(QUEUE_NAME, { connection: redis });

const enqueuePlanJob = async ({ jobId, tripId, userId }) => {
  await planQueue.add(
    "plan-trip",
    { jobId, tripId, userId },
    {
      jobId: `plan-${jobId}`,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
};

module.exports = { enqueuePlanJob, planQueue, QUEUE_NAME };
