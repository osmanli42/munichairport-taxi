'use client';

// System tab: report when a customer opens the "Buchung eingegangen" mail (1×1 open pixel,
// backend/src/routes/mail-open.ts). Notification goes out as a free WhatsApp (CallMeBot),
// not by e-mail — no Resend quota. Off by default (legal: open tracking needs consent).
import { useEffect, useState } from 'react';
import { MailOpen, AlertTriangle } from 'lucide-react';
import { adminApi, settingsApi } from '@/lib/api';

export default function MailOpenCard() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.getAll().then((s) => setOn(s.mail_open_tracking_enabled === '1')).catch(() => setOn(false));
  }, []);

  async function toggle() {
    if (on == null) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateSettings({ mail_open_tracking_enabled: on ? '0' : '1' });
      setOn(updated?.mail_open_tracking_enabled === '1');
    } catch { /* keep state */ }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MailOpen size={18} className="text-gray-700" />
            <h3 className="font-bold text-gray-900 text-lg">Buchungsmail geöffnet → WhatsApp</h3>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl">
            Öffnet ein Kunde die Mail „Buchung eingegangen“, kommt einmalig eine WhatsApp an Sie
            (gleicher Kanal wie „Neue Buchung“, <b>kein Resend-Kontingent</b>). Im Buchungsdetail steht
            „E-Mail geöffnet · Uhrzeit“. Gilt für Buchungen, die nach dem Einschalten eingehen.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving || on == null}
          className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
          aria-label="E-Mail-Öffnung melden"
        >
          <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-7' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-2xl">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          <b>Apple Mail (iPhone)</b> lädt Bilder oft automatisch direkt nach der Zustellung — dann kommt die
          Meldung, obwohl der Kunde die Mail noch nicht gelesen hat (in der WhatsApp steht dann
          „evtl. automatisch geladen“). Gmail/Outlook melden nur echtes Öffnen.
          <b> Rechtlich</b> gilt das Messen von Mail-Öffnungen in Deutschland als einwilligungspflichtig (TTDSG §25).
        </span>
      </div>
    </div>
  );
}
