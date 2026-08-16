const axios = require('axios');

// Tạo axios client gọi 1 service nội bộ khác. Tự gắn header X-Internal-Key cho
// mọi request tới /internal/* (service đích tự kiểm tra qua requireInternalKey).
// timeout ngắn vì đây là gọi nội bộ trong cùng mạng docker-compose, không phải
// API bên thứ ba qua Internet.
const createServiceClient = (baseURL, { timeoutMs = 10_000 } = {}) => {
  const client = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
  });
  return client;
};

module.exports = { createServiceClient };
