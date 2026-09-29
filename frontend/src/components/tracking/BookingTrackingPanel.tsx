'use client';

// "Fahrer & Live-Tracking" block in the admin booking modal: assign a driver (the choice
// stays visible when the modal is reopened), follow and correct the ride status, set the
// airport meeting point, and send the links — to the customer by e-mail/WhatsApp, to the
// driver as their personal app link.

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, MessageCircle, Mail, Plus, Satellite, AlertTriangle, MapPin, ExternalLink } from 'lucide-react';
import {
  adminTracking, AdminDriver, BookingTrackingPanelData, ApiError, berlinClock, pickupParts, waLink,
} from '@/lib/tracking';

interface BookingLite {
  id: number;
  booking_number: string;
  name: string;
  phone?: string | null;
  pickup_datetime: string;
  pickup_address: string;
  dropoff_address: string;
  language?: string | null;
}

const STEPS: { key: string; label: string }[] = [
  { key: 'assigned', label: 'Zugewiesen' },
  { key: 'enroute', label: 'Unterwegs' },
  { key: 'arrived', label: 'Angekommen' },
  { key: 'onboard', label: 'An Bord' },
  { key: 'completed', label: 'Beendet' },
];

const CHIP: Record<string, string> = {
  assigned: 'bg-gray-100 text-gray-700',
  enroute: 'bg-emerald-100 text-emerald-800',
  arrived: 'bg-sky-100 text-sky-800',
  onboard: 'bg-amber-100 text-amber-800',
  completed: 'bg-gray-200 text-gray-600',
};

function ageText(s: number | null): string {
  if (s == null) return '';
  if (s < 60) return `vor ${s} s`;
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  return `vor ${Math.round(s / 3600)} Std.`;
}

function driverMessage(lang: string, b: BookingLite, link: string): string {
  const { date, time } = pickupParts(b.pickup_datetime);
  if (lang === 'tr') return `Yeni yolculuk ${b.booking_number}: ${date} ${time}\n${b.pickup_address} → ${b.dropoff_address}\nŞoför uygulaman: ${link}`;
  if (lang === 'en') return `New ride ${b.booking_number}: ${date} ${time}\n${b.pickup_address} → ${b.dropoff_address}\nYour driver app: ${link}`;
  return `Neue Fahrt ${b.booking_number}: ${date} ${time} Uhr\n${b.pickup_address} → ${b.dropoff_address}\nDeine Fahrer-App: ${link}`;
}

function customerMessage(lang: string, b: BookingLite, link: string): string {
  const { date, time } = pickupParts(b.pickup_datetime);
  if (lang === 'en') return `Hello ${b.name}, you can follow your driver live on the day of your ride (${date}, ${time}): ${link}`;
  return `Hallo ${b.name}, hier können Sie Ihren Fahrer am Tag Ihrer Fahrt (${date}, ${time} Uhr) live verfolgen: ${link}`;
}

export default function BookingTrackingPanel({ booking }: { booking: BookingLite }) {
  const [panel, setPanel] = useState<BookingTrackingPanelData | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', vehicle_plate: '' });

  const load = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([adminTracking.booking(booking.id), adminTracking.drivers()]);
      setPanel(p);
      setDrivers(d.drivers);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Laden fehlgeschlagen');
    }
  }, [booking.id]);

  useEffect(() => {
    setPanel(null);
    setError('');
    setShowNew(false);
    load();
  }, [load]);

  // While the ride is live, keep the status line fresh.
  useEffect(() => {
    if (!panel || !['enroute', 'arrived', 'onboard'].includes(panel.status || '')) return;
    const id = setInterval(() => adminTracking.booking(booking.id).then(setPanel).catch(() => {}), 10_000);
    return () => clearInterval(id);
  }, [panel?.status, booking.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(key: string, fn: () => Promise<BookingTrackingPanelData | void>) {
    setBusy(key);
    setError('');
    try {
      const r = await fn();
      if (r) setPanel(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen');
    } finally {
      setBusy('');
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1800); }).catch(() => {});
  }

  async function createDriver() {
    if (!newDriver.name.trim()) return;
    await act('new', async () => {
      const r = await adminTracking.createDriver({ ...newDriver, language: 'de' });
      setDrivers((d) => [...d, r.driver]);
      setShowNew(false);
      setNewDriver({ name: '', phone: '', vehicle_plate: '' });
      return adminTracking.assign(booking.id, r.driver.id);
    });
  }

  const assignedDriver = panel?.driver ? drivers.find((d) => d.id === panel.driver!.id) || null : null;
  const status = panel?.status || null;
  const statusIdx = STEPS.findIndex((s) => s.key === status);
  const lang = booking.language === 'en' ? 'en' : 'de';

  return (
    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-blue-900 text-sm flex-1">🚕 Fahrer & Live-Tracking</h3>
        {status && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP[status]}`}>{STEPS.find((s) => s.key === status)?.label}</span>}
      </div>

      {!panel ? (
        <div className="text-xs text-gray-500">{error || 'Lädt…'}</div>
      ) : (
        <>
          {/* Driver */}
          <div className="flex gap-2">
            <select
              className="flex-1 border border-gray-300 bg-white rounded-lg px-2 py-1.5 text-sm"
              value={panel.driver?.id ?? ''}
              disabled={!!busy}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                if (panel.driver && ['enroute', 'arrived', 'onboard'].includes(panel.status || '')
                  && !window.confirm('Die Fahrt läuft gerade. Fahrer wirklich wechseln? Status und Position werden zurückgesetzt.')) return;
                act('assign', () => adminTracking.assign(booking.id, id));
              }}
            >
              <option value="">— Kein Fahrer —</option>
              {drivers.filter((d) => d.active || d.id === panel.driver?.id).map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.vehicle_plate ? ` · ${d.vehicle_plate}` : ''}{d.active_booking && d.active_booking !== booking.booking_number ? ' (auf Fahrt)' : ''}</option>
              ))}
            </select>
            <button onClick={() => setShowNew((v) => !v)} className="shrink-0 bg-white border border-gray-300 rounded-lg px-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1">
              <Plus size={14} /> Neu
            </button>
          </div>

          {showNew && (
            <div className="bg-white border border-gray-200 rounded-lg p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input className="border rounded-lg px-2 py-1.5 text-sm" placeholder="Name *" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} />
              <input className="border rounded-lg px-2 py-1.5 text-sm" placeholder="Telefon" value={newDriver.phone} onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })} />
              <input className="border rounded-lg px-2 py-1.5 text-sm uppercase" placeholder="Kennzeichen" value={newDriver.vehicle_plate} onChange={(e) => setNewDriver({ ...newDriver, vehicle_plate: e.target.value })} />
              <button onClick={createDriver} disabled={!newDriver.name.trim() || !!busy} className="sm:col-span-3 bg-blue-600 disabled:opacity-50 text-white rounded-lg py-1.5 text-sm font-medium">
                Anlegen & zuweisen
              </button>
              <p className="sm:col-span-3 text-[11px] text-gray-500">Weitere Angaben (Fahrzeug, Sprache, Traccar) im Tab „Fahrer“.</p>
            </div>
          )}

          {panel.driver && (
            <>
              {/* Status control */}
              <div className="flex flex-wrap gap-1">
                {STEPS.map((s, i) => (
                  <button
                    key={s.key}
                    disabled={!!busy || s.key === status}
                    onClick={() => {
                      if (i < statusIdx && !window.confirm(`Status auf „${s.label}“ zurücksetzen?`)) return;
                      act(`st-${s.key}`, () => adminTracking.setStatus(booking.id, s.key));
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                      s.key === status ? `${CHIP[s.key]} border-transparent ring-2 ring-blue-300`
                        : i < statusIdx ? 'bg-white text-gray-400 border-gray-200 hover:text-gray-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Live info */}
              <div className="text-xs text-gray-600 space-y-1">
                {panel.gps_lost ? (
                  <div className="flex items-center gap-1.5 text-rose-600 font-medium"><AlertTriangle size={13} /> GPS-Signal verloren {panel.driver_loc_age_s != null ? `(letztes ${ageText(panel.driver_loc_age_s)})` : ''}</div>
                ) : ['enroute', 'arrived', 'onboard'].includes(status || '') ? (
                  panel.driver_loc_age_s != null ? (
                    <div className="flex items-center gap-1.5">
                      <Satellite size={13} className="text-emerald-600" />
                      GPS {ageText(panel.driver_loc_age_s)}{panel.driver_accuracy != null ? ` · ±${Math.round(panel.driver_accuracy)} m` : ''}{panel.driver_source ? ` · ${panel.driver_source === 'traccar' ? 'Traccar' : 'App'}` : ''}
                    </div>
                  ) : <div className="text-amber-700">Noch kein GPS vom Fahrer</div>
                ) : null}
                {panel.customer_sharing && <div className="text-blue-700">● Kunde teilt seinen Standort</div>}
                {(panel.timeline.enroute || panel.timeline.arrived) && (
                  <div className="text-gray-500">
                    {[['Unterwegs', panel.timeline.enroute], ['Angekommen', panel.timeline.arrived], ['An Bord', panel.timeline.onboard], ['Beendet', panel.timeline.completed]]
                      .filter(([, v]) => v).map(([k, v]) => `${k} ${berlinClock(v as number)}`).join(' · ')}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Meeting point */}
          {(panel.airport || panel.meeting_point) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-amber-600 shrink-0" />
              <span className="text-gray-600 shrink-0">Treffpunkt:</span>
              <select
                className="flex-1 min-w-0 border border-gray-300 bg-white rounded-lg px-2 py-1 text-sm"
                value={panel.meeting_point || ''}
                disabled={!!busy}
                onChange={(e) => act('mp', () => adminTracking.setMeetingPoint(booking.id, e.target.value || null))}
              >
                <option value="">Automatisch{!panel.meeting_point && panel.resolved_pickup?.label ? ` (${panel.resolved_pickup.label})` : ''}</option>
                <option value="t1">Terminal 1</option>
                <option value="t2">Terminal 2</option>
                <option value="mac">München Airport Center (MAC)</option>
                <option value="address">Adresse (Geocoding)</option>
              </select>
            </div>
          )}

          {/* Links */}
          <div className="grid gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="w-14 text-gray-500 font-medium">Kunde</span>
              <button onClick={() => copy(panel.links.customer, 'cust')} className="inline-flex items-center gap-1 bg-white border rounded-lg px-2 py-1 hover:bg-gray-50">
                {copied === 'cust' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />} Link
              </button>
              <a href={panel.links.customer} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-white border rounded-lg px-2 py-1 hover:bg-gray-50"><ExternalLink size={12} /> Öffnen</a>
              {booking.phone && (
                <a href={waLink(booking.phone, customerMessage(lang, booking, panel.links.customer))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-[#25D366] text-white rounded-lg px-2 py-1"><MessageCircle size={12} /> WhatsApp</a>
              )}
              {panel.customer.email && (
                <button
                  disabled={!!busy}
                  onClick={() => act('mail', () => adminTracking.sendLink(booking.id))}
                  className="inline-flex items-center gap-1 bg-white border rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Mail size={12} /> {busy === 'mail' ? 'Sende…' : panel.mails.link ? 'Erneut mailen ✓' : 'E-Mail senden'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="w-14 text-gray-500 font-medium">Fahrer</span>
              {panel.driver ? (
                <>
                  {panel.driver.phone ? (
                    <a
                      href={waLink(panel.driver.phone, driverMessage(assignedDriver?.language || 'de', booking, panel.driver.app_link))}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-[#25D366] text-white rounded-lg px-2 py-1"
                    >
                      <MessageCircle size={12} /> App-Link senden
                    </a>
                  ) : (
                    <span className="text-gray-400">keine Telefonnr.</span>
                  )}
                  <button onClick={() => copy(panel.driver!.app_link, 'app')} className="inline-flex items-center gap-1 bg-white border rounded-lg px-2 py-1 hover:bg-gray-50">
                    {copied === 'app' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />} App-Link
                  </button>
                </>
              ) : null}
              <button onClick={() => copy(panel.links.single_ride_driver, 'single')} className="inline-flex items-center gap-1 bg-white border rounded-lg px-2 py-1 hover:bg-gray-50" title="Link nur für diese Fahrt (ohne App)">
                {copied === 'single' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />} Einzel-Link
              </button>
            </div>
            {(panel.mails.enroute || panel.mails.arrived) && (
              <div className="text-gray-500">
                Kunde informiert: {[panel.mails.enroute && 'unterwegs', panel.mails.arrived && 'angekommen'].filter(Boolean).join(', ')} ✓
              </div>
            )}
          </div>

          {error && <div className="text-xs text-rose-600">{error}</div>}
        </>
      )}
    </div>
  );
}
