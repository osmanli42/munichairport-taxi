import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'AGB - Munich Airport Taxi',
  robots: { index: false },
};

export default function AGBPage() {
  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm p-8 lg:p-12">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Allgemeine Geschäftsbedingungen (AGB)</h1>
          <p className="text-sm text-gray-500 mb-8">Munich Airport Taxi | Stand: März 2025</p>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 1 Geltungsbereich</h2>
              <p>Diese Allgemeinen Geschäftsbedingungen gelten für alle Beförderungsverträge, die zwischen Munich Airport Taxi ({CONTACT_INFO.owners}, Eisvogelweg 2, 85356 Freising) und dem Kunden geschlossen werden.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 2 Vertragsschluss</h2>
              <p>Eine Buchung kommt durch die Bestätigung seitens Munich Airport Taxi zustande. Die Buchungsanfrage des Kunden (online, telefonisch oder per WhatsApp) stellt ein Angebot zum Vertragsschluss dar. Munich Airport Taxi kann dieses Angebot annehmen oder ablehnen.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 3 Preise und Zahlung</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Alle angegebenen Preise sind Festpreise inklusive aller Gebühren und Steuern.</li>
                <li>Die Zahlung erfolgt am Ende der Fahrt (bar oder per Karte).</li>
                <li>Online-Vorauszahlung wird nicht angeboten.</li>
                <li>Kindersitze werden kostenlos bereitgestellt.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 4 Pünktlichkeit und Wartezeit</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Munich Airport Taxi erscheint pünktlich zur vereinbarten Zeit am vereinbarten Abholort.</li>
                <li>Bei Abholungen am Flughafen wird der Flug überwacht. Der Fahrer wartet bis zu 60 Minuten nach der tatsächlichen Landezeit.</li>
                <li>Für weitere Wartezeiten kann eine Wartegebühr von €10/30 Minuten berechnet werden.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 5 Stornierung</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Stornierungen sind kostenlos möglich bis 24 Stunden vor der Fahrt.</li>
                <li>Bei Stornierung zwischen 12 und 24 Stunden vor der Fahrt: 50% des Fahrpreises.</li>
                <li>Bei Stornierung weniger als 12 Stunden vor der Fahrt: 100% des Fahrpreises.</li>
                <li>Stornierungen müssen telefonisch oder per E-Mail an {CONTACT_INFO.email} mitgeteilt werden.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 6 Haftung</h2>
              <p className="mb-2">Munich Airport Taxi haftet für Schäden, die durch Vorsatz oder grobe Fahrlässigkeit entstanden sind. Die Haftung für leichte Fahrlässigkeit ist auf vorhersehbare, vertragstypische Schäden beschränkt.</p>
              <p>Der Fahrgast haftet für Schäden am Fahrzeug, die durch sein Verschulden entstanden sind.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 7 Gepäck</h2>
              <p>Der Transport von normalem Reisegepäck ist im Preis inbegriffen. Sperrgut, Haustiere oder Gegenstände, die besondere Transportanforderungen stellen, sind vorher anzumelden und können zusätzliche Kosten verursachen.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 8 Datenschutz</h2>
              <p>Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer Datenschutzerklärung und der DSGVO.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 9 Anwendbares Recht</h2>
              <p>Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist Freising, Deutschland.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 10 Kontakt</h2>
              <div className="space-y-1">
                <p>Munich Airport Taxi</p>
                <p>{CONTACT_INFO.owners}</p>
                <p>Eisvogelweg 2, 85356 Freising</p>
                <p>Telefon: <a href={CONTACT_INFO.phoneHref} className="text-primary-600 hover:underline">{CONTACT_INFO.phone}</a></p>
                <p>E-Mail: <a href={`mailto:${CONTACT_INFO.email}`} className="text-primary-600 hover:underline">{CONTACT_INFO.email}</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
