const { Redis } = require('ioredis');

// DB index riêng cho BullMQ (mặc định 1) — tách namespace khỏi Redis OTP của
// user-service (DB index 0) dù dùng chung 1 Redis container trong docker-compose.
const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: Number(process.env.REDIS_DB) || 1,
        maxRetriesPerRequest: null,
    });

redis.on('connect', () => console.log('[Redis] Kết nối thành công'));
redis.on('error', (err) => console.error('[Redis] Lỗi:', err.message));

module.exports = redis;
