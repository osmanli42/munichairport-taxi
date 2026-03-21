import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung - Munich Airport Taxi',
  robots: { index: false },
};

export default function DatenschutzPage() {
  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm p-8 lg:p-12 prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Datenschutzerklärung</h1>
          <p className="text-sm text-gray-500 mb-8">Stand: März 2025</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Datenschutz auf einen Blick</h2>
          <h3 className="font-semibold text-gray-800 mb-2">Allgemeine Hinweise</h3>
          <p className="text-gray-700 mb-4">
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2">Datenerfassung auf dieser Website</h3>
          <p className="text-gray-700 mb-4">
            Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Abschnitt &ldquo;Hinweis zur verantwortlichen Stelle&rdquo; in dieser Datenschutzerklärung entnehmen.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Hosting</h2>
          <p className="text-gray-700 mb-4">
            Wir hosten die Inhalte unserer Website bei einem Anbieter in der Europäischen Union. Details entnehmen Sie unserer Datenschutzerklärung unter dem Abschnitt &ldquo;Hosting&rdquo;.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Allgemeine Hinweise und Pflichtinformationen</h2>

          <h3 className="font-semibold text-gray-800 mb-2">Datenschutz</h3>
          <p className="text-gray-700 mb-4">
            Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2">Hinweis zur verantwortlichen Stelle</h3>
          <div className="text-gray-700 mb-4">
            <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
            <div className="mt-2 space-y-1">
              <p>Munich Airport Taxi</p>
              <p>{CONTACT_INFO.owners}</p>
              <p>Eisvogelweg 2, 85356 Freising</p>
              <p>Telefon: {CONTACT_INFO.phone}</p>
              <p>E-Mail: {CONTACT_INFO.email}</p>
            </div>
          </div>

          <h3 className="font-semibold text-gray-800 mb-2">Speicherdauer</h3>
          <p className="text-gray-700 mb-4">
            Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben (z. B. steuer- oder handelsrechtliche Aufbewahrungsfristen).
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Datenerfassung auf dieser Website</h2>

          <h3 className="font-semibold text-gray-800 mb-2">Buchungsformular</h3>
          <p className="text-gray-700 mb-4">
            Wenn Sie unser Buchungsformular nutzen, werden die von Ihnen eingegebenen Daten (Name, Telefonnummer, E-Mail-Adresse, Abhol- und Zieladresse, Fahrtdatum und -uhrzeit) zur Bearbeitung Ihrer Buchungsanfrage verwendet. Diese Daten werden nicht an Dritte weitergegeben und nur für die Durchführung des Transportauftrags verwendet.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2">Google Maps</h3>
          <p className="text-gray-700 mb-4">
            Diese Seite nutzt den Kartendienst Google Maps. Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Mit der Nutzung von Google Maps können Informationen über Ihre Nutzung dieser Website einschließlich Ihrer IP-Adresse an Google in den USA übertragen werden.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2">Ihre Rechte</h3>
          <p className="text-gray-700 mb-4">
            Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Wenden Sie sich dazu an: {CONTACT_INFO.email}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Cookies</h2>
          <p className="text-gray-700 mb-4">
            Unsere Website verwendet nur technisch notwendige Cookies sowie Cookies für Google Maps (nach Ihrer Einwilligung). Sie können Ihrer Einwilligung in der Cookie-Leiste zustimmen oder diese ablehnen. Bereits gespeicherte Cookies können Sie in Ihrem Browser jederzeit löschen.
          </p>
        </div>
      </div>
    </div>
  );
}
