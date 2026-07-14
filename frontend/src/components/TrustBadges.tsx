/* Trust & payment badges for the footer. All marks are inline SVG (crisp at any DPI).
   Payment brands sit on white cards so their brand colors read on the dark footer;
   SSL / IHK / TÜV are truthful text badges (no official-logo impersonation). */

function VisaMark() {
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-auto" role="img" aria-label="Visa">
      <text x="24" y="13" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
        fontSize="15" fontWeight="700" fontStyle="italic" fill="#1A1F71" letterSpacing="0.5">VISA</text>
    </svg>
  );
}

function MastercardMark() {
  return (
    <svg viewBox="0 0 40 24" className="h-5 w-auto" role="img" aria-label="Mastercard">
      <circle cx="15" cy="12" r="10" fill="#EB001B" />
      <circle cx="25" cy="12" r="10" fill="#F79E1B" />
      <path d="M20 4.2a9.98 9.98 0 0 1 0 15.6 9.98 9.98 0 0 1 0-15.6z" fill="#FF5F00" />
    </svg>
  );
}

function AmexMark() {
  return (
    <svg viewBox="0 0 44 24" className="h-5 w-auto" role="img" aria-label="American Express">
      <rect width="44" height="24" rx="3" fill="#2E77BC" />
      <text x="22" y="15" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.5" fontWeight="700" fill="#fff" letterSpacing="0.3">AMEX</text>
    </svg>
  );
}

function PaymentCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-md px-2.5 h-8 flex items-center justify-center shadow-sm">
      {children}
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TextBadge({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-primary-400 text-primary-100 text-xs font-semibold">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export default function TrustBadges({ locale }: { locale?: string }) {
  const heading =
    locale === 'tr' ? 'Güvenli & kolay ödeme' :
    locale === 'en' ? 'Secure & easy payment' :
    'Sichere & einfache Bezahlung';
  const tuev =
    locale === 'tr' ? 'TÜV-geprüfte Fahrzeuge' :
    locale === 'en' ? 'TÜV-inspected vehicles' :
    'TÜV-geprüfte Fahrzeuge';

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-semibold text-primary-200 uppercase tracking-wider">{heading}</p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <PaymentCard><VisaMark /></PaymentCard>
        <PaymentCard><MastercardMark /></PaymentCard>
        <PaymentCard><AmexMark /></PaymentCard>
        <TextBadge icon={<LockIcon />} label="SSL-verschlüsselt" />
        <TextBadge label="IHK-Mitglied" />
        <TextBadge label={tuev} />
      </div>
    </div>
  );
}
