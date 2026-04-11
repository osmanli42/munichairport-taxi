import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung - Flughafen-München.TAXI',
  robots: { index: false },
};

const sections = [
  {
    num: '1',
    title: 'Datenschutz auf einen Blick',
    icon: '🔒',
    subsections: [
      {
        subtitle: 'Allgemeine Hinweise',
        content: (email: string) => (
          <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.</p>
        ),
      },
      {
        subtitle: 'Datenerfassung auf dieser Website',
        content: (email: string) => (
          <p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Abschnitt &ldquo;Hinweis zur verantwortlichen Stelle&rdquo; in dieser Datenschutzerklärung entnehmen.</p>
        ),
      },
    ],
  },
  {
    num: '2',
    title: 'Hosting',
    icon: '🖥️',
    subsections: [
      {
        subtitle: null,
        content: (email: string) => (
          <p>Wir hosten die Inhalte unserer Website bei einem Anbieter in der Europäischen Union. Details entnehmen Sie unserer Datenschutzerklärung unter dem Abschnitt &ldquo;Hosting&rdquo;.</p>
        ),
      },
    ],
  },
  {
    num: '3',
    title: 'Allgemeine Hinweise und Pflichtinformationen',
    icon: '📋',
    subsections: [
      {
        subtitle: 'Datenschutz',
        content: (email: string) => (
          <p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
        ),
      },
      {
        subtitle: 'Hinweis zur verantwortlichen Stelle',
        content: (email: string) => (
          <div className="space-y-1">
            <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
            <div className="mt-3 space-y-1 pl-4" style={{ borderLeft: '3px solid #c9a84c' }}>
              <p className="font-semibold" style={{ color: '#0f1b2d' }}>Flughafen-München.TAXI</p>
              <p>{CONTACT_INFO.owners}</p>
              <p>Eisvogelweg 2, 85356 Freising</p>
              <p>Telefon: {CONTACT_INFO.phone}</p>
              <p>E-Mail: {email}</p>
            </div>
          </div>
        ),
      },
      {
        subtitle: 'Speicherdauer',
        content: (email: string) => (
          <p>Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben.</p>
        ),
      },
    ],
  },
  {
    num: '4',
    title: 'Datenerfassung auf dieser Website',
    icon: '📝',
    subsections: [
      {
        subtitle: 'Buchungsformular',
        content: (email: string) => (
          <p>Wenn Sie unser Buchungsformular nutzen, werden die von Ihnen eingegebenen Daten (Name, Telefonnummer, E-Mail-Adresse, Abhol- und Zieladresse, Fahrtdatum und -uhrzeit) zur Bearbeitung Ihrer Buchungsanfrage verwendet. Diese Daten werden nicht an Dritte weitergegeben und nur für die Durchführung des Transportauftrags verwendet.</p>
        ),
      },
      {
        subtitle: 'Google Maps',
        content: (email: string) => (
          <p>Diese Seite nutzt den Kartendienst Google Maps. Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Mit der Nutzung von Google Maps können Informationen über Ihre Nutzung dieser Website einschließlich Ihrer IP-Adresse an Google in den USA übertragen werden.</p>
        ),
      },
      {
        subtitle: 'Ihre Rechte',
        content: (email: string) => (
          <p>Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Wenden Sie sich dazu an:{' '}
            <a href={`mailto:${email}`} className="underline hover:opacity-80" style={{ color: '#c9a84c' }}>{email}</a>
          </p>
        ),
      },
    ],
  },
  {
    num: '5',
    title: 'Cookies',
    icon: '🍪',
    subsections: [
      {
        subtitle: null,
        content: (email: string) => (
          <p>Unsere Website verwendet nur technisch notwendige Cookies sowie Cookies für Google Maps (nach Ihrer Einwilligung). Sie können Ihrer Einwilligung in der Cookie-Leiste zustimmen oder diese ablehnen. Bereits gespeicherte Cookies können Sie in Ihrem Browser jederzeit löschen.</p>
        ),
      },
    ],
  },
];

export default function DatenschutzPage() {
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
            Datenschutzerklärung
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
              {s.icon} {s.num}. {s.title}
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
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)' }}
                >
                  {s.icon}
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>
                    Abschnitt {s.num}
                  </span>
                  <h2 className="text-lg font-bold text-white leading-tight">{s.title}</h2>
                </div>
              </div>

              {/* Subsections */}
              <div className="px-7 py-5 space-y-5 text-sm leading-relaxed" style={{ color: '#4a6280' }}>
                {s.subsections.map((sub, i) => (
                  <div key={i} className={i > 0 ? 'pt-4' : ''} style={i > 0 ? { borderTop: '1px solid #f0f4f8' } : {}}>
                    {sub.subtitle && (
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: '#c9a84c' }}
                        />
                        <h3 className="font-bold text-sm" style={{ color: '#0f1b2d' }}>{sub.subtitle}</h3>
                      </div>
                    )}
                    {sub.content(CONTACT_INFO.email)}
                  </div>
                ))}
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
                <h2 className="text-lg font-bold text-white leading-tight">Fragen zum Datenschutz?</h2>
              </div>
            </div>
            <div className="px-7 py-6">
              <p className="text-sm mb-4" style={{ color: '#7a9ab8' }}>
                Bei Fragen zu dieser Datenschutzerklärung oder zur Verarbeitung Ihrer Daten wenden Sie sich bitte direkt an uns:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: '🏢', label: 'Unternehmen', value: 'Flughafen-München.TAXI' },
                  { icon: '👤', label: 'Inhaber', value: CONTACT_INFO.owners },
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
    </div>
  );
}
