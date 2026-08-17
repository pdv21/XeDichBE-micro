const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
});

const literapiClient = axios.create({
  baseURL: process.env.LITEAPI_BASE_URL || "https://api.liteapi.travel/v3.0",
  timeout: 15_000,
  httpsAgent,
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "X-API-Key": process.env.LITEAPI_API_KEY,
  },
});

// 401/403 từ LiteAPI luôn là lỗi cấu hình phía server (API key sai/hết hạn/thu hồi),
// KHÔNG PHẢI lỗi của client. Nếu để lộ nguyên trạng, error.handler dùng chung sẽ
// forward đúng mã 401 đó cho browser — trùng với mã 401 mà app tự dùng cho "hết
// phiên đăng nhập", khiến interceptor ở Frontend/lib/api.js hiểu nhầm và tự logout
// user. Map các lỗi này thành 502 (lỗi phụ thuộc ngoài) + message chung chung, còn
// chi tiết thật log ra console để ops phát hiện key hỏng.
const toServiceError = (err) => {
  const status = err.response?.status;
  if (status === 401 || status === 403) {
    console.error(
      `[LiteAPI] Lỗi xác thực (status ${status}) — kiểm tra LITEAPI_API_KEY:`,
      err.response?.data || err.message
    );
    const wrapped = new Error("Không thể kết nối với nhà cung cấp khách sạn, vui lòng thử lại sau");
    wrapped.statusCode = 502;
    return wrapped;
  }
  return err;
};

const withRetry = async (fn, { maxAttempts = 3, baseDelayMs = 500 } = {}) => {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status && status >= 400 && status < 500) throw toServiceError(err);

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
      }
    }
  }
  throw toServiceError(lastErr);
};

module.exports = { client: literapiClient, withRetry };
