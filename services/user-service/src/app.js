const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { errorHandler } = require('@xedich/shared');
const app = express();

app.set('trust proxy', 1);

const authRoutes = require('./modules/auth/auth.route');
const userRoutes = require('./modules/user/user.route');
const userInternalRoutes = require('./modules/user/internal.route');

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(morgan('[user-service] :method :url :status :response-time ms - :remote-addr'));

app.get('/health', (req, res) => res.json({ service: 'user-service', status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/internal/users', userInternalRoutes);

app.use(errorHandler);

module.exports = app;
