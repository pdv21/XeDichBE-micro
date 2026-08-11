const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('@xedich/shared');
const app = express();

app.set('trust proxy', 1);

const flightRoutes = require('./modules/flight/flight.route');

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(morgan('[transport-service] :method :url :status :response-time ms - :remote-addr'));

app.get('/health', (req, res) => res.json({ service: 'transport-service', status: 'ok' }));

app.use('/flights', flightRoutes);

app.use(errorHandler);

module.exports = app;
