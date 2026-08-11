const { Redis } = require('ioredis');

// Redis chỉ dùng cho cache OTP đăng ký/quên mật khẩu — DB index riêng (mặc định 0)
// tách biệt namespace với BullMQ của recommendation-service (dùng DB index khác
// trên cùng Redis instance, xem services/recommendation-service/src/config/redis.js).
const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        db: Number(process.env.REDIS_DB) || 0,
        maxRetriesPerRequest: null,
    });

redis.on('connect', () => console.log('[Redis] Kết nối thành công'));
redis.on('error', (err) => console.error('[Redis] Lỗi:', err.message));

module.exports = redis;
