const axios = require("axios");
const placeRepository = require("./place.repository");
const { generateJSON } = require("../../clients/ai.client");

const WIKI_DELAY_MS = 600;
const GEMINI_BATCH_SIZE = 6;
const GEMINI_DELAY_MS = 20_000;
const GEMINI_429_WAIT_MS = 45_000;
const COST_BATCH_SIZE = 40;
const COST_MAX_VND = 5_000_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wikiHttp = axios.create({
  timeout: 15_000,
  headers: { "User-Agent": "XeDichBot/1.0 (https://github.com/xedich; student project travel planner)" },
});

const wikiGet = async (url, config) => {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await wikiHttp.get(url, config);
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) throw err;
      if (attempt < 4) {
        const retryAfter = Number(err.response?.headers?.["retry-after"]) || 0;
        await sleep(Math.max(retryAfter * 1000, 3000 * attempt));
      }
    }
  }
  throw lastErr;
};

const parseWikiUrl = (url) => {
  try {
    const u = new URL(url);
    const lang = u.hostname.split(".")[0];
    const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ");
    return title ? { lang, title } : null;
  } catch {
    return null;
  }
};

const findViTitle = async (lang, title) => {
  const { data } = await wikiGet(`https://${lang}.wikipedia.org/w/api.php`, {
    params: {
      action: "query", prop: "langlinks", lllang: "vi", titles: title,
      redirects: 1, format: "json", formatversion: 2,
    },
  });
  return data?.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
};

const fetchSummary = async (lang, title) => {
  const { data } = await wikiGet(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`
  );
  return data ?? null;
};

const cleanTitle = (t) => (t || "").replace(/\s*\(.*\)\s*$/, "").trim();

const WIKIMEDIA_STANDARD_THUMB_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];
const normalizeWikimediaThumbWidth = (url) => {
  const m = /^(.*\/)(\d+)(px-[^/]+)$/.exec(url);
  if (!m) return url;
  const width = Number(m[2]);
  if (WIKIMEDIA_STANDARD_THUMB_WIDTHS.includes(width)) return url;
  const standard =
    WIKIMEDIA_STANDARD_THUMB_WIDTHS.find((w) => w >= width) ??
    WIKIMEDIA_STANDARD_THUMB_WIDTHS[WIKIMEDIA_STANDARD_THUMB_WIDTHS.length - 1];
  return `${m[1]}${standard}${m[3]}`;
};

const repairImageWidths = async () => {
  const rows = await placeRepository.findImagesNeedingWidthCheck();
  let fixed = 0;
  for (const row of rows) {
    const normalized = normalizeWikimediaThumbWidth(row.image);
    if (normalized !== row.image) {
      await placeRepository.setImage(row.id, normalized);
      fixed++;
    }
  }
  console.log(`[PlaceEnrich] Repair width ảnh: sửa ${fixed}/${rows.length} URL không chuẩn`);
  return fixed;
};

const enrichFromWikipedia = async () => {
  const places = await placeRepository.findNeedingWikiEnrich();
  console.log(`[PlaceEnrich] Wikipedia: ${places.length} điểm cần enrich`);

  let ok = 0;
  for (const place of places) {
    const parsed = parseWikiUrl(place.wikipedia);
    if (!parsed) continue;

    try {
      const viTitle = parsed.lang === "vi" ? parsed.title : await findViTitle(parsed.lang, parsed.title);
      const fields = {};

      if (viTitle) {
        const summary = await fetchSummary("vi", viTitle);
        if (summary) {
          if (place.name_vi == null) fields.nameVi = cleanTitle(summary.title || viTitle).slice(0, 255) || null;
          if (place.description_vi == null && summary.extract) {
            fields.descriptionVi = summary.extract.slice(0, 5000);
          }
          if (place.image == null && summary.thumbnail?.source) {
            fields.image = normalizeWikimediaThumbWidth(summary.thumbnail.source).slice(0, 500);
          }
        }
      }

      if (place.image == null && !fields.image) {
        const enSummary = await fetchSummary(parsed.lang, parsed.title);
        if (enSummary?.thumbnail?.source) {
          fields.image = normalizeWikimediaThumbWidth(enSummary.thumbnail.source).slice(0, 500);
        }
      }

      if (Object.keys(fields).length > 0) {
        await placeRepository.updateEnrichment(place.id, fields);
        ok++;
      }
    } catch (err) {
      console.warn(`[PlaceEnrich] Wikipedia lỗi "${place.name}":`, err.message);
    }
    await sleep(WIKI_DELAY_MS);
  }

  console.log(`[PlaceEnrich] Wikipedia: cập nhật ${ok}/${places.length} điểm`);
  return ok;
};

const translateBatch = async (batch) => {
  const items = batch.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ? String(p.description).slice(0, 900) : null,
  }));

  const prompt = `Bạn là biên dịch viên du lịch. Dịch tên và mô tả các địa điểm du lịch Việt Nam sau sang tiếng Việt tự nhiên.
Quy tắc:
- "name_vi": dùng tên tiếng Việt thông dụng của địa danh (vd "Dragon Bridge" → "Cầu Rồng", "Marble Mountains" → "Ngũ Hành Sơn"). Tên riêng không có tên Việt thông dụng thì GIỮ NGUYÊN.
- "description_vi": dịch mô tả sang tiếng Việt trôi chảy, giữ thông tin chính; null nếu description là null.
- Trả về JSON mảng: [{"id": số, "name_vi": "...", "description_vi": "..." | null}] — đủ mọi id đầu vào, không thêm gì khác.

Dữ liệu: ${JSON.stringify(items)}`;

  const result = await generateJSON(prompt);
  return Array.isArray(result) ? result : [];
};

const enrichFromGemini = async () => {
  if (!process.env.AI_SERVICE_URL) {
    console.warn("[PlaceEnrich] Bỏ qua bước Gemini — chưa cấu hình AI_SERVICE_URL");
    return 0;
  }

  const places = await placeRepository.findNeedingTranslation();
  console.log(`[PlaceEnrich] Gemini: ${places.length} điểm cần dịch`);

  let ok = 0;
  for (let i = 0; i < places.length; i += GEMINI_BATCH_SIZE) {
    const batch = places.slice(i, i + GEMINI_BATCH_SIZE);
    try {
      let translated;
      for (let attempt = 1; ; attempt++) {
        try {
          translated = await translateBatch(batch);
          break;
        } catch (err) {
          if (err.response?.status !== 429 || attempt >= 3) throw err;
          console.log(`[PlaceEnrich] Gemini 429 — nghỉ ${GEMINI_429_WAIT_MS / 1000}s rồi thử lại...`);
          await sleep(GEMINI_429_WAIT_MS);
        }
      }
      for (const t of translated) {
        if (!batch.some((p) => p.id === t.id)) continue;
        await placeRepository.updateEnrichment(t.id, {
          nameVi: t.name_vi ? String(t.name_vi).slice(0, 255) : null,
          descriptionVi: t.description_vi ? String(t.description_vi).slice(0, 5000) : null,
        });
        ok++;
      }
    } catch (err) {
      console.warn(`[PlaceEnrich] Gemini lỗi batch ${i / GEMINI_BATCH_SIZE + 1}:`, err.message);
    }
    if (i + GEMINI_BATCH_SIZE < places.length) await sleep(GEMINI_DELAY_MS);
  }

  console.log(`[PlaceEnrich] Gemini: dịch xong ${ok}/${places.length} điểm`);
  return ok;
};

const estimateCostBatch = async (batch) => {
  const items = batch.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    city: p.city_name,
  }));

  const prompt = `Bạn là chuyên gia du lịch Việt Nam. Ước tính chi phí trung bình (đơn vị VND) cho các địa điểm sau:
- category "attraction": giá vé vào cửa trung bình cho 1 người lớn (0 nếu miễn phí — công viên/phố đi bộ/bãi biển/chùa công cộng...).
- category "food": giá trung bình 1 phần ăn hoặc 1 đồ uống cho 1 người tại đó.
Ước tính hợp lý dựa trên tên, loại và thành phố (giá ở thành phố lớn thường cao hơn tỉnh nhỏ). Không chắc thì ước theo mặt bằng chung của category đó.
Trả về JSON mảng: [{"id": số, "avg_cost_vnd": số nguyên VND}] — đủ mọi id đầu vào, không thêm gì khác.
QUAN TRỌNG: avg_cost_vnd phải là số JSON thuần (vd 1500000), TUYỆT ĐỐI KHÔNG dùng dấu phẩy/chấm ngăn cách hàng nghìn (KHÔNG viết 1,500,000 hay 1.500.000) — sẽ làm hỏng cú pháp JSON.

Dữ liệu: ${JSON.stringify(items)}`;

  const result = await generateJSON(prompt);
  return Array.isArray(result) ? result : [];
};

const enrichCostsFromGemini = async () => {
  if (!process.env.AI_SERVICE_URL) {
    console.warn("[PlaceEnrich] Bỏ qua bước ước tính chi phí — chưa cấu hình AI_SERVICE_URL");
    return 0;
  }

  const places = await placeRepository.findNeedingCostEstimate();
  console.log(`[PlaceEnrich] Chi phí: ${places.length} điểm cần ước tính`);

  let ok = 0;
  for (let i = 0; i < places.length; i += COST_BATCH_SIZE) {
    const batch = places.slice(i, i + COST_BATCH_SIZE);
    try {
      let estimated;
      for (let attempt = 1; ; attempt++) {
        try {
          estimated = await estimateCostBatch(batch);
          break;
        } catch (err) {
          if (err.response?.status !== 429 || attempt >= 3) throw err;
          console.log(`[PlaceEnrich] Gemini 429 — nghỉ ${GEMINI_429_WAIT_MS / 1000}s rồi thử lại...`);
          await sleep(GEMINI_429_WAIT_MS);
        }
      }
      for (const e of estimated) {
        if (!batch.some((p) => p.id === e.id)) continue;
        const raw = Number(e.avg_cost_vnd);
        if (!Number.isFinite(raw) || raw < 0) continue;
        await placeRepository.updateCost(e.id, Math.min(Math.round(raw), COST_MAX_VND));
        ok++;
      }
    } catch (err) {
      console.warn(`[PlaceEnrich] Chi phí lỗi batch ${i / COST_BATCH_SIZE + 1}:`, err.message);
    }
    if (i + COST_BATCH_SIZE < places.length) await sleep(GEMINI_DELAY_MS);
  }

  console.log(`[PlaceEnrich] Chi phí: ước tính xong ${ok}/${places.length} điểm`);
  return ok;
};

const enrichAllPlaces = async () => {
  console.log(`[PlaceEnrich] Bắt đầu enrich lúc ${new Date().toISOString()}`);
  const repaired = await repairImageWidths();
  const wiki = await enrichFromWikipedia();
  const gemini = await enrichFromGemini();
  const cost = await enrichCostsFromGemini();
  console.log(`[PlaceEnrich] Hoàn thành — Repair: ${repaired}, Wikipedia: ${wiki}, Gemini: ${gemini}, Chi phí: ${cost}`);
  return { repaired, wiki, gemini, cost };
};

module.exports = {
  enrichAllPlaces, enrichFromWikipedia, enrichFromGemini, enrichCostsFromGemini,
  repairImageWidths, normalizeWikimediaThumbWidth,
};
