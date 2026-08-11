const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { requireInternalKey } = require('@xedich/shared');

router.use(requireInternalKey);

// Gọi bởi recommendation-service (thay cho require("user/user.service") trực
// tiếp lúc còn monolith) khi sinh lịch trình cần đọc sở thích của user.
router.get('/:id/preferences', userController.getPreferencesInternal);

module.exports = router;
