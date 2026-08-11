const express = require("express");
const router = express.Router();
const { response, requireInternalKey } = require("@xedich/shared");
const { generateJSON } = require("../../llm.client");

router.use(requireInternalKey);

// POST /ai/generate-json { prompt } → { result }
// Endpoint DUY NHẤT của ai-service — nhận prompt đã dựng sẵn (nghiệp vụ nằm ở
// bên gọi, vd recommendation-service#ai.personalizer.js/feedback.interpreter.js),
// trả về JSON đã parse. Không biết gì về "itinerary"/"feedback" — chỉ là LLM gateway.
router.post("/generate-json", async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return response.error(res, "prompt là bắt buộc (string)", 400);
    }
    const result = await generateJSON(prompt);
    return response.ok(res, { result }, "Sinh JSON thành công");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
