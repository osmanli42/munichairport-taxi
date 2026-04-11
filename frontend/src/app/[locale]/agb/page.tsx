import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'AGB - Flughafen-München.TAXI',
  robots: { index: false },
};

const sections = [
  {
    num: '§ 1',
    title: 'Geltungsbereich',
    content: (email: string, owners: string) => (
      <p>Diese Allgemeinen Geschäftsbedingungen gelten für alle Beförderungsverträge, die zwischen Flughafen-München.TAXI ({owners}, Eisvogelweg 2, 85356 Freising) und dem Kunden geschlossen werden.</p>
    ),
  },
  {
    num: '§ 2',
    title: 'Vertragsschluss',
    content: () => (
      <p>Eine Buchung kommt durch die Bestätigung seitens Flughafen-München.TAXI zustande. Die Buchungsanfrage des Kunden (online, telefonisch oder per WhatsApp) stellt ein Angebot zum Vertragsschluss dar. Flughafen-München.TAXI kann dieses Angebot annehmen oder ablehnen.</p>
    ),
  },
  {
    num: '§ 3',
    title: 'Preise und Zahlung',
    content: () => (
      <ul className="space-y-2">
        {[
          'Alle angegebenen Preise sind Festpreise inklusive aller Gebühren und Steuern.',
          'Die Zahlung per Kreditkarte erfolgt vor Fahrtantritt. Barzahlung ist am Ende der Fahrt möglich.',
          'Online-Vorauszahlung ist auf Wunsch des Kunden möglich.',
          'Kindersitze werden kostenlos bereitgestellt.',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#fdf8ec', border: '1px solid #f0d890' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a84c', display: 'block' }} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    num: '§ 4',
    title: 'Pünktlichkeit und Wartezeit',
    content: () => (
      <ul className="space-y-2">
        {[
          'Flughafen-München.TAXI erscheint pünktlich zur vereinbarten Zeit am vereinbarten Abholort.',
          'Bei Abholungen am Flughafen wird der Flug überwacht. Der Fahrer wartet bis zu 60 Minuten nach der tatsächlichen Landezeit.',
          'Für weitere Wartezeiten wird eine Wartegebühr von 45 € pro angefangene Stunde berechnet.',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#fdf8ec', border: '1px solid #f0d890' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a84c', display: 'block' }} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    num: '§ 5',
    title: 'Stornierung',
    content: (email: string) => (
      <ul className="space-y-2">
        {[
          'Stornierungen sind kostenlos möglich bis 3 Stunden vor der Fahrt.',
          'Bei Stornierung weniger als 3 Stunden vor der Fahrt: 100% des Fahrpreises.',
          `Stornierungen müssen telefonisch oder per E-Mail an ${email} mitgeteilt werden.`,
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#fdf8ec', border: '1px solid #f0d890' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a84c', display: 'block' }} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    num: '§ 6',
    title: 'Haftung',
    content: () => (
      <div className="space-y-3">
        <p>Flughafen-München.TAXI haftet für Schäden, die durch Vorsatz oder grobe Fahrlässigkeit entstanden sind. Die Haftung für leichte Fahrlässigkeit ist auf vorhersehbare, vertragstypische Schäden beschränkt.</p>
        <p>Der Fahrgast haftet für Schäden am Fahrzeug, die durch sein Verschulden entstanden sind.</p>
      </div>
    ),
  },
  {
    num: '§ 7',
    title: 'Gepäck',
    content: () => (
      <p>Der Transport von normalem Reisegepäck ist im Preis inbegriffen. Sperrgut, Haustiere oder Gegenstände, die besondere Transportanforderungen stellen, sind vorher anzumelden und können zusätzliche Kosten verursachen.</p>
    ),
  },
  {
    num: '§ 8',
    title: 'Datenschutz',
    content: () => (
      <p>Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer Datenschutzerklärung und der DSGVO.</p>
    ),
  },
  {
    num: '§ 9',
    title: 'Anwendbares Recht',
    content: () => (
      <p>Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist Freising, Deutschland.</p>
    ),
  },
];

export default function AGBPage() {
  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }} className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4"
            style={{ background: '#fdf8ec', border: '1px solid #f0d890', color: '#a07820' }}>
            Rechtliches
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3" style={{ color: '#0f1b2d' }}>
            Allgemeine Geschäftsbedingungen
          </h1>
          <p className="text-sm" style={{ color: '#8a9bb0' }}>
            Flughafen-München.TAXI &nbsp;·&nbsp; Stand: April 2026
          </p>
        </div>

        {/* Quick nav pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {sections.map(s => (
            <a
              key={s.num}
              href={`#section-${s.num.replace('§ ', '')}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
              style={{ background: '#fff', border: '1px solid #e5edf5', color: '#3a5070' }}
            >
              {s.num} {s.title}
            </a>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((s, idx) => (
            <div
              key={s.num}
              id={`section-${s.num.replace('§ ', '')}`}
              className="rounded-2xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
            >
              {/* Section header */}
              <div className="flex items-center gap-4 px-7 py-5"
                style={{ borderBottom: '1px solid #f0f4f8' }}>
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)', color: '#c9a84c' }}>
                  {idx + 1}
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>
                    {s.num}
                  </span>
                  <h2 className="text-lg font-bold leading-tight" style={{ color: '#0f1b2d' }}>
                    {s.title}
                  </h2>
                </div>
              </div>
              {/* Section body */}
              <div className="px-7 py-5 text-sm leading-relaxed" style={{ color: '#4a6280' }}>
                {s.content(CONTACT_INFO.email, CONTACT_INFO.owners)}
              </div>
            </div>
          ))}

          {/* Contact card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)',
              border: '1px solid rgba(201,168,76,.3)',
            }}
          >
            <div className="flex items-center gap-4 px-7 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm"
                style={{ background: '#c9a84c', color: '#0f1b2d' }}>
                10
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>§ 10</span>
                <h2 className="text-lg font-bold text-white leading-tight">Kontakt</h2>
              </div>
            </div>
            <div className="px-7 py-6 grid sm:grid-cols-2 gap-4">
              {[
                { icon: '🏢', label: 'Unternehmen', value: 'Flughafen-München.TAXI' },
                { icon: '👤', label: 'Inhaber', value: CONTACT_INFO.owners },
                { icon: '📍', label: 'Adresse', value: 'Eisvogelweg 2, 85356 Freising' },
                { icon: '📞', label: 'Telefon', value: CONTACT_INFO.phone, href: CONTACT_INFO.phoneHref },
                { icon: '✉️', label: 'E-Mail', value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#c9a84c' }}>
                      {item.label}
                    </div>
                    {item.href ? (
                      <a href={item.href} className="text-sm font-medium text-white hover:text-yellow-300 transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <div className="text-sm font-medium text-white">{item.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs mt-8" style={{ color: '#a0b4c8' }}>
          Bei Fragen zu diesen AGB wenden Sie sich bitte an{' '}
          <a href={`mailto:${CONTACT_INFO.email}`} className="underline hover:text-primary-600">
            {CONTACT_INFO.email}
          </a>
        </p>

      </div>
    </div>
  );
}
