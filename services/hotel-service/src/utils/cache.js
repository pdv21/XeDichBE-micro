const store = new Map();

const getOrSet = async (key, ttlMs, fn) => {
    const hit = store.get(key);
    if (hit && Date.now() - hit.createdAt < ttlMs) {
        return hit.value;
    }

    const value = await fn();
    store.set(key, { value, createdAt: Date.now() });
    return value;
};

module.exports = { getOrSet };
