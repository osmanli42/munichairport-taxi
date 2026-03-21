import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Impressum - Munich Airport Taxi',
  robots: { index: false },
};

export default function ImpressumPage() {
  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm p-8 lg:p-12">
          <h1 className="text-3xl font-bold text-primary-600 mb-8">Impressum</h1>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Angaben gemäß § 5 TMG</h2>
            <div className="text-gray-700 space-y-1">
              <p className="font-semibold">Munich Airport Taxi</p>
              <p>{CONTACT_INFO.owners}</p>
              <p>Eisvogelweg 2</p>
              <p>85356 Freising</p>
              <p>Deutschland</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Kontakt</h2>
            <div className="text-gray-700 space-y-1">
              <p>Telefon: <a href={CONTACT_INFO.phoneHref} className="text-primary-600 hover:underline">{CONTACT_INFO.phone}</a></p>
              <p>E-Mail: <a href={`mailto:${CONTACT_INFO.email}`} className="text-primary-600 hover:underline">{CONTACT_INFO.email}</a></p>
              <p>Website: <a href="https://www.munichairport.taxi" className="text-primary-600 hover:underline">{CONTACT_INFO.website}</a></p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Umsatzsteuer</h2>
            <p className="text-gray-700">
              Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: Wird auf Anfrage mitgeteilt.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Berufsbezeichnung und berufsrechtliche Regelungen</h2>
            <div className="text-gray-700 space-y-2">
              <p>Berufsbezeichnung: Taxiunternehmer / Personenbeförderung</p>
              <p>Zuständige Behörde: Landratsamt Freising</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Streitschlichtung</h2>
            <p className="text-gray-700 mb-3">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a href="https://ec.europa.eu/consumers/odr/" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="text-gray-700">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Haftung für Inhalte</h2>
            <p className="text-gray-700">
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht unter der Verpflichtung, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Haftung für Links</h2>
            <p className="text-gray-700">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Urheberrecht</h2>
            <p className="text-gray-700">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
