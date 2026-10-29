import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { invalidateVisitorDistanceCache } from '../services/visitorDistance';
import { invalidateDemandCache } from '../services/demandPace';
import { berlinNowSql } from '../utils/berlinTime';

const router = Router();

interface SettingRow {
  setting_key: string;
  setting_value: string;
}

// Nur fürs Admin-Panel (E-Mail-Adressen) — nicht in der öffentlichen Liste
const PRIVATE_KEYS = ['night_confirm_partner_email', 'night_cancel_partner_email', 'partner_cover_email', 'partner_cover_hours', 'partner_cover_start',
  // Kosten für die Statistik „Uns bleibt“ (Fahreranteil, Diesel, Partner) — nicht öffentlich
  'cost_driver_share_pct', 'cost_fuel_l_per_100km', 'cost_fuel_eur_per_l', 'cost_partner_drivers', 'cost_fixed_monthly', 'cost_own_drivers'];

// GET /api/settings/private - Admin-only settings
router.get('/private', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await query<SettingRow>(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${PRIVATE_KEYS.map(() => '?').join(',')})`,
      PRIVATE_KEYS
    );
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.setting_key] = row.setting_value;
    res.json(settings);
  } catch (error) {
    console.error('Private settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// GET /api/settings - Get all settings (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<SettingRow>('SELECT setting_key, setting_value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (PRIVATE_KEYS.includes(row.setting_key)) continue;
      settings[row.setting_key] = row.setting_value;
    }
    res.json(settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings (admin only)
router.put('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const allowedKeys = ['stadtfahrt_enabled', 'anfahrt_price_per_km', 'zwischenstopp_enabled', 'plz_surcharge_enabled', 'min_advance_hours', 'night_confirm_enabled', 'night_confirm_start', 'night_confirm_end', 'night_confirm_ride_until', 'flight_validation_enabled', 'phone_validation_enabled', 'portal_tracking_enabled', 'b2b_applications_enabled', 'auto_status_enabled', 'auto_confirm_hours', 'auto_complete_buffer_minutes', 'auto_complete_include_company_charge', 'experiment_checkout_v2', 'social_proof_enabled', 'auto_discounts_enabled', 'auto_discount_ignore_pg_floor', 'auto_discount_show_in_email', 'auto_discount_red_badge_enabled', 'auto_discount_countdown_enabled', 'auto_discount_banner_enabled', 'auto_discount_remaining_enabled', 'auto_discount_vpn_as_unknown', 'auto_rechnung_card_enabled', 'auto_rechnung_cash_enabled', 'stats_include_calendar', 'month_end_invoice_reminder', 'booking_form_restore_enabled', 'address_poi_enabled', 'night_cancel_enabled', 'night_cancel_start', 'night_cancel_end', 'demand_discount_enabled', 'demand_min_expected', 'demand_horizon_days', 'gap_discount_enabled', 'leer_discount_enabled', 'mail_open_tracking_enabled', 'cookie_banner_style', 'night_confirm_partner_email', 'night_cancel_partner_email', 'partner_cover_email', 'partner_cover_hours', 'partner_cover_start', 'cost_driver_share_pct', 'cost_fuel_l_per_100km', 'cost_fuel_eur_per_l', 'cost_partner_drivers', 'cost_fixed_monthly', 'cost_own_drivers', 'booking_edit_enabled', 'booking_edit_hours', 'booking_edit_admin_mail', 'booking_edit_admin_whatsapp', 'booking_edit_customer_mail', 'return_address_enabled'];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;

      // A/B rollout percentage: 'off' or an integer 0-100 (% of visitors in variant B).
      if (key === 'experiment_checkout_v2' && String(value) !== 'off') {
        const num = parseInt(String(value), 10);
        if (isNaN(num) || num < 0 || num > 100) {
          res.status(400).json({ error: `${key} must be 'off' or an integer between 0 and 100` });
          return;
        }
      }

      if ((key === 'stadtfahrt_enabled' || key === 'zwischenstopp_enabled' || key === 'plz_surcharge_enabled' || key === 'night_confirm_enabled' || key === 'flight_validation_enabled' || key === 'phone_validation_enabled' || key === 'portal_tracking_enabled' || key === 'b2b_applications_enabled' || key === 'auto_status_enabled' || key === 'auto_complete_include_company_charge' || key === 'auto_discounts_enabled' || key === 'auto_discount_ignore_pg_floor' || key === 'auto_discount_show_in_email' || key === 'auto_discount_red_badge_enabled' || key === 'auto_discount_countdown_enabled' || key === 'auto_discount_banner_enabled' || key === 'auto_discount_remaining_enabled' || key === 'auto_discount_vpn_as_unknown' || key === 'auto_rechnung_card_enabled' || key === 'auto_rechnung_cash_enabled' || key === 'stats_include_calendar' || key === 'month_end_invoice_reminder' || key === 'booking_form_restore_enabled' || key === 'address_poi_enabled' || key === 'night_cancel_enabled' || key === 'demand_discount_enabled' || key === 'gap_discount_enabled' || key === 'leer_discount_enabled' || key === 'mail_open_tracking_enabled' || key === 'booking_edit_enabled' || key === 'booking_edit_admin_mail' || key === 'booking_edit_admin_whatsapp' || key === 'booking_edit_customer_mail' || key === 'return_address_enabled') && !['0', '1'].includes(String(value))) {
        res.status(400).json({ error: `${key} must be 0 or 1` });
        return;
      }
      // Cookie-Banner: Popup (mittig, Seite abgedunkelt) oder unten (Seite bleibt benutzbar)
      if (key === 'cookie_banner_style' && !['popup', 'bottom'].includes(String(value))) {
        res.status(400).json({ error: 'cookie_banner_style must be popup or bottom' });
        return;
      }

      if (key === 'demand_min_expected' || key === 'demand_horizon_days') {
        const num = Number(value);
        const max = key === 'demand_horizon_days' ? 60 : 50;
        if (!Number.isFinite(num) || num < 1 || num > max) {
          res.status(400).json({ error: `${key} must be between 1 and ${max}` });
          return;
        }
      }

      // Kosten (Statistik „Uns bleibt“): Prozent 0–100, Verbrauch 0–50 L/100 km, Diesel 0–10 €/L
      const costRange: Record<string, [number, number]> = { cost_driver_share_pct: [0, 100], cost_fuel_l_per_100km: [0, 50], cost_fuel_eur_per_l: [0, 10] };
      if (key in costRange) {
        const num = parseFloat(String(value).replace(',', '.'));
        const [lo, hi] = costRange[key];
        if (isNaN(num) || num < lo || num > hi) {
          res.status(400).json({ error: `${key} must be between ${lo} and ${hi}` });
          return;
        }
      }
      // Monatliche Fixkosten: JSON [{ name, amount }], max. 20 Posten
      if (key === 'cost_fixed_monthly') {
        let list: any;
        try { list = JSON.parse(String(value)); } catch { list = null; }
        const ok = Array.isArray(list) && list.length <= 20 && list.every((x: any) =>
          x && typeof x.name === 'string' && x.name.length <= 40 && Number.isFinite(Number(x.amount)) && Number(x.amount) >= 0 && Number(x.amount) <= 100000);
        if (!ok) { res.status(400).json({ error: 'cost_fixed_monthly: Liste [{ name, amount }] erwartet (max. 20)' }); return; }
      }
      if ((key === 'cost_partner_drivers' || key === 'cost_own_drivers') && String(value).length > 300) {
        res.status(400).json({ error: 'cost_partner_drivers too long' });
        return;
      }

      if (key === 'anfahrt_price_per_km') {
        const num = parseFloat(String(value));
        if (isNaN(num) || num < 0) {
          res.status(400).json({ error: 'anfahrt_price_per_km must be a positive number' });
          return;
        }
      }

      if (key === 'min_advance_hours') {
        const num = parseFloat(String(value));
        if (isNaN(num) || num < 0) {
          res.status(400).json({ error: 'min_advance_hours must be a positive number' });
          return;
        }
      }

      // Änderungsfrist „Buchung verwalten“: 0–72 Stunden vor der Abholung
      if (key === 'booking_edit_hours') {
        const num = parseFloat(String(value).replace(',', '.'));
        if (isNaN(num) || num < 0 || num > 72) {
          res.status(400).json({ error: 'booking_edit_hours must be a number between 0 and 72' });
          return;
        }
      }

      if (key === 'night_confirm_start' || key === 'night_confirm_end') {
        const num = parseInt(String(value), 10);
        if (isNaN(num) || num < 0 || num > 24) {
          res.status(400).json({ error: `${key} must be an integer between 0 and 24` });
          return;
        }
      }

      if (key === 'night_confirm_ride_until') {
        const num = parseInt(String(value), 10);
        if (isNaN(num) || num < 0 || num > 24) {
          res.status(400).json({ error: 'night_confirm_ride_until must be an integer between 0 and 24' });
          return;
        }
      }

      if (key === 'night_confirm_partner_email' || key === 'night_cancel_partner_email' || key === 'partner_cover_email') {
        // leer = keine Partner-Mail; mehrere Adressen mit Komma getrennt
        const list = String(value).split(',').map(v => v.trim()).filter(Boolean);
        if (list.some(v => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v))) {
          res.status(400).json({ error: `${key} must be a valid email address` });
          return;
        }
        const stored = list.join(', ');
        await run(
          `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
          [key, stored, stored]
        );
        continue;
      }

      if (key === 'partner_cover_hours') {
        const num = parseInt(String(value), 10);
        if (isNaN(num) || num < 1 || num > 72 || String(num) !== String(value).trim()) {
          res.status(400).json({ error: 'partner_cover_hours must be an integer between 1 and 72' });
          return;
        }
      }

      // Partner-Vertretung starten ('now' → Serverzeit) oder beenden ('')
      if (key === 'partner_cover_start') {
        if (!['now', ''].includes(String(value))) {
          res.status(400).json({ error: "partner_cover_start must be 'now' or ''" });
          return;
        }
        const stored = String(value) === 'now' ? String(Date.now()) : '';
        await run(
          `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
          [key, stored, stored]
        );
        continue;
      }

      if (key === 'night_cancel_start' || key === 'night_cancel_end') {
        if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(value))) {
          res.status(400).json({ error: `${key} must be a time HH:MM` });
          return;
        }
      }

      if (key === 'auto_confirm_hours') {
        const num = parseFloat(String(value));
        if (isNaN(num) || num < 0) {
          res.status(400).json({ error: 'auto_confirm_hours must be a positive number' });
          return;
        }
      }

      if (key === 'auto_complete_buffer_minutes') {
        const num = parseInt(String(value), 10);
        if (isNaN(num) || num < 0) {
          res.status(400).json({ error: 'auto_complete_buffer_minutes must be a non-negative integer' });
          return;
        }
      }

      // Auto-invoice by payment method: stamp the moment a switch goes 0 → 1. autoRechnungJob
      // only invoices rides that end after this stamp, so switching it on never mails the
      // whole backlog of old cash/card rides that were never invoiced. Written server-side
      // only (the *_since keys are not in allowedKeys) and left alone on repeated saves of
      // an already-on switch, so the cut-off can't drift.
      if ((key === 'auto_rechnung_card_enabled' || key === 'auto_rechnung_cash_enabled') && String(value) === '1') {
        const [current] = await query<SettingRow>('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
        if (current?.setting_value !== '1') {
          const sinceKey = key.replace('_enabled', '_since');
          const since = berlinNowSql();
          await run(
            `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
            [sinceKey, since, since]
          );
        }
      }

      await run(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
        [key, String(value), String(value)]
      );
    }

    // VPN-Schalter wirkt sofort, nicht erst nach Ablauf des 60-Sekunden-Caches.
    invalidateVisitorDistanceCache();
    // Ruhiger-Tag-Hauptschalter und -Parameter ebenfalls sofort
    invalidateDemandCache();

    // Return updated settings
    const rows = await query<SettingRow>('SELECT setting_key, setting_value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }
    res.json(settings);
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
