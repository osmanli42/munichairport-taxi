// Admin 2FA management (System tab → "İki adımlı doğrulama"). The login side lives in
// routes/admin.ts (POST /login and /login/2fa). 2FA is opt-in per admin account.

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest, bustTokenVersionCache, generateToken, checkTotpRateLimit, resetTotpAttempts } from '../middleware/auth';
import {
  generateSecret, encryptSecret, decryptSecret, verifyCode, otpauthUrl, qrDataUrl,
  generateRecoveryCodes, hashRecoveryCodes, recoveryCodesLeft,
} from '../services/adminTotp';
import { getClientIp } from '../utils/ipGeo';

const router = Router();
router.use(authenticateAdmin);

interface Row {
  id: number;
  username: string;
  password_hash: string;
  token_version: number;
  totp_enabled: number;
  totp_secret_enc: string | null;
  totp_pending_enc: string | null;
  totp_last_step: number | null;
  totp_recovery_hashes: string | null;
  totp_enabled_at: string | null;
}

async function loadAdmin(id: number | undefined): Promise<Row | null> {
  if (!id) return null;
  const [row] = await query<Row>('SELECT * FROM admin_users WHERE id = ?', [id]);
  return row || null;
}

function lastStep(a: Row): number | null {
  return a.totp_last_step == null ? null : Number(a.totp_last_step);
}

// GET /api/admin/2fa/status
router.get('/status', async (req: AuthRequest, res: Response) => {
  const a = await loadAdmin(req.adminId);
  if (!a) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({
    enabled: Number(a.totp_enabled) === 1,
    enabled_at: a.totp_enabled_at,
    recovery_codes_left: recoveryCodesLeft(a.totp_recovery_hashes),
    username: a.username,
  });
});

// POST /api/admin/2fa/setup — new secret (kept as "pending" until a code confirms it)
router.post('/setup', async (req: AuthRequest, res: Response) => {
  try {
    const a = await loadAdmin(req.adminId);
    if (!a) { res.status(404).json({ error: 'not_found' }); return; }
    if (Number(a.totp_enabled) === 1) { res.status(409).json({ error: '2FA ist bereits aktiv.' }); return; }
    const secret = generateSecret();
    await run('UPDATE admin_users SET totp_pending_enc = ? WHERE id = ?', [encryptSecret(secret), a.id]);
    const url = otpauthUrl(secret, a.username);
    res.json({ secret, otpauth_url: url, qr: await qrDataUrl(url) });
  } catch (e: any) {
    console.error('[2fa] setup failed:', e.message);
    res.status(500).json({ error: '2FA-Einrichtung fehlgeschlagen.' });
  }
});

// POST /api/admin/2fa/enable { code } — confirms the pending secret, returns recovery codes once
router.post('/enable', async (req: AuthRequest, res: Response) => {
  const rlKey = `totp:${req.adminId}`;
  if (!checkTotpRateLimit(rlKey)) { res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.' }); return; }
  const a = await loadAdmin(req.adminId);
  if (!a) { res.status(404).json({ error: 'not_found' }); return; }
  if (Number(a.totp_enabled) === 1) { res.status(409).json({ error: '2FA ist bereits aktiv.' }); return; }
  if (!a.totp_pending_enc) { res.status(400).json({ error: 'Bitte zuerst den QR-Code erzeugen.' }); return; }

  const secret = decryptSecret(a.totp_pending_enc);
  const step = verifyCode(secret, String(req.body.code || ''), null);
  if (step === null) { res.status(400).json({ error: 'Code ungültig. Bitte den aktuellen Code aus der App eingeben.' }); return; }

  const codes = generateRecoveryCodes();
  await run(
    `UPDATE admin_users SET totp_enabled = 1, totp_secret_enc = ?, totp_pending_enc = NULL,
       totp_last_step = ?, totp_recovery_hashes = ?, totp_enabled_at = NOW() WHERE id = ?`,
    [encryptSecret(secret), step, await hashRecoveryCodes(codes), a.id]
  );
  resetTotpAttempts(rlKey);
  console.log(`[security] admin 2FA enabled: user=${a.username} ip=${getClientIp(req)}`);
  res.json({ success: true, recovery_codes: codes });
});

// POST /api/admin/2fa/disable { password, code } — also logs out every session and device
router.post('/disable', async (req: AuthRequest, res: Response) => {
  const rlKey = `totp:${req.adminId}`;
  if (!checkTotpRateLimit(rlKey)) { res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.' }); return; }
  const a = await loadAdmin(req.adminId);
  if (!a) { res.status(404).json({ error: 'not_found' }); return; }
  if (Number(a.totp_enabled) !== 1 || !a.totp_secret_enc) { res.status(409).json({ error: '2FA ist nicht aktiv.' }); return; }
  if (!(await bcrypt.compare(String(req.body.password || ''), a.password_hash))) {
    res.status(401).json({ error: 'Passwort falsch.' }); return;
  }
  const step = verifyCode(decryptSecret(a.totp_secret_enc), String(req.body.code || ''), lastStep(a));
  if (step === null) { res.status(400).json({ error: 'Code ungültig.' }); return; }

  const nextVersion = (Number(a.token_version) || 0) + 1;
  await run(
    `UPDATE admin_users SET totp_enabled = 0, totp_secret_enc = NULL, totp_pending_enc = NULL,
       totp_last_step = NULL, totp_recovery_hashes = NULL, totp_enabled_at = NULL, token_version = ? WHERE id = ?`,
    [nextVersion, a.id]
  );
  bustTokenVersionCache(a.id);
  resetTotpAttempts(rlKey);
  console.log(`[security] admin 2FA disabled: user=${a.username} ip=${getClientIp(req)}`);
  res.json({ success: true, token: generateToken(a.id, a.username, nextVersion) });
});

// POST /api/admin/2fa/recovery-codes { code } — replaces all recovery codes
router.post('/recovery-codes', async (req: AuthRequest, res: Response) => {
  const rlKey = `totp:${req.adminId}`;
  if (!checkTotpRateLimit(rlKey)) { res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.' }); return; }
  const a = await loadAdmin(req.adminId);
  if (!a) { res.status(404).json({ error: 'not_found' }); return; }
  if (Number(a.totp_enabled) !== 1 || !a.totp_secret_enc) { res.status(409).json({ error: '2FA ist nicht aktiv.' }); return; }
  const step = verifyCode(decryptSecret(a.totp_secret_enc), String(req.body.code || ''), lastStep(a));
  if (step === null) { res.status(400).json({ error: 'Code ungültig.' }); return; }

  const codes = generateRecoveryCodes();
  await run('UPDATE admin_users SET totp_recovery_hashes = ?, totp_last_step = ? WHERE id = ?', [await hashRecoveryCodes(codes), step, a.id]);
  resetTotpAttempts(rlKey);
  res.json({ success: true, recovery_codes: codes });
});

export default router;
