import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db';
import bookingsRouter from './routes/bookings';
import adminRouter from './routes/admin';
import pricesRouter from './routes/prices';
import mapsRouter from './routes/maps';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://flughafen-muenchen.taxi',
    'https://www.flughafen-muenchen.taxi',
    'https://munichairport-taxi.vercel.app',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SMTP debug (temporary)
app.get('/api/smtp-test', async (req, res) => {
  const nodemailer = require('nodemailer');
  const config = {
    host: process.env.SMTP_HOST || 'not set',
    port: process.env.SMTP_PORT || 'not set',
    secure: process.env.SMTP_SECURE || 'not set',
    user: process.env.SMTP_USER || 'not set',
    pass_len: (process.env.SMTP_PASS || '').length,
  };
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.verify();
    res.json({ smtp: 'OK', config });
  } catch (err: any) {
    res.json({ smtp: 'FAILED', error: err.message, config });
  }
});

// Routes
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/maps', mapsRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Munich Airport Taxi API running on port ${PORT}`);
});

export default app;
