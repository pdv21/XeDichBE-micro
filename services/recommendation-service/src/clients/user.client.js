const { createServiceClient } = require("@xedich/shared");

const client = createServiceClient(process.env.USER_SERVICE_URL);

// Thay cho require("user/user.service").getPreferences trực tiếp lúc còn
// monolith — gọi route nội bộ GET /internal/users/:id/preferences.
const getPreferences = async (userId) => {
  const { data } = await client.get(`/internal/users/${userId}/preferences`);
  return data.data;
};

module.exports = { getPreferences };
