import cron from 'node-cron';
import { query } from '../db';
import { sendReminderEmail, BookingNotificationData } from './notifications';

let lastRunDate = '';

export function startReminderJob(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const [enabledRow] = await query<{ setting_value: string }>(
        "SELECT setting_value FROM settings WHERE setting_key = 'reminder_enabled'"
      );
      if (enabledRow?.setting_value !== 'true') return;

      const [timeRow] = await query<{ setting_value: string }>(
        "SELECT setting_value FROM settings WHERE setting_key = 'reminder_time'"
      );
      const [targetH, targetM] = (timeRow?.setting_value || '18:00').split(':');
      const now = new Date();
      if (now.getHours() !== +targetH || now.getMinutes() !== +targetM) return;

      const today = now.toDateString();
      if (lastRunDate === today) return;
      lastRunDate = today;

      console.log('[Reminder] Yarınki fahrtlar kontrol ediliyor...');
      const bookings = await query<BookingNotificationData>(
        `SELECT * FROM bookings
         WHERE DATE(pickup_datetime) = DATE(DATE_ADD(NOW(), INTERVAL 1 DAY))
         AND status NOT IN ('cancelled', 'storniert')
         ORDER BY pickup_datetime ASC`
      );
      console.log(`[Reminder] ${bookings.length} fahrt bulundu`);

      for (const booking of bookings) {
        try {
          await sendReminderEmail(booking);
          console.log(`[Reminder] Gönderildi: ${booking.booking_number} → ${booking.email}`);
        } catch (err: any) {
          console.error(`[Reminder] HATA: ${booking.booking_number}`, err?.message);
        }
      }
    } catch (err: any) {
      console.error('[Reminder] Cron hatası:', err?.message);
    }
  });

  console.log('[Reminder] Cron job başlatıldı — her dakika kontrol, ayarlanan saatte gönderim');
}
