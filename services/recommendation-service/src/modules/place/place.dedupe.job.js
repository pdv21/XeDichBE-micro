const db = require("../../config/database");

const NAME_DISTANCE_M = { attraction: 500, food: 100 };

const normalizeName = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");

const distanceM = (a, b) => {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const makeUnionFind = (ids) => {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => parent.set(find(a), find(b));
  return { find, union };
};

const pickKeeper = (group) =>
  [...group].sort(
    (a, b) =>
      b.rate - a.rate ||
      (b.image ? 1 : 0) - (a.image ? 1 : 0) ||
      (b.description_vi ? 1 : 0) - (a.description_vi ? 1 : 0) ||
      a.id - b.id
  )[0];

const dedupeAllPlaces = async () => {
  const [places] = await db.execute(
    `SELECT id, location_id, category, name, name_vi, wikipedia,
            latitude, longitude, rate, image, description, description_vi
     FROM places WHERE is_active = 1`
  );
  console.log(`[PlaceDedupe] Kiểm tra ${places.length} địa điểm đang hiển thị`);

  for (const p of places) {
    p.latitude = Number(p.latitude);
    p.longitude = Number(p.longitude);
  }
  const uf = makeUnionFind(places.map((p) => p.id));

  const byWiki = new Map();
  for (const p of places) {
    if (!p.wikipedia) continue;
    const key = `${p.location_id}|${p.wikipedia.toLowerCase()}`;
    if (byWiki.has(key)) uf.union(p.id, byWiki.get(key));
    else byWiki.set(key, p.id);
  }

  const byName = new Map();
  for (const p of places) {
    const keys = new Set([normalizeName(p.name), normalizeName(p.name_vi)]);
    for (const n of keys) {
      if (n.length < 3) continue;
      const key = `${p.location_id}|${p.category}|${n}`;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(p);
    }
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const maxDist = NAME_DISTANCE_M[group[0].category] ?? 100;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (distanceM(group[i], group[j]) <= maxDist) uf.union(group[i].id, group[j].id);
      }
    }
  }

  const groups = new Map();
  for (const p of places) {
    const root = uf.find(p.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p);
  }

  let deactivated = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keeper = pickKeeper(group);
    const losers = group.filter((p) => p.id !== keeper.id);

    const donor = (field) => losers.find((l) => l[field])?.[field] ?? null;
    await db.execute(
      `UPDATE places SET
         name_vi        = COALESCE(name_vi, ?),
         description    = COALESCE(description, ?),
         description_vi = COALESCE(description_vi, ?),
         image          = COALESCE(image, ?),
         wikipedia      = COALESCE(wikipedia, ?)
       WHERE id = ?`,
      [donor("name_vi"), donor("description"), donor("description_vi"),
       donor("image"), donor("wikipedia"), keeper.id]
    );

    const loserIds = losers.map((l) => l.id);
    await db.execute(
      `UPDATE places SET is_active = 0 WHERE id IN (${loserIds.map(() => "?").join(",")})`,
      loserIds
    );
    deactivated += loserIds.length;
    console.log(
      `[PlaceDedupe] Giữ #${keeper.id} "${keeper.name_vi || keeper.name}" — tắt ${loserIds.length} bản trùng: ` +
      losers.map((l) => `#${l.id} "${l.name}"`).join(", ")
    );
  }

  console.log(`[PlaceDedupe] Hoàn thành — tắt ${deactivated} bản trùng`);
  return deactivated;
};

module.exports = { dedupeAllPlaces };
