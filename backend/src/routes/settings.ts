import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

interface SettingRow {
  setting_key: string;
  setting_value: string;
}

// GET /api/settings - Get all settings (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<SettingRow>('SELECT setting_key, setting_value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of rows) {
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

    const allowedKeys = ['stadtfahrt_enabled', 'anfahrt_price_per_km', 'zwischenstopp_enabled'];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;

      if ((key === 'stadtfahrt_enabled' || key === 'zwischenstopp_enabled') && !['0', '1'].includes(String(value))) {
        res.status(400).json({ error: `${key} must be 0 or 1` });
        return;
      }

      if (key === 'anfahrt_price_per_km') {
        const num = parseFloat(String(value));
        if (isNaN(num) || num < 0) {
          res.status(400).json({ error: 'anfahrt_price_per_km must be a positive number' });
          return;
        }
      }

      await run(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
        [key, String(value), String(value)]
      );
    }

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
