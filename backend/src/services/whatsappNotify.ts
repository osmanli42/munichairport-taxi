/**
 * WhatsApp-Benachrichtigung an die eigene Nummer (Meta WhatsApp Cloud API).
 *
 * Warum: Rückruf-Anfragen müssen sofort ankommen. E-Mail wird oft erst später gelesen,
 * WhatsApp klingelt. Ein Server kann WhatsApp-Nachrichten nur über eine offizielle API
 * senden — es gibt keinen Weg über wa.me-Links.
 *
 * Konfiguration (alle optional; fehlt etwas, wird stillschweigend übersprungen und die
 * E-Mail bleibt der Kanal):
 *   WHATSAPP_PHONE_NUMBER_ID  — ID der Absendernummer aus dem Meta-Business-Konto
 *   WHATSAPP_TOKEN            — permanentes Access-Token
 *   WHATSAPP_ADMIN_TO         — Zielnummer in E.164 ohne '+', z. B. 4915141620000
 *   WHATSAPP_TEMPLATE         — Name einer genehmigten Vorlage (empfohlen)
 *   WHATSAPP_TEMPLATE_LANG    — Sprachcode der Vorlage, Standard 'de'
 *
 * Ohne Vorlage wird eine einfache Textnachricht versucht. Das funktioniert nur innerhalb
 * des 24-Stunden-Fensters, also nachdem die Zielnummer die Business-Nummer selbst
 * angeschrieben hat — deshalb ist die Vorlage der verlässliche Weg.
 */

const GRAPH_VERSION = 'v21.0';

function config() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  const to = (process.env.WHATSAPP_ADMIN_TO || '').replace(/[^\d]/g, '');
  if (!phoneNumberId || !token || !to) return null;
  return {
    phoneNumberId,
    token,
    to,
    template: process.env.WHATSAPP_TEMPLATE || '',
    lang: process.env.WHATSAPP_TEMPLATE_LANG || 'de',
  };
}

export function isWhatsAppConfigured(): boolean {
  return config() !== null;
}

/**
 * Sendet eine Nachricht an die Admin-Nummer. Wirft nie — Benachrichtigungen dürfen
 * den Request des Kunden nicht scheitern lassen.
 *
 * @param lines  Inhaltszeilen (Textmodus). Bei gesetzter Vorlage werden sie als
 *               Body-Parameter in der angegebenen Reihenfolge übergeben.
 */
export async function sendWhatsAppAdmin(lines: string[]): Promise<boolean> {
  const cfg = config();
  if (!cfg) {
    console.log('[whatsapp] nicht konfiguriert — Benachrichtigung übersprungen');
    return false;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`;
  const body = cfg.template
    ? {
        messaging_product: 'whatsapp',
        to: cfg.to,
        type: 'template',
        template: {
          name: cfg.template,
          language: { code: cfg.lang },
          components: [
            {
              type: 'body',
              // Vorlagen-Parameter dürfen keine Zeilenumbrüche enthalten
              parameters: lines.map((l) => ({ type: 'text', text: l.replace(/\s+/g, ' ').slice(0, 900) })),
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: cfg.to,
        type: 'text',
        text: { body: lines.join('\n').slice(0, 3900) },
      };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[whatsapp] Versand fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[whatsapp] Versand fehlgeschlagen:', err.message);
    return false;
  }
}
