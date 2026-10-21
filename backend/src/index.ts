import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeDatabase, testConnection } from './db';
import bookingsRouter from './routes/bookings';
import adminRouter from './routes/admin';
import pricesRouter from './routes/prices';
import mapsRouter from './routes/maps';
import settingsRouter from './routes/settings';
import promotionsRouter from './routes/promotions';
import autoDiscountsRouter from './routes/auto-discounts';
import trackingRouter from './routes/tracking';
import driverTrackingRouter from './routes/driver-tracking';
import driverAppRouter from './routes/driver-app';
import traccarRouter from './routes/traccar';
import adminTrackingRouter from './routes/admin-tracking';
import admin2faRouter from './routes/admin-2fa';
import bookingConfirmRouter from './routes/booking-confirm';
import mailOpenRouter from './routes/mail-open';
import adminDashboardRouter from './routes/admin-dashboard';
import adminSeoRouter from './routes/admin-seo';
import { startSeoJobs } from './services/seo/jobs';
import adminDashboardWidgetsRouter from './routes/admin-dashboard-widgets';
import recordingRouter, { startRecordingRetentionJob } from './routes/recording';
import systemRouter, { startSystemAlertJob } from './routes/system';
import securityRouter from './routes/security';
import adsRouter from './routes/ads';
import adsV2Router from './routes/ads-v2';
import adsScriptRouter from './routes/ads-script';
import callbacksRouter from './routes/callbacks';
import plzSurchargesRouter from './routes/plz-surcharges';
import pflichtgebietRouter from './routes/pflichtgebiet';
import fixedRoutesRouter from './routes/fixed-routes';
import flightsRouter from './routes/flights';
import companyRouter from './routes/company';
import adminCompaniesRouter from './routes/admin-companies';
import adminCalendarRouter from './routes/admin-calendar';
import popularRoutesRouter from './routes/popular-routes';
import liveAssistRouter from './routes/liveAssist';
import invoiceCustomersRouter from './routes/invoiceCustomers';
import { startReminderJob } from './services/reminderJob';
import { startHealthMonitorJob } from './services/healthMonitor';
import { startAdsAlertJob } from './services/adsAlertJob';
import { startAutoStatusJob } from './services/autoStatusJob';
import { startAutoRechnungJob } from './services/autoRechnungJob';
import { startCardChargeReminderJob } from './services/cardChargeReminder';
import { startCalendarRideAlertJob } from './services/calendarRideAlert';
import { startCalendarRidesJob } from './services/calendarRides';
import { startLeerfahrtJob } from './services/leerfahrt';
import { startLiveAssistAlertJob } from './services/liveAssistAlertJob';
import { startDriverTrackingJobs } from './services/driverTracking';
import { startConversionModelJob } from './services/conversionModel';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://flughafen-muenchen.taxi',
    'https://www.flughafen-muenchen.taxi',
    'https://munichairport-taxi.vercel.app',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB diagnostic
app.get('/api/db-test', async (req, res) => {
  const result = await testConnection();
  res.json(result);
});

// Email test (temporary)
app.get('/api/smtp-test', async (req, res) => {
  try {
    const { Resend } = await import('resend');
    const r = new Resend(process.env.RESEND_API_KEY);
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
// Admin data and every PDF (invoices, Storno, proforma) are per-user and change over time under the
// same URL (e.g. …/rechnung.pdf after a re-issue). Cloudflare adds a 4 h browser cache to .pdf by
// default, so the browser kept showing the old invoice — never let these be cached anywhere.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/admin') || /\.pdf$/i.test(req.path) || req.path.startsWith('/company')) {
    res.set('Cache-Control', 'private, no-store, max-age=0');
  }
  next();
});
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin/2fa', admin2faRouter);
app.use('/api/booking-confirm', bookingConfirmRouter);
app.use('/api/mail-open', mailOpenRouter);
app.use('/api/admin/dashboard-widgets', adminDashboardWidgetsRouter);
app.use('/api/admin/dashboard', adminDashboardRouter);
app.use('/api/admin/seo2', adminSeoRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/ads/v2', adsV2Router);
app.use('/api/ads-script', adsScriptRouter);
app.use('/api/admin/ads', adsRouter);
app.use('/api', callbacksRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/auto-discounts', autoDiscountsRouter);
app.use('/api/plz-surcharges', plzSurchargesRouter);
app.use('/api/pflichtgebiet', pflichtgebietRouter);
app.use('/api/fixed-routes', fixedRoutesRouter);
app.use('/api/flights', flightsRouter);
app.use('/api/company', companyRouter);
app.use('/api/admin/companies', adminCompaniesRouter);
app.use('/api/admin/calendar', adminCalendarRouter);
app.use('/api/popular-routes', popularRoutesRouter);
app.use('/api/tracking', driverTrackingRouter);
app.use('/api/driver-app', driverAppRouter);
app.use('/api/traccar', traccarRouter);
app.use('/api/admin/tracking', adminTrackingRouter);
app.use('/api', trackingRouter);
app.use('/api', recordingRouter);
app.use('/api', invoiceCustomersRouter);
app.use('/api', systemRouter);
app.use('/api', securityRouter);
app.use('/api', liveAssistRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server first, then initialize database and cron jobs
app.listen(PORT, () => {
  console.log(`Munich Airport Taxi API running on port ${PORT}`);
  initializeDatabase()
    .then(() => {
      console.log('Database ready.');
      startReminderJob();
      startSystemAlertJob();
      startHealthMonitorJob();
      startAdsAlertJob();
      startAutoStatusJob();
      startAutoRechnungJob();
      startCardChargeReminderJob();
      startSeoJobs();
      startCalendarRidesJob();
      startLeerfahrtJob();
      startCalendarRideAlertJob();
      startLiveAssistAlertJob();
      startDriverTrackingJobs();
      startRecordingRetentionJob();
      startConversionModelJob();
    })
    .catch((err) => console.error('Database init warning:', err.message));
});

export default app;
