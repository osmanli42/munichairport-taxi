'use client';

import { useEffect, useState } from 'react';
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
import { assignVariant } from '@/lib/experiment';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

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

  // /buchen renders its own price-aware sticky bar for checkout_v2 variant B
  // (see [locale]/buchen/page.tsx) — suppress the generic one here so the two
  // don't stack at the same fixed bottom-0 position.
  const [suppressGlobalMobileCta, setSuppressGlobalMobileCta] = useState(false);
  const onBuchen = /\/buchen(\/|$)/.test(pathname || '');
  useEffect(() => {
    if (!onBuchen) { setSuppressGlobalMobileCta(false); return; }
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      const visitorId = typeof localStorage !== 'undefined' ? localStorage.getItem('mt_visitor_id') : null;
      setSuppressGlobalMobileCta(assignVariant(visitorId, 'checkout_v2', s.experiment_checkout_v2) === 'b');
    }).catch(() => {});
  }, [onBuchen]);

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
      {!suppressGlobalMobileCta && <MobileStickyCTA />}
      <CookieBanner />
      <VisitorTracker />
      <SessionRecorder />
      <BookingDraftRecovery />
    </>
  );
}
