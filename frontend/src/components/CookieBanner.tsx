'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield, ChevronDown, ChevronUp, Cookie } from 'lucide-react';
import { updateGtagConsent } from '@/lib/gtag';

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

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Small delay so page loads first
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
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
    closeWithAnimation(() => {});
  }

  function acceptSelected() {
    localStorage.setItem('cookie_consent', JSON.stringify(preferences));
    updateGtagConsent();
    closeWithAnimation(() => {});
  }

  function declineAll() {
    localStorage.setItem('cookie_consent', JSON.stringify(DEFAULT_PREFERENCES));
    updateGtagConsent();
    closeWithAnimation(() => {});
  }

  function togglePreference(key: keyof CookiePreferences) {
    if (key === 'necessary') return; // Can't disable necessary
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (!visible) return null;

  const cookieCategories: { key: keyof CookiePreferences; icon: string; locked?: boolean }[] = [
    { key: 'necessary', icon: '🔒', locked: true },
    { key: 'maps', icon: '🗺️' },
    { key: 'analytics', icon: '📊' },
    { key: 'marketing', icon: '📢' },
  ];

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
            {showDetails && (
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
                      <span className="text-lg mt-0.5">{icon}</span>
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
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Link
                href="/datenschutz"
                className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
              >
                {t('privacy')}
              </Link>
              <span className="text-[10px] text-gray-400">munichairport.taxi</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
