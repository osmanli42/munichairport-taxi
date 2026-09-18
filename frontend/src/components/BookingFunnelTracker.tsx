'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const FLUSH_INTERVAL_MS = 5_000;

/**
 * Rezervasyon hunisinde "neden vazgeçti" sinyallerini toplar.
 *
 * Tasarım kararı: burada hiçbir form mantığına dokunulmaz — yalnızca document seviyesinde
 * dinleyiciler ve bir MutationObserver kullanılır. Alanlar `[data-field]` / `[data-field-error]`
 * attribute'larından okunur (buchen/page.tsx içindeki ortak FieldBox sarmalayıcısı bunları
 * yazar), böylece her alan için ayrı enstrümantasyon gerekmez.
 *
 * Gizlilik: yalnızca ALAN ADI ve HATA METNİ gönderilir — girilen değerler asla gönderilmez.
 *
 * Olay tipleri (visitor_events.type, VARCHAR(20) — şema değişikliği yok):
 *  - field_focus : kullanıcı bir alana odaklandı  → son odaklanılan alan = terk noktası
 *  - field_error : bir alanda doğrulama hatası göründü
 *  - js_error    : yakalanmamış JS hatası / promise reddi
 *  - price_shown : müşterinin gördüğü en düşük fiyat (fiyat|km|araç)
 *  - call_click  : telefon / WhatsApp tıklaması — bu müşteri "vazgeçmedi", kanal değiştirdi
 *  - tab_away    : fiyat/form sayfasında sekmeden ayrılıp geri döndü (saniye) — karşılaştırma
 *  - price_copy  : fiyat kopyalandı — rakip karşılaştırma sinyali
 */
// "http://host/api/bookings?x=1" → "/bookings" — hata etiketini kısa ve gruplanabilir tutar
function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/api/, '') || '/';
  } catch {
    return url.slice(0, 60);
  }
}

export default function BookingFunnelTracker() {
  const pathname = usePathname();
  const queueRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    if (pathname.startsWith('/admin')) return;

    const sessionId = sessionStorage.getItem('mt_session_id');
    if (!sessionId) return; // VisitorTracker/SessionRecorder henüz başlamadı

    const fullUrl = window.location.pathname + window.location.search;
    const device = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';

    const push = (type: string, target: string) => {
      if (!target) return;
      queueRef.current.push({ type, target: target.slice(0, 250), device });
    };

    const flush = () => {
      if (queueRef.current.length === 0) return;
      const events = queueRef.current.splice(0, queueRef.current.length);
      const data = JSON.stringify({ session_id: sessionId, path: fullUrl, events });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${API_BASE}/track/event`, new Blob([data], { type: 'application/json' }));
        } else {
          fetch(`${API_BASE}/track/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // izleme asla UX'i bozmamalı
      }
    };

    // --- 1) Alan odağı: oturumun son field_focus'u = kullanıcının takıldığı alan ---
    let lastField = '';
    const onFocusIn = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-field]') as HTMLElement | null;
      const name = el?.getAttribute('data-field') || '';
      if (!name || name === lastField) return; // aynı alanda gidip gelmeyi tekrar yazma
      lastField = name;
      push('field_focus', name);
    };

    // --- 2) Doğrulama hataları: FieldBox hata metnini data-field-error olarak yansıtır ---
    const seenErrors = new Set<string>();
    const reportOne = (el: HTMLElement) => {
      const msg = el.getAttribute('data-field-error') || '';
      if (!msg) return; // hata temizlendi
      const field = el.getAttribute('data-field') || '';
      const key = `${field}|${msg}`;
      if (seenErrors.has(key)) return; // aynı hata oturumda bir kez
      seenErrors.add(key);
      push('field_error', `${field}: ${msg}`);
    };
    const reportErrors = (root: ParentNode | Element) => {
      if ((root as HTMLElement).getAttribute?.('data-field-error')) reportOne(root as HTMLElement);
      (root as Element).querySelectorAll?.('[data-field-error]')
        .forEach((node) => reportOne(node as HTMLElement));
    };
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target.nodeType === 1) reportOne(m.target as HTMLElement);
        m.addedNodes?.forEach((n) => { if (n.nodeType === 1) reportErrors(n as Element); });
      }
    });

    // --- 3) Gösterilen fiyat: müşterinin GÖRDÜĞÜ en düşük fiyat + mesafe + araç ---
    // Fiyat burada yeniden hesaplanmaz; /ergebnisse kartlarındaki data-price okunur, böylece
    // katmanlı tarife (Pflichttarif, Festpreis, indirim) ile sapma olmaz.
    let priceSent = false;
    const reportPrice = () => {
      if (priceSent) return;
      const cards = Array.from(document.querySelectorAll('[data-price]')) as HTMLElement[];
      if (cards.length === 0) return;
      let best: { price: number; vehicle: string } | null = null;
      for (const c of cards) {
        const p = Number(c.getAttribute('data-price'));
        if (!Number.isFinite(p) || p <= 0) continue;
        if (!best || p < best.price) best = { price: p, vehicle: c.getAttribute('data-vehicle') || '' };
      }
      if (!best) return;
      priceSent = true;
      const km = new URLSearchParams(window.location.search).get('distance_km') || '';
      push('price_shown', `${best.price.toFixed(2)}|${km}|${best.vehicle}`);
    };

    // --- 4) Telefon / WhatsApp: kanal değiştiren müşteri terk sayılmamalı ---
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (/^tel:/i.test(href)) push('call_click', `tel ${href.replace(/^tel:/i, '').slice(0, 40)}`);
      else if (/^whatsapp:|wa\.me|api\.whatsapp\.com/i.test(href)) push('call_click', 'whatsapp');
    };

    // --- 5) Sekmeden ayrılma süresi: fiyat gördükten sonra uzun ayrılma = karşılaştırma ---
    const onPriceOrForm = /\/(ergebnisse|buchen)(\/|\?|$)/.test(fullUrl);
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        flush();
      } else if (hiddenAt && onPriceOrForm) {
        const away = Math.round((Date.now() - hiddenAt) / 1000);
        hiddenAt = 0;
        // 10 sn altı ayrılmalar gürültü (bildirim, kilit ekranı); üst sınır 30 dk
        if (away >= 10 && away <= 1800) push('tab_away', `${away}s`);
      }
    };

    // --- 6) Fiyat kopyalama ---
    const onCopy = () => {
      if (!onPriceOrForm) return;
      const sel = (window.getSelection?.()?.toString() || '').trim();
      if (sel && /\d/.test(sel) && sel.length <= 60) push('price_copy', sel.slice(0, 60));
    };

    // --- 7) Sessiz API hataları: müşteri "bir şey olmadı" deyip gider, kayıtta iz kalmaz ---
    // window.fetch yalnızca KENDİ API origin'imize giden istekler için sarılır; hata yoksa
    // hiçbir şey gönderilmez ve orijinal davranış aynen korunur (hata da yeniden fırlatılır).
    const origFetch = window.fetch;
    const apiOrigin = (() => { try { return new URL(API_BASE).origin; } catch { return ''; } })();
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      let url = '';
      try { url = typeof input === 'string' ? input : (input as Request).url || String(input); } catch {}
      const isOwnApi = !!apiOrigin && url.startsWith(apiOrigin);
      // Kendi izleme çağrılarımız hariç tutulur — hata döngüsü oluşmasın
      const isTracking = /\/track\//.test(url);
      try {
        const res = await origFetch(input as any, init);
        if (isOwnApi && !isTracking && !res.ok) {
          const method = (init?.method || (input as Request)?.method || 'GET').toUpperCase();
          push('api_error', `${method} ${shortPath(url)} ${res.status}`);
        }
        return res;
      } catch (err: any) {
        if (isOwnApi && !isTracking) {
          const method = (init?.method || 'GET').toUpperCase();
          push('api_error', `${method} ${shortPath(url)} network`);
          flush();
        }
        throw err;
      }
    };
    window.fetch = wrappedFetch;

    // --- 8) Sessiz teknik hatalar ---
    const onError = (e: ErrorEvent) => push('js_error', `${e.message || 'error'} @ ${(e.filename || '').split('/').pop()}:${e.lineno || 0}`);
    const onRejection = (e: PromiseRejectionEvent) => push('js_error', `unhandled: ${String((e.reason as any)?.message || e.reason || '').slice(0, 120)}`);

    document.addEventListener('focusin', onFocusIn, true);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-field-error'], subtree: true, childList: true });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    reportErrors(document); // ilk render'da zaten görünen hatalar
    reportPrice();
    // Fiyatlar API'den sonra geldiği için kısa bir süre boyunca tekrar denenir
    const priceTimer = window.setInterval(() => { reportPrice(); if (priceSent) window.clearInterval(priceTimer); }, 1_000);
    window.setTimeout(() => window.clearInterval(priceTimer), 20_000);

    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);

    const timer = window.setInterval(flush, FLUSH_INTERVAL_MS);
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);

    return () => {
      flush();
      window.clearInterval(timer);
      window.clearInterval(priceTimer);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      // Başka bir kod arada fetch'i tekrar sarmışsa üzerine yazmayalım
      if (window.fetch === wrappedFetch) window.fetch = origFetch;
      observer.disconnect();
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('pagehide', onHide);
    };
  }, [pathname]);

  return null;
}
