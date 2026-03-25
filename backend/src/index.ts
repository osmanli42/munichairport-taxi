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

// Email test (temporary)
app.get('/api/smtp-test', async (req, res) => {
  try {
    const { Resend } = await import('resend');
    const r = new Resend(process.env.RESEND_API_KEY || 're_fLtaXc2i_KSwkQA9PQduHyfhjq1m8B2Nn');
    const to = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'info@flughafen-muenchen.taxi';
    const result = await r.emails.send({
      from: 'Munich Airport Taxi <info@flughafen-muenchen.taxi>',
      to,
      subject: 'Test Email - Munich Airport Taxi',
      html: '<h1>Email çalışıyor! ✅</h1><p>Bu bir test emailidir.</p>',
    });
    res.json({ status: 'OK', to, result });
  } catch (err: any) {
    res.json({ status: 'FAILED', error: err.message, stack: err.stack?.substring(0, 200) });
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
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Munich Airport Taxi API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default app;
