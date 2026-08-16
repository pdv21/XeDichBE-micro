const { createServiceClient } = require("@xedich/shared");

// timeout dài vì LLM có thể chậm (ai-service tự retry nội bộ tới 60s/lần rồi).
const client = createServiceClient(process.env.AI_SERVICE_URL, { timeoutMs: 65_000 });

// Thay cho require("shared/config/llm.client").generateJSON trực tiếp — mọi nơi
// dùng Gemini (ai.personalizer.js, feedback.interpreter.js, place.enrich.job.js)
// giờ gọi qua đây. Lỗi HTTP (kể cả 429 do ai-service đánh dấu JSON không hợp lệ)
// vẫn ném lên nguyên vẹn qua axios — các nơi gọi có retry riêng theo status 429
// tiếp tục hoạt động y hệt trước.
const generateJSON = async (prompt) => {
  const { data } = await client.post("/ai/generate-json", { prompt });
  return data.data.result;
};

module.exports = { generateJSON };
