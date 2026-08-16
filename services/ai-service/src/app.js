const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('@xedich/shared');
const app = express();

app.set('trust proxy', 1);

const aiRoutes = require('./modules/ai/ai.route');

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(morgan('[ai-service] :method :url :status :response-time ms - :remote-addr'));

app.get('/health', (req, res) => res.json({ service: 'ai-service', status: 'ok' }));

// Không có route public nào khác — ai-service chỉ phục vụ nội bộ (không mount
// qua API Gateway), bảo vệ thêm bằng requireInternalKey bên trong ai.route.js.
app.use('/ai', aiRoutes);

app.use(errorHandler);

module.exports = app;
