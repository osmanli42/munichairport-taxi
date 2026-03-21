// Google Ads configuration
export const GOOGLE_ADS_ID = 'AW-829027982';
export const CONVERSION_LABEL = 'JpyNCNSay4wcEI7tp4sD';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

// Check if user has accepted marketing cookies
function hasMarketingConsent(): boolean {
  try {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) return false;
    const parsed = JSON.parse(consent);
    return parsed.marketing === true;
  } catch {
    return false;
  }
}

// Check if user has accepted analytics cookies
function hasAnalyticsConsent(): boolean {
  try {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) return false;
    const parsed = JSON.parse(consent);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

// Fire Google Ads conversion when booking is confirmed
export function fireBookingConversion(price?: number, bookingNumber?: string) {
  if (typeof window === 'undefined') return;
  if (!hasMarketingConsent()) return;
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${CONVERSION_LABEL}`,
    value: price || 1.0,
    currency: 'EUR',
    transaction_id: bookingNumber || '',
  });
}

// Initialize gtag with consent mode
export function initGtag() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };

  const now = new Date().toISOString();
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });

  window.gtag('js', new Date(now));
  window.gtag('config', GOOGLE_ADS_ID, { send_page_view: false });
}

// Update consent after user accepts cookies
export function updateGtagConsent() {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;

  window.gtag('consent', 'update', {
    ad_storage: hasMarketingConsent() ? 'granted' : 'denied',
    analytics_storage: hasAnalyticsConsent() ? 'granted' : 'denied',
    ad_user_data: hasMarketingConsent() ? 'granted' : 'denied',
    ad_personalization: hasMarketingConsent() ? 'granted' : 'denied',
  });
}
