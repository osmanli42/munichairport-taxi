import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Impressum - Flughafen-München.TAXI',
  robots: { index: false },
};

const sections = [
  {
    num: '1',
    icon: '🏢',
    title: 'Angaben gemäß § 5 TMG',
    content: (
      <div style={{ borderLeft: '3px solid #c9a84c' }} className="pl-4 space-y-1">
        <p className="font-bold" style={{ color: '#0f1b2d' }}>Flughafen-München.TAXI</p>
        <p>{CONTACT_INFO.owners}</p>
        <p>Eisvogelweg 2</p>
        <p>85356 Freising</p>
        <p>Deutschland</p>
      </div>
    ),
  },
  {
    num: '2',
    icon: '📞',
    title: 'Kontakt',
    content: (
      <div className="space-y-2">
        {[
          { label: 'Telefon', value: CONTACT_INFO.phone, href: CONTACT_INFO.phoneHref },
          { label: 'E-Mail', value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
          { label: 'Website', value: CONTACT_INFO.website, href: `https://${CONTACT_INFO.website}` },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest w-16 flex-shrink-0" style={{ color: '#8a9bb0' }}>
              {item.label}
            </span>
            <a href={item.href} className="font-medium hover:underline" style={{ color: '#0f1b2d' }}>
              {item.value}
            </a>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '3',
    icon: '💼',
    title: 'Umsatzsteuer',
    content: (
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: Wird auf Anfrage mitgeteilt.</p>
    ),
  },
  {
    num: '4',
    icon: '🚕',
    title: 'Berufsbezeichnung und berufsrechtliche Regelungen',
    content: (
      <div className="space-y-1">
        <p>Berufsbezeichnung: Taxiunternehmer / Personenbeförderung</p>
        <p>Zuständige Behörde: Landratsamt Freising</p>
      </div>
    ),
  },
  {
    num: '5',
    icon: '⚖️',
    title: 'Streitschlichtung',
    content: (
      <div className="space-y-3">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
            style={{ color: '#c9a84c' }}
          >
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </div>
    ),
  },
  {
    num: '6',
    icon: '📄',
    title: 'Haftung für Inhalte',
    content: (
      <p>Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht unter der Verpflichtung, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
    ),
  },
  {
    num: '7',
    icon: '🔗',
    title: 'Haftung für Links',
    content: (
      <p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
    ),
  },
  {
    num: '8',
    icon: '©️',
    title: 'Urheberrecht',
    content: (
      <p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>
    ),
  },
];

export default function ImpressumPage() {
  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }} className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4"
            style={{ background: '#fdf8ec', border: '1px solid #f0d890', color: '#a07820' }}
          >
            Rechtliches
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3" style={{ color: '#0f1b2d' }}>
            Impressum
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
              href={`#section-${s.num}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
              style={{ background: '#fff', border: '1px solid #e5edf5', color: '#3a5070' }}
            >
              {s.icon} {s.title}
            </a>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((s, idx) => (
            <div
              key={s.num}
              id={`section-${s.num}`}
              className="rounded-2xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
            >
              {/* Section header */}
              <div
                className="flex items-center gap-4 px-7 py-5"
                style={{ background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)', borderBottom: '1px solid rgba(255,255,255,.07)' }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm"
                  style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)', color: '#c9a84c' }}
                >
                  {idx + 1}
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>
                    {s.icon} Abschnitt {s.num}
                  </span>
                  <h2 className="text-lg font-bold text-white leading-tight">{s.title}</h2>
                </div>
              </div>
              {/* Section body */}
              <div className="px-7 py-5 text-sm leading-relaxed" style={{ color: '#4a6280' }}>
                {s.content}
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
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)' }}
              >
                ✉️
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>Kontakt</span>
                <h2 className="text-lg font-bold text-white leading-tight">Fragen zum Impressum?</h2>
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

      </div>
    </div>
  );
}
