const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10,
  maxFreeSockets: 5,
});

const otmClient = axios.create({
  baseURL: process.env.OPENTRIPMAP_BASE_URL || "https://api.opentripmap.com/0.1/en",
  timeout: 15_000,
  httpsAgent,
  params: { apikey: process.env.OPENTRIPMAP_API_KEY },
});

const withRetry = async (fn, { maxAttempts = 3, baseDelayMs = 1000 } = {}) => {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) throw err;

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr;
};

module.exports = { client: otmClient, withRetry };
