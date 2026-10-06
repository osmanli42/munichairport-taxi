import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Check, MapPin, MessageCircle, Mail, Phone, Sparkles } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { DESTS, quote, eur } from '@/lib/guideQuote';
import { cityGeo } from '@/lib/citiesGeo';
import { cityImages } from '@/lib/cityImages';
import { SERVICES, serviceHref, lang, type ServiceKey } from '@/lib/services';
import { design, incIcons } from '../vehicles/design';
import { texts, SKI, SKI_MORE, FAR } from './content';

// Overview of all services (Leistungen). Prices live from the engine (cached 1 h, see guideQuote).

export const dynamic = 'force-dynamic';

const BASE = 'https://flughafen-muenchen.taxi';
const PATH = '/leistungen';
const KITZ = 'taxi-kitzbuehl-flughafen-muenchen';
type Props = { params: { locale: string } };

async function prices(l: string) {
  const g = cityGeo[KITZ];
  const [messe, hbf, kitz] = await Promise.all([
    quote(DESTS.messe),
    quote(DESTS.hbf),
    quote({ key: 'kitzbuehel', address: g.address, lat: g.lat, lng: g.lng, km: g.km, min: g.min }),
  ]);
  const f = (q: Awaited<ReturnType<typeof quote>>) => (q ? eur(q.kombi, l) : null);
  return { messe: f(messe), hbf: f(hbf), kitz: f(kitz) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = lang(params.locale);
  const t = texts(l, { messe: null, hbf: null, kitz: null });
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDesc,
    alternates: {
      canonical: l === 'de' ? `${BASE}${PATH}` : `${BASE}/${l}${PATH}`,
      languages: { de: `${BASE}${PATH}`, en: `${BASE}/en${PATH}`, tr: `${BASE}/tr${PATH}`, 'x-default': `${BASE}${PATH}` },
    },
    openGraph: { title: t.metaTitle, description: t.metaDesc, type: 'website', images: ['/images/hero-taxis.webp'] },
  };
}

const eyebrowCls = 'text-xs font-bold uppercase tracking-[0.2em] text-gold-600';
const h2Cls = 'mt-2 text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl';

export default async function LeistungenPage({ params }: Props) {
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const p = await prices(l);
  const t = texts(l, p);
  const svc = Object.fromEntries(SERVICES.map((s) => [s.key, s])) as Record<ServiceKey, (typeof SERVICES)[number]>;
  const city = (slug: string) => `${prefix}/blog/${slug}`;
  const url = `${BASE}${prefix}${PATH}`;
  const inc = design[l] || design.de;
  const usedImages = [KITZ, ...SKI.map(([s]) => s)].filter((s, i, a) => a.indexOf(s) === i && cityImages[s]);

  const schemas = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: t.crumb,
      itemListElement: SERVICES.map((s, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: {
          '@type': 'Service', name: s.text[l].title, description: s.text[l].text, url: `${BASE}${serviceHref(s, prefix)}`,
          provider: { '@type': 'TaxiService', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: BASE },
          areaServed: ['München', 'Bayern', 'Österreich', 'Schweiz'],
        },
      })),
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${BASE}${prefix}` },
      { '@type': 'ListItem', position: 2, name: t.crumb, item: url },
    ] },
  ];

  const contactButtons = (dark = false) => (
    <div className="mt-5 flex flex-wrap gap-2">
      <a href={CONTACT_INFO.phoneHref} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${dark ? 'bg-gold-400 text-primary-900 hover:bg-gold-300' : 'bg-primary-800 text-white hover:bg-primary-700'}`}><Phone size={16} /> {t.ask}</a>
      <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><MessageCircle size={16} /> {t.whatsapp}</a>
      <Link href={`${prefix}/contact`} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ring-1 ${dark ? 'text-white ring-white/30 hover:bg-white/10' : 'text-gray-800 ring-gray-300 hover:bg-gray-50'}`}><Mail size={16} /> {t.contact}</Link>
    </div>
  );

  // Large dark cards (airport, messe) open the grid, the other eight follow as white cards.
  const big: { key: ServiceKey; img: string; price: string | null }[] = [
    { key: 'airport', img: '/images/hero-airport.webp', price: t.priceCity },
    { key: 'messe', img: '/images/hero-taxis.webp', price: t.priceMesse },
  ];
  const small = SERVICES.filter((s) => s.key !== 'airport' && s.key !== 'messe');

  return (
    <div className="bg-gray-50">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-taxis.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[60%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/75 to-primary-900/30" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 md:pb-20">
          <nav className="mb-10 flex items-center gap-1.5 text-xs text-white/75">
            <Link href={prefix || '/'} className="hover:text-white">{t.home}</Link><ArrowRight size={12} /><span className="text-white">{t.crumb}</span>
          </nav>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold-300 ring-1 ring-white/20 backdrop-blur">
            <Sparkles size={14} /> {t.eyebrow}
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            {t.h1a} <span className="text-gold-400">{t.h1b}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/90 drop-shadow">{t.sub}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {t.jump.map(([href, label]) => (
              <a key={href} href={href} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-gold-400 hover:text-primary-900 hover:ring-gold-400">{label}</a>
            ))}
          </div>
          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-4 border-t border-white/15 pt-6 sm:grid-cols-4">
            {t.stats.map(([v, k]) => (
              <div key={k}><dt className="text-3xl font-extrabold text-gold-400">{v}</dt><dd className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/70">{k}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* All services */}
        <section id="alle" className="scroll-mt-24 pt-14">
          <div className="text-center">
            <div className={eyebrowCls}>{t.allEyebrow}</div>
            <h2 className={h2Cls}>{t.allTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">{t.allSub}</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {big.map(({ key, img, price }) => {
              const s = svc[key];
              const Icon = s.icon;
              const x = s.text[l];
              return (
                <Link key={key} href={serviceHref(s, prefix)} className="group relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-3xl bg-primary-900 p-6 text-white shadow-lg sm:col-span-1 lg:col-span-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/80 to-primary-900/20" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400 text-primary-900"><Icon size={24} /></span>
                      {price && <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold ring-1 ring-white/25 backdrop-blur">{price}</span>}
                    </div>
                    <h3 className="mt-4 text-2xl font-extrabold">{x.title}</h3>
                    <p className="mt-1.5 max-w-md text-sm text-white/85">{x.text}</p>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                      {x.bullets.map((b) => <li key={b} className="flex items-center gap-1.5 text-xs text-white/90"><Check size={14} className="text-gold-400" /> {b}</li>)}
                    </ul>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-gold-400">{x.cta} <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              );
            })}

            {small.map((s) => {
              const Icon = s.icon;
              const x = s.text[l];
              return (
                <Link key={s.key} href={serviceHref(s, prefix)} className="group flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-1 hover:shadow-xl hover:ring-gold-300">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 transition group-hover:bg-gold-400 group-hover:text-primary-900"><Icon size={24} /></span>
                  <h3 className="mt-4 text-lg font-extrabold text-gray-900">{x.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gold-600">{x.short}</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{x.text}</p>
                  <ul className="mt-3 space-y-1.5">
                    {x.bullets.map((b) => <li key={b} className="flex gap-2 text-xs text-gray-700"><Check size={14} className="mt-px shrink-0 text-emerald-600" /> {b}</li>)}
                  </ul>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-primary-700">{x.cta} <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Ski transfer */}
        <section id="ski" className="mt-20 scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="grid lg:grid-cols-[1fr_1.1fr]">
            <div className="relative min-h-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/cities/${KITZ}.webp`} alt="Kitzbühel" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-900/70 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-white/0" />
              {t.skiPrice && (
                <div className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-extrabold text-primary-900 shadow-lg">
                  <BadgeCheck size={18} className="text-gold-600" /> {t.skiPrice}
                </div>
              )}
            </div>
            <div className="p-6 md:p-10">
              <div className={eyebrowCls}>{t.skiEyebrow}</div>
              <h2 className={h2Cls}>{t.skiTitleA} <span className="text-primary-700">{t.skiTitleB}</span></h2>
              <p className="mt-3 text-gray-600">{t.skiSub}</p>
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {t.skiPoints.map((x) => <li key={x} className="flex gap-2 text-sm text-gray-700"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> {x}</li>)}
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 p-6 md:px-10">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SKI.map(([slug, name]) => (
                <Link key={slug} href={city(slug)} className="group relative h-28 overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/cities/${slug}-sm.webp`} alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-sm font-bold text-white">{name} <ArrowRight size={14} className="opacity-0 transition group-hover:opacity-100" /></span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-gray-500">{t.skiMore}:</span>
              {SKI_MORE.map(([slug, name]) => (
                <Link key={slug} href={city(slug)} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gold-100">{name}</Link>
              ))}
            </div>
          </div>
        </section>

        {/* Long distance */}
        <section id="fernfahrten" className="mt-20 scroll-mt-24">
          <div className="max-w-2xl">
            <div className={eyebrowCls}>{t.farEyebrow}</div>
            <h2 className={h2Cls}>{t.farTitle}</h2>
            <p className="mt-3 text-gray-600">{t.farSub}</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {FAR.map(({ region, places }) => (
              <div key={region.de} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h3 className="flex items-center gap-2 text-lg font-extrabold text-gray-900"><MapPin size={18} className="text-gold-600" /> {region[l]}</h3>
                <ul className="mt-4 divide-y divide-gray-100">
                  {places.map(([slug, name]) => (
                    <li key={slug}>
                      <Link href={city(slug)} className="group flex items-center justify-between py-2.5 text-sm font-semibold text-gray-700 hover:text-primary-700">
                        {name} <ArrowRight size={15} className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-primary-700" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Groups & events */}
        <section id="gruppen" className="relative mt-20 scroll-mt-24 overflow-hidden rounded-3xl bg-primary-900 text-white shadow-xl">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/20 blur-3xl" />
          <div className="relative grid items-center gap-8 p-6 md:p-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold-400">{t.grpEyebrow}</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{t.grpTitle}</h2>
              <p className="mt-3 text-white/85">{t.grpSub}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {t.grpUses.map((u) => <li key={u} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium ring-1 ring-white/15">{u}</li>)}
              </ul>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {t.grpPoints.map((x) => <li key={x} className="flex gap-2 text-sm text-white/90"><Check size={17} className="mt-0.5 shrink-0 text-gold-400" /> {x}</li>)}
              </ul>
              {contactButtons(true)}
            </div>
            <div className="relative">
              <div className="absolute inset-x-6 bottom-2 h-10 rounded-full bg-black/40 blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/grossraumtaxi.webp" alt="Großraumtaxi Mercedes Vito" loading="lazy" className="relative w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10" />
            </div>
          </div>
        </section>

        {/* Courier & patient transport */}
        <div className="mt-20 grid gap-5 lg:grid-cols-2">
          {([['kurier', 'courier', t.courierTitle, t.courierText, t.courierPoints, null], ['krankenfahrten', 'medical', t.medTitle, t.medText, t.medPoints, t.medNote]] as const).map(([id, key, title, text, points, note]) => {
            const Icon = svc[key].icon;
            return (
              <section key={id} id={id} className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Icon size={24} /></span>
                <h2 className="mt-4 text-2xl font-extrabold text-gray-900">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
                <ul className="mt-4 space-y-2">
                  {points.map((x) => <li key={x} className="flex gap-2 text-sm text-gray-700"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> {x}</li>)}
                </ul>
                {note && <p className="mt-3 text-xs text-gray-500">{note}</p>}
                {contactButtons()}
              </section>
            );
          })}
        </div>

        {/* Included */}
        <section className="mt-20">
          <div className="text-center">
            <div className={eyebrowCls}>{t.incEyebrow}</div>
            <h2 className={h2Cls}>{t.incTitle}</h2>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            {inc.items.map((it, i) => {
              const Icon = incIcons[i];
              return (
                <li key={it.title} className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-200">
                  <Icon size={22} className="mx-auto text-gold-600" />
                  <div className="mt-2 text-sm font-bold leading-snug text-gray-900">{it.title}</div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className={`${h2Cls} text-center`}>{t.faqTitle}</h2>
          <div className="mt-8 space-y-3">
            {t.faqs.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 open:ring-gold-300">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-gray-900">{q}<span className="shrink-0 text-2xl leading-none text-gray-400 transition group-open:rotate-45">+</span></summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="my-16 rounded-3xl bg-gradient-to-br from-gold-400 to-gold-500 p-8 text-center md:p-12">
          <h2 className="text-2xl font-extrabold text-primary-900 md:text-3xl">{t.ctaTitle}</h2>
          <p className="mt-2 text-primary-900/80">{t.ctaSub}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={prefix || '/'} className="rounded-xl bg-primary-900 px-8 py-3 font-bold text-white hover:bg-primary-800">{t.ctaBook} →</Link>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 hover:bg-primary-900 hover:text-white"><Phone size={18} /> {CONTACT_INFO.phone}</a>
          </div>
        </section>

        <p className="pb-10 text-[11px] leading-relaxed text-gray-400">
          {t.credits}: {usedImages.map((s, i) => {
            const img = cityImages[s];
            return <span key={s}>{i > 0 && ' · '}{img.artist}, <a href={img.source} target="_blank" rel="noopener noreferrer nofollow" className="underline">{img.license}</a></span>;
          })}
        </p>
      </div>
    </div>
  );
}
