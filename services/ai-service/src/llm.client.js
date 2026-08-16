const axios = require("axios");
const https = require("https");

// LLM client trừu tượng — hiện dùng Google Gemini (free tier 1500 req/ngày).
// Đổi provider chỉ cần sửa file này + env — CHỈ ai-service giữ GEMINI_KEY,
// mọi service khác gọi qua POST /ai/generate-json, không biết provider là gì
// (provider-agnostic đúng nghĩa AI Service độc lập trong đề tài).
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.LLM_MODEL || "gemini-flash-latest";

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 5 });

const client = axios.create({
  baseURL: GEMINI_BASE,
  timeout: 60_000,
  httpsAgent,
  headers: { "x-goog-api-key": process.env.GEMINI_KEY || "" },
});

const withRetry = async (fn, { maxAttempts = 2, baseDelayMs = 2000 } = {}) => {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastErr;
};

const generateJSON = async (prompt) => {
  return withRetry(async () => {
    const res = await client.post(`/models/${MODEL}:generateContent`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1 },
        maxOutputTokens: 4096,
      },
    });

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("LLM không trả về nội dung");
    try {
      return JSON.parse(text);
    } catch (err) {
      throw Object.assign(new Error(`LLM trả về JSON không hợp lệ: ${err.message}`), {
        response: { status: 429 },
      });
    }
  }, { maxAttempts: 5, baseDelayMs: 1200 });
};

module.exports = { generateJSON };
