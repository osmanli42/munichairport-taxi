'use client';

import { useEffect, useRef } from 'react';
import { Calendar, User, Users, Luggage, Check, Zap } from 'lucide-react';
import s from './StepAnimations.module.css';

// Ornek rota: MUC → München Hbf (popular-routes'taki gercek fiyatlar, Kasim 2026).
const L = {
  de: {
    from: 'Flughafen München (MUC)', to: 'München Hauptbahnhof', date: 'Fr. 20.11. · 14:30', btn: 'Preis berechnen',
    fixed: 'Festpreis', meta: 'Kombi · 40 Min.', fast: 'in 0,4 Sek.',
    kombi: 'Kombi', van: 'Van', gross: 'Großraumtaxi', note: 'Festpreis · kein Stauaufpreis',
    arrivals: 'Ankunft · Arrivals', landed: 'GELANDET', mr: 'Herr Müller', terminal: 'Terminal 2', signBar: 'Ihr Fahrer', welcome: 'Willkommen in München',
  },
  en: {
    from: 'Munich Airport (MUC)', to: 'Munich Central Station', date: 'Fri 20 Nov · 2:30 pm', btn: 'Calculate price',
    fixed: 'Fixed price', meta: 'Kombi · 40 min', fast: 'in 0.4 sec',
    kombi: 'Kombi', van: 'Van', gross: 'Large taxi', note: 'Fixed price · no traffic surcharge',
    arrivals: 'Arrivals', landed: 'LANDED', mr: 'Mr Miller', terminal: 'Terminal 2', signBar: 'Your driver', welcome: 'Welcome to Munich',
  },
  tr: {
    from: 'Münih Havalimanı (MUC)', to: 'Münih Merkez İstasyonu', date: 'Cum 20.11. · 14:30', btn: 'Fiyat hesapla',
    fixed: 'Sabit fiyat', meta: 'Kombi · 40 dk', fast: '0,4 sn’de',
    kombi: 'Kombi', van: 'Van', gross: 'Büyük taksi', note: 'Sabit fiyat · trafik ek ücreti yok',
    arrivals: 'Varış · Arrivals', landed: 'İNDİ', mr: 'Bay Müller', terminal: 'Terminal 2', signBar: 'Sürücünüz', welcome: 'Münih’e hoş geldiniz',
  },
} as const;

type Lang = keyof typeof L;

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      el?.setAttribute('data-play', '');
      return;
    }
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          // Ilk gorunuste dongu bastan baslasin (bos form → yazma → fiyat)
          if (first) {
            first = false;
            el.getAnimations?.({ subtree: true }).forEach((a) => { a.currentTime = 0; });
          }
          el.setAttribute('data-play', '');
        } else el.removeAttribute('data-play');
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Step1({ t }: { t: (typeof L)[Lang] }) {
  return (
    <div className={`${s.stage} ${s.bgLight}`}>
      <div className={`${s.panel} ${s.form}`}>
        <div className={`${s.field} ${s.field1}`}>
          <span className={s.dotO} />
          <span className={s.type1}>{t.from}</span>
        </div>
        <div className={`${s.field} ${s.field2}`}>
          <span className={s.dotF} />
          <span className={s.type2}>{t.to}</span>
        </div>
        <div className={s.chips}>
          <span className={s.chip}><Calendar size="1.05em" strokeWidth={2.4} />{t.date}</span>
          <span className={s.chip}><User size="1.05em" strokeWidth={2.4} />2</span>
        </div>
        <div className={s.btn}>{t.btn}</div>
      </div>
      <div className={`${s.panel} ${s.price}`}>
        <div className={s.priceLabel}>{t.fixed}</div>
        <div className={s.priceValue}>96 €</div>
        <div className={s.priceMeta}>{t.meta}</div>
        <div className={s.priceOk}><Zap size="1.05em" strokeWidth={2.6} />{t.fast}</div>
      </div>
    </div>
  );
}

function Step2({ t }: { t: (typeof L)[Lang] }) {
  const rows = [
    { img: '/images/kombi-thumb.webp', name: t.kombi, pax: 4, lug: 3, price: '96 €' },
    { img: '/images/van-thumb.webp', name: t.van, pax: 7, lug: 6, price: '106 €' },
    { img: '/images/grossraumtaxi-thumb.webp', name: t.gross, pax: 8, lug: 8, price: '109 €' },
  ];
  return (
    <div className={`${s.stage} ${s.bgLight}`}>
      <div className={`${s.panel} ${s.list}`}>
        <div className={s.rows}>
          <div className={s.ring}>
            <span className={s.check}><Check size="0.85em" strokeWidth={3.5} /></span>
          </div>
          {rows.map((r) => (
            <div key={r.name} className={s.row}>
              <img src={r.img} alt="" width={176} height={76} loading="lazy" decoding="async" className={s.thumb} />
              <div>
                <div className={s.rowName}>{r.name}</div>
                <div className={s.rowMeta}>
                  <span><Users size="1.05em" strokeWidth={2.2} />{r.pax}</span>
                  <span><Luggage size="1.05em" strokeWidth={2.2} />{r.lug}</span>
                </div>
              </div>
              <div className={s.rowPrice}>{r.price}</div>
            </div>
          ))}
        </div>
        <div className={s.note}>{t.note}</div>
      </div>
    </div>
  );
}

function Step3({ t }: { t: (typeof L)[Lang] }) {
  return (
    <div className={`${s.stage} ${s.bgTerminal}`}>
      <div className={s.board}>
        <div className={s.boardHead}><b>{t.arrivals}</b><span>14:32</span></div>
        <div className={`${s.boardRow} ${s.rowHighlight}`}>
          <span className={s.flight}>LH 2405</span>
          <span className={s.city}>FRANKFURT</span>
          <span className={s.status}>
            <span className={s.statusOld}>14:30</span>
            <span className={s.statusNew}>{t.landed}</span>
          </span>
        </div>
        <div className={s.boardRow}>
          <span className={s.flight}>EW 8044</span>
          <span className={s.city}>HAMBURG</span>
          <span className={s.status}><span>14:50</span></span>
        </div>
        <div className={s.boardRow}>
          <span className={s.flight}>TK 1631</span>
          <span className={s.city}>ISTANBUL</span>
          <span className={s.status}><span>15:05</span></span>
        </div>
      </div>
      <div className={s.sign}>
        <div className={s.signBar}>{t.signBar}</div>
        <div className={s.signName}>{t.mr}</div>
        <div className={s.signMeta}>LH 2405 · {t.terminal}</div>
      </div>
      <div className={s.ride}>
        <img src="/images/step-3-einsteigen.webp?v=1" alt="" width={720} height={346} loading="lazy" decoding="async" className={s.rideImg} />
        <span className={s.rideChip}><Check size="1.1em" strokeWidth={3} />{t.welcome}</span>
      </div>
    </div>
  );
}

export default function StepAnimation({ step, locale }: { step: number; locale: string }) {
  const ref = useInView<HTMLDivElement>();
  const t = L[(locale in L ? locale : 'de') as Lang];
  return (
    <div ref={ref} className={s.root} aria-hidden="true">
      {step === 0 ? <Step1 t={t} /> : step === 1 ? <Step2 t={t} /> : <Step3 t={t} />}
    </div>
  );
}
