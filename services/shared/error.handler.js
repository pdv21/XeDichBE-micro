// Global error handler dùng chung cho MỌI service — đặt sau tất cả route:
//   app.use(errorHandler);
// Di dời nguyên vẹn từ Backend/src/modules/hotel_liteapi/error.handler.js
// (trước đây bị đặt lẫn trong module hotel dù dùng chung toàn app — sửa lại
// vị trí đúng chỗ khi tách service).
const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || err.response?.status || 500;
  const message =
    err.message ||
    err.response?.data?.message ||
    "Internal server error";

  return res.status(status).json({ success: false, message });
};

module.exports = errorHandler;
