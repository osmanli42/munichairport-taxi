import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

// Security card in the System tab. The checks themselves run outside this app, in the
// root watchdog /usr/local/sbin/sec-watch (systemd timer, every 5 min, set up after the
// Oct 2026 break-in) — it writes status.json and mails on its own. This router only
// reads that file and can trigger a run or accept a change the admin made.
const router = Router();

const SEC_WATCH_DIR = process.env.SEC_WATCH_DIR || '/var/lib/sec-watch';
const SEC_WATCH_BIN = '/usr/local/sbin/sec-watch';
const STALE_AFTER_SEC = 15 * 60; // timer runs every 5 min
// Findings that only mean "differs from the accepted state" — the admin can accept these.
// Everything else (hidden process, miner, password login, …) can't be waved through here.
const ACCEPTABLE = new Set(['ssh_keys', 'cron', 'units', 'profile', 'uid0']);
let busy = false;

function readStatus() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(SEC_WATCH_DIR, 'status.json'), 'utf8'));
    const age = Math.round(Date.now() / 1000 - Number(raw.checked_at || 0));
    return { available: true, stale: age > STALE_AFTER_SEC, age_sec: age, ...raw };
  } catch {
    return { available: false };
  }
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 90_000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message).slice(0, 300)));
      else resolve();
    });
  });
}

function onServer(): boolean {
  return fs.existsSync(SEC_WATCH_BIN);
}

router.get('/admin/security', authenticateAdmin, (_req: AuthRequest, res: Response) => {
  res.json(readStatus());
});

// Run the checks now (systemctl start waits for the oneshot service to finish).
router.post('/admin/security/run', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  if (!onServer()) { res.status(409).json({ error: 'Bu işlem sadece sunucuda çalışır.' }); return; }
  if (busy) { res.status(409).json({ error: 'Kontrol zaten sürüyor.' }); return; }
  busy = true;
  try {
    await run('systemctl', ['start', 'sec-watch.service']);
    res.json(readStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Kontrol başarısız' });
  } finally {
    busy = false;
  }
});

// "Bu değişikliği ben yaptım": take the current SSH keys / cron / services / shell files as
// the new normal, then re-check. Same as `sec-watch --rebaseline` on the server.
router.post('/admin/security/accept', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  if (!onServer()) { res.status(409).json({ error: 'Bu işlem sadece sunucuda çalışır.' }); return; }
  const cur: any = readStatus();
  const keys: string[] = (cur.findings || []).map((f: any) => f.key);
  if (!keys.some((k) => ACCEPTABLE.has(k))) {
    res.status(400).json({ error: 'Onaylanacak bir değişiklik yok.' });
    return;
  }
  if (busy) { res.status(409).json({ error: 'Kontrol zaten sürüyor.' }); return; }
  busy = true;
  try {
    console.log(`[security] ${req.adminUsername || 'admin'} accepted: ${keys.filter((k) => ACCEPTABLE.has(k)).join(', ')}`);
    await run(SEC_WATCH_BIN, ['--rebaseline']);
    await run('systemctl', ['start', 'sec-watch.service']);
    res.json(readStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Onaylanamadı' });
  } finally {
    busy = false;
  }
});

export default router;
