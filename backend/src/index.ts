import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import flightRoutes from './routes/flights';
import airportRoutes from './routes/airports';
import geoRoutes from './routes/geo';
import trackRoutes from './routes/track';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET'],
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/config', (_req, res) => {
  res.json({ version: '1.0.0' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/flights', flightRoutes);
app.use('/api/airports', airportRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/track', trackRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[Airspace Explorer] Backend running on port ${PORT}`);
});
