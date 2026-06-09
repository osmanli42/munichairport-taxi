'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import MobileStickyCTA from '@/components/MobileStickyCTA';
import CookieBanner from '@/components/CookieBanner';
import PromoBanner from '@/components/PromoBanner';
import VisitorTracker from '@/components/VisitorTracker';
import SessionRecorder from '@/components/SessionRecorder';
import BookingDraftRecovery from '@/components/BookingDraftRecovery';

// Tracking and driver pages are standalone full-screen experiences — no
// marketing chrome (header/footer/sticky CTA would cover the UI).
function isBarePath(pathname: string): boolean {
  return /(^|\/)(track|fahrer)(\/|$)/.test(pathname);
}

export default function SiteChrome({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const pathname = usePathname();

  if (isBarePath(pathname)) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Header />
      <PromoBanner locale={locale} />
      <main className="flex-1 pb-[88px] md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton />
      <MobileStickyCTA />
      <CookieBanner />
      <VisitorTracker />
      <SessionRecorder />
      <BookingDraftRecovery />
    </>
  );
}
