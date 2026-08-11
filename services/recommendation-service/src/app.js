const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { errorHandler } = require('@xedich/shared');
const app = express();

app.set('trust proxy', 1);

const placeRoutes = require('./modules/place/place.route');
const tripRoutes = require('./modules/trip/trip.route');
const jobRoutes = require('./modules/itinerary/job.route');
const locationRoutes = require('./modules/location/location.route');
const locationInternalRoutes = require('./modules/location/internal.route');

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(morgan('[recommendation-service] :method :url :status :response-time ms - :remote-addr'));

app.get('/health', (req, res) => res.json({ service: 'recommendation-service', status: 'ok' }));

app.use('/places', placeRoutes);
app.use('/trips', tripRoutes);
app.use('/jobs', jobRoutes);
app.use('/locations', locationRoutes);
app.use('/internal/locations', locationInternalRoutes);

app.use(errorHandler);

module.exports = app;
