const db = require("../../config/database");
const { client, withRetry } = require("./opentripmap.client");

const fetchRadius = async ({ lat, lon, radius, kinds, limit = 500 }) => {
  const { data } = await withRetry(() =>
    client.get("/places/radius", {
      params: { lat, lon, radius, kinds, limit, format: "json" },
    })
  );
  return data ?? [];
};

const fetchDetail = async (xid) => {
  const { data } = await withRetry(() => client.get(`/places/xid/${encodeURIComponent(xid)}`));
  return data ?? null;
};

const BULK_CHUNK = 300;

const bulkUpsertPlaces = async (places) => {
  if (!places || places.length === 0) return 0;

  for (let i = 0; i < places.length; i += BULK_CHUNK) {
    const chunk = places.slice(i, i + BULK_CHUNK);
    const placeholders = chunk
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())")
      .join(", ");
    const values = chunk.flatMap((p) => [
      p.xid, p.location_id, p.name, p.category, p.kinds, p.address,
      p.latitude, p.longitude, p.rate, p.description, p.image, p.wikipedia,
      p.visit_minutes,
    ]);

    await db.execute(
      `INSERT INTO places (
         xid, location_id, name, category, kinds, address,
         latitude, longitude, rate, description, image, wikipedia,
         visit_minutes, last_synced_at
       )
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         location_id    = VALUES(location_id),
         name           = VALUES(name),
         category       = VALUES(category),
         kinds          = VALUES(kinds),
         address        = COALESCE(VALUES(address), address),
         latitude       = VALUES(latitude),
         longitude      = VALUES(longitude),
         rate           = VALUES(rate),
         description    = COALESCE(VALUES(description), description),
         image          = COALESCE(VALUES(image), image),
         wikipedia      = COALESCE(VALUES(wikipedia), wikipedia),
         visit_minutes  = VALUES(visit_minutes),
         last_synced_at = NOW()`,
      values
    );
  }

  return places.length;
};

const findNeedingWikiEnrich = async (limit = 500) => {
  const safeLimit = Math.max(parseInt(limit, 10) || 500, 1);
  const [rows] = await db.execute(
    `SELECT id, name, wikipedia, description, description_vi, name_vi, image
     FROM places
     WHERE wikipedia IS NOT NULL AND is_active = 1
       AND (description_vi IS NULL OR name_vi IS NULL OR image IS NULL)
     ORDER BY rate DESC
     LIMIT ${safeLimit}`
  );
  return rows;
};

const findNeedingTranslation = async (limit = 300) => {
  const safeLimit = Math.max(parseInt(limit, 10) || 300, 1);
  const [rows] = await db.execute(
    `SELECT id, name, description
     FROM places
     WHERE category = 'attraction' AND rate >= 2 AND is_active = 1
       AND (name_vi IS NULL OR (description IS NOT NULL AND description_vi IS NULL))
     ORDER BY rate DESC
     LIMIT ${safeLimit}`
  );
  return rows;
};

const updateEnrichment = async (id, { nameVi, descriptionVi, image }) => {
  await db.execute(
    `UPDATE places SET
       name_vi        = COALESCE(?, name_vi),
       description_vi = COALESCE(?, description_vi),
       image          = COALESCE(?, image)
     WHERE id = ?`,
    [nameVi ?? null, descriptionVi ?? null, image ?? null, id]
  );
};

const findNeedingCostEstimate = async (limit = 1000) => {
  const safeLimit = Math.max(parseInt(limit, 10) || 1000, 1);
  const [rows] = await db.execute(
    `SELECT p.id, p.name, p.category, p.kinds, l.city_name
     FROM places p JOIN locations l ON p.location_id = l.id
     WHERE p.avg_cost IS NULL AND p.is_active = 1
     ORDER BY p.rate DESC
     LIMIT ${safeLimit}`
  );
  return rows;
};

const updateCost = async (id, avgCost) => {
  await db.execute(`UPDATE places SET avg_cost = ? WHERE id = ?`, [avgCost, id]);
};

const findImagesNeedingWidthCheck = async () => {
  const [rows] = await db.execute(
    `SELECT id, image FROM places WHERE image LIKE '%px-%'`
  );
  return rows;
};

const setImage = async (id, image) => {
  await db.execute(`UPDATE places SET image = ? WHERE id = ?`, [image, id]);
};

const buildLocationConditions = ({ locationId, category, minRate }) => {
  const conditions = ["location_id = ?", "is_active = 1"];
  const params = [locationId];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (minRate != null) {
    conditions.push("rate >= ?");
    params.push(minRate);
  }

  return { where: conditions.join(" AND "), params };
};

const findByLocation = async ({ locationId, category, minRate, limit, offset }) => {
  const safeLimit = Math.max(parseInt(limit, 10) || 50, 1);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const { where, params } = buildLocationConditions({ locationId, category, minRate });

  const [rows] = await db.execute(
    `SELECT * FROM places WHERE ${where}
     ORDER BY rate DESC, name ASC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );
  return rows;
};

const countByLocation = async ({ locationId, category, minRate }) => {
  const { where, params } = buildLocationConditions({ locationId, category, minRate });
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM places WHERE ${where}`, params);
  return total;
};

module.exports = {
  fetchRadius, fetchDetail, bulkUpsertPlaces, findByLocation, countByLocation,
  findNeedingWikiEnrich, findNeedingTranslation, updateEnrichment,
  findImagesNeedingWidthCheck, setImage,
  findNeedingCostEstimate, updateCost,
};
