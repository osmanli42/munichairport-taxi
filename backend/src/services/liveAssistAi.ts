/**
 * Canlı Asistan — KI-Antwortentwurf für den Admin.
 *
 * Der Entwurf landet NUR im Eingabefeld des Admins; gesendet wird erst, wenn er ihn
 * geprüft/geändert und auf "Gönder" gedrückt hat. Rabatte bietet die KI nie an —
 * das entscheidet der Admin.
 */
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db';

const MODEL = 'claude-opus-5';

let client: Anthropic | null = null;
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
function getClient(): Anthropic {
  if (!client) client = new Anthropic(); // liest ANTHROPIC_API_KEY
  return client;
}

const SYSTEM = `Du formulierst Antwortentwürfe für den Live-Chat von "Munich Airport Taxi" (flughafen-muenchen.taxi), einem Taxi- und Transferdienst am Flughafen München mit Sitz in Freising. Ein Mitarbeiter liest deinen Entwurf, ändert ihn bei Bedarf und schickt ihn selbst ab.

Fakten, auf die du dich stützen darfst:
- Alle Preise auf der Website sind Festpreise inkl. Maut, Gepäck und Kindersitz; keine versteckten Kosten.
- Kindersitze kostenlos auf Anfrage. Kostenlose Stornierung bis 3 Stunden vor Abholung.
- Keine Vorauszahlung: Barzahlung beim Fahrer oder Kreditkarte.
- Fahrzeuge: Kombi, Van/Minibus, Großraumtaxi (bis 8 Personen, viel Gepäck).
- Buchung direkt auf der Website; Bestätigung sofort per E-Mail. Telefon/WhatsApp: +49 151 41620000.

Regeln:
- Antworte in der Sprache des Kunden (Deutsch, Englisch oder Türkisch), freundlich, kurz (1–3 Sätze), wie ein Mensch im Chat.
- Erfinde keine Preise, Kapazitäten oder Zusagen. Nenne nur Preise aus dem Kontext unten. Wenn du etwas nicht sicher weißt, sag, dass du es kurz prüfst.
- Biete keine Rabatte oder Sonderpreise an und versprich keine — das entscheidet der Mitarbeiter.
- Ziel: offene Fragen klären und zur Buchung ermutigen, ohne Druck.
- Gib nur den Antworttext aus, ohne Anführungszeichen oder Erklärungen.`;

/** Entwurf für die nächste Antwort an den Besucher dieser Sitzung. */
export async function draftReply(sessionId: string, agentName: string): Promise<string> {
  const msgs = await query<any>(
    `SELECT source, body, promo_code, attachment_id FROM live_messages
      WHERE session_id = ? AND source IN ('admin', 'visitor') ORDER BY id DESC LIMIT 30`,
    [sessionId]
  );
  msgs.reverse();
  const [visit] = await query<any>(
    `SELECT s.lang,
       (SELECT p.path FROM visitor_pageviews p WHERE p.session_id = s.session_id
          AND (p.path LIKE '%/ergebnisse%' OR p.path LIKE '%/buchen%') ORDER BY p.id DESC LIMIT 1) AS path,
       (SELECT GROUP_CONCAT(DISTINCT e.target SEPARATOR '; ') FROM visitor_events e
          WHERE e.session_id = s.session_id AND e.type = 'price_shown') AS prices
     FROM visitor_sessions s WHERE s.session_id = ?`,
    [sessionId]
  );

  const ctx: string[] = [];
  if (visit?.path) {
    const qs = new URLSearchParams(visit.path.includes('?') ? visit.path.slice(visit.path.indexOf('?') + 1) : '');
    const site = /^\/(en|tr)(\/|\?)/.exec(visit.path)?.[1] || 'de';
    ctx.push(`Sprache der Website: ${site}`);
    if (qs.get('pickup')) ctx.push(`Abholung: ${qs.get('pickup')}`);
    if (qs.get('dropoff')) ctx.push(`Ziel: ${qs.get('dropoff')}`);
    if (qs.get('date')) ctx.push(`Termin: ${qs.get('date')} ${qs.get('time') || ''}`.trim());
    if (qs.get('passengers')) ctx.push(`Personen: ${qs.get('passengers')}`);
    if (qs.get('vehicle')) ctx.push(`Gewähltes Fahrzeug: ${qs.get('vehicle')} ${qs.get('price') ? `(${qs.get('price')} €)` : ''}`.trim());
  }
  if (visit?.prices) {
    // "37.50|12.5|kombi" → "kombi 37,50 € (12,5 km)"
    const seen = String(visit.prices).split('; ').map((p) => {
      const [price, km, vehicle] = p.split('|');
      const n = Math.ceil(Number(price) * 2) / 2;
      return Number.isFinite(n) ? `${vehicle || '?'} ${n.toFixed(2).replace('.', ',')} € (${km} km)` : '';
    }).filter(Boolean);
    if (seen.length) ctx.push(`Angezeigte Festpreise: ${seen.join(', ')}`);
  }

  const transcript = msgs.map((m) => {
    const who = m.source === 'visitor' ? 'Kunde' : `Mitarbeiter (${agentName})`;
    const extra = [m.attachment_id ? '[Bild]' : '', m.promo_code ? `[Rabattcode ${m.promo_code} angeboten]` : ''].filter(Boolean).join(' ');
    return `${who}: ${m.body || ''} ${extra}`.trim();
  }).join('\n');

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Kontext zur Anfrage:\n${ctx.join('\n') || '(kein Kontext)'}\n\nChatverlauf:\n${transcript || '(noch keine Nachrichten — schreibe eine kurze, freundliche Begrüßung)'}\n\nSchreibe den Entwurf für die nächste Antwort des Mitarbeiters.`,
    }],
  } as any);

  if (response.stop_reason === 'refusal') throw new Error('refusal');
  return response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
}
