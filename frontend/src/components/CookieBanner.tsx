'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield, ChevronDown, ChevronUp, Cookie, Lock, Map, BarChart3, Megaphone } from 'lucide-react';
import { updateGtagConsent } from '@/lib/gtag';

// Darstellung kommt aus dem Admin (System → Cookie-Banner): 'bottom' = Leiste unten, die Seite
// bleibt benutzbar (Standard); 'popup' = mittig mit abgedunkelter Seite (alt).
type BannerStyle = 'popup' | 'bottom';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Gezeigt / gewählt in die eigene Besucherstatistik (Admin: Annahmequote je Darstellung)
function trackConsent(type: 'consent_shown' | 'consent', target: string, attempt = 0) {
  try {
    const sessionId = sessionStorage.getItem('mt_session_id');
    if (!sessionId) {
      if (attempt < 5) setTimeout(() => trackConsent(type, target, attempt + 1), 1500); // Tracker startet noch
      return;
    }
    const device = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
    const data = JSON.stringify({
      session_id: sessionId,
      path: window.location.pathname + window.location.search,
      events: [{ type, target, viewport_w: window.innerWidth, viewport_h: window.innerHeight, device }],
    });
    const url = `${API_BASE}/track/event`;
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
    else fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(() => {});
  } catch { /* Statistik ist optional */ }
}

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  maps: boolean;
  marketing: boolean;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  maps: false,
  marketing: false,
};

export default function CookieBanner() {
  const t = useTranslations('cookie');
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({ ...DEFAULT_PREFERENCES });
  const [animateOut, setAnimateOut] = useState(false);
  const [style, setStyle] = useState<BannerStyle>('bottom');

  useEffect(() => {
    let consent: string | null = null;
    try { consent = localStorage.getItem('cookie_consent'); } catch { /* ignore */ }
    if (consent) return;
    let alive = true;
    // Darstellung laden (fällt bei Fehler auf "unten" zurück); kleine Verzögerung, damit die Seite zuerst lädt
    const styleP: Promise<BannerStyle> = fetch(`${API_BASE}/settings`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: Record<string, string>) => (j.cookie_banner_style === 'popup' ? 'popup' : 'bottom') as BannerStyle)
      .catch(() => 'bottom' as BannerStyle);
    const timer = setTimeout(() => {
      styleP.then((st) => {
        if (!alive) return;
        setStyle(st);
        setVisible(true);
        trackConsent('consent_shown', st);
      });
    }, 800);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  function closeWithAnimation(callback: () => void) {
    setAnimateOut(true);
    setTimeout(() => {
      callback();
      setVisible(false);
    }, 300);
  }

  function acceptAll() {
    const all: CookiePreferences = { necessary: true, analytics: true, maps: true, marketing: true };
    localStorage.setItem('cookie_consent', JSON.stringify(all));
    updateGtagConsent();
    trackConsent('consent', `all|${style}`);
    closeWithAnimation(() => {});
  }

  function acceptSelected() {
    localStorage.setItem('cookie_consent', JSON.stringify(preferences));
    updateGtagConsent();
    trackConsent('consent', `custom|${style}`);
    closeWithAnimation(() => {});
  }

  function declineAll() {
    localStorage.setItem('cookie_consent', JSON.stringify(DEFAULT_PREFERENCES));
    updateGtagConsent();
    trackConsent('consent', `necessary|${style}`);
    closeWithAnimation(() => {});
  }

  function togglePreference(key: keyof CookiePreferences) {
    if (key === 'necessary') return; // Can't disable necessary
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (!visible) return null;

  const cookieCategories: { key: keyof CookiePreferences; icon: React.ReactNode; locked?: boolean }[] = [
    { key: 'necessary', icon: <Lock size={16} className="text-primary-600" />, locked: true },
    { key: 'maps', icon: <Map size={16} className="text-primary-600" /> },
    { key: 'analytics', icon: <BarChart3 size={16} className="text-primary-600" /> },
    { key: 'marketing', icon: <Megaphone size={16} className="text-primary-600" /> },
  ];

  const categoriesPanel = (
    <div className="mt-2 space-y-2 animate-fade-in">
      {cookieCategories.map(({ key, icon, locked }) => (
        <div
          key={key}
          className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
            preferences[key]
              ? 'border-primary-200 bg-primary-50/50'
              : 'border-gray-100 bg-gray-50/50'
          }`}
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="mt-0.5">{icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{t(key)}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t(`${key}_desc`)}</p>
            </div>
          </div>
          <div className="ml-3 shrink-0">
            {locked ? (
              <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full whitespace-nowrap">
                {t('always_active')}
              </span>
            ) : (
              <button
                onClick={() => togglePreference(key)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  preferences[key] ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    preferences[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Confirm selection button */}
      <button
        onClick={acceptSelected}
        className="w-full bg-gold-400 hover:bg-gold-500 text-primary-700 font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg text-sm mt-3"
      >
        {t('accept_selected')}
      </button>
    </div>
  );

  if (style === 'bottom') {
    // Leiste unten, ohne Abdunkeln: Seite bleibt benutzbar, bis eine Wahl getroffen ist
    return (
      <div className={`fixed inset-x-0 bottom-0 z-[999] p-1.5 sm:p-4 pointer-events-none ${animateOut ? 'animate-cookie-out' : 'animate-cookie-in'}`}>
        <div className="pointer-events-auto mx-auto max-w-3xl bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.25)] ring-1 ring-black/5 overflow-hidden">
          <div className="px-3 py-2 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 flex-1">
              <Cookie size={20} className="text-gold-500 shrink-0 mt-0.5 w-4 h-4 sm:w-5 sm:h-5" />
              <p className="text-[12px] leading-[1.3] text-gray-600 sm:hidden">
                {t('message_mobile')}{' '}
                <Link href="/datenschutz" className="text-primary-600 underline underline-offset-2 whitespace-nowrap">{t('privacy_short')}</Link>
              </p>
              <p className="hidden sm:block text-[13px] leading-snug text-gray-600">
                {t('message_short')}{' '}
                <Link href="/datenschutz" className="text-primary-600 underline underline-offset-2 whitespace-nowrap">{t('privacy')}</Link>
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={declineAll}
                className="flex-1 sm:flex-none border-2 border-gray-200 hover:border-primary-300 text-gray-700 hover:text-primary-600 font-semibold py-1.5 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[13px] sm:text-sm transition-colors">
                {t('decline_all')}
              </button>
              <button onClick={acceptAll}
                className="flex-1 sm:flex-none bg-primary-600 hover:bg-primary-700 text-white font-semibold py-1.5 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[13px] sm:text-sm transition-colors">
                {t('accept_all')}
              </button>
            </div>
          </div>
          <button onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-1.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-primary-600 hover:text-primary-700 font-medium border-t border-gray-100">
            {t('settings')} {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDetails && <div className="px-4 pb-4 max-h-[50vh] overflow-y-auto">{categoriesPanel}</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[998] transition-opacity duration-300 ${
          animateOut ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Cookie Popup */}
      <div className={`fixed inset-0 z-[999] flex items-center justify-center p-4 ${
        animateOut ? 'animate-cookie-out' : 'animate-cookie-in'
      }`}>
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Cookie size={24} className="text-gold-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('title')}</h3>
                <p className="text-primary-200 text-xs mt-0.5 flex items-center gap-1">
                  <Shield size={10} />
                  DSGVO / GDPR
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('message')}
            </p>

            {/* Quick action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={acceptAll}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg text-sm"
              >
                {t('accept_all')}
              </button>
              <button
                onClick={declineAll}
                className="flex-1 border-2 border-gray-200 hover:border-primary-300 text-gray-700 hover:text-primary-600 font-semibold py-3 px-4 rounded-xl transition-all duration-200 text-sm"
              >
                {t('decline_all')}
              </button>
            </div>

            {/* Settings toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-center gap-2 mt-3 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              {t('settings')}
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Cookie categories */}
            {showDetails && categoriesPanel}
          </div>

          {/* Footer */}
          <div className="px-6 py-2.5 bg-primary-700">
            <div className="flex items-center justify-between">
              <Link
                href="/datenschutz"
                className="text-xs text-white/80 hover:text-white underline underline-offset-2"
              >
                {t('privacy')}
              </Link>
              {/* Gleiche Datei/Größen wie im Header → schon im Browser-Cache, kein Extra-Download */}
              <img
                src="/images/logo-wide.webp"
                srcSet="/images/logo-wide-320.webp 320w, /images/logo-wide-400.webp 400w, /images/logo-wide-640.webp 640w, /images/logo-wide.webp 823w"
                sizes="(min-width: 1024px) 300px, 200px"
                alt="flughafen-muenchen.taxi" width={823} height={132} className="h-4 w-auto" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
