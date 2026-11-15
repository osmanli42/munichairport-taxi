import ReactDOM from 'react-dom';

// Hero-Foto der Startseite. Standard: Mercedes E-Klasse (2026) am Terminal, auf dem Handy vollflächig.
// Saisonbild (System → Hero-Kalender): am Computer vollflächig hinter dem Text, auf dem Handy als
// eigenes Bild zwischen Text und Suche (HeroSeasonMobilePhoto).
const DIR = '/images/hero-seasons';
// 1×1 transparent: auf der jeweils anderen Bildschirmgröße wird das nicht gezeigte Foto gar nicht geladen
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export default function HeroBackground({ img }: { img: string | null }) {
  if (!img) {
    // LCP: Preload, damit der Download sofort startet (Handy bekommt die 1200px-Version, ~38 KB statt 100 KB)
    ReactDOM.preload('/images/hero-taxi-2026.webp', {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: '/images/hero-taxi-2026-1200.webp 1200w, /images/hero-taxi-2026.webp 2400w',
      imageSizes: '(min-width: 1024px) 84vw, 100vw',
    });
    return (
      <img
        src="/images/hero-taxi-2026.webp"
        srcSet="/images/hero-taxi-2026-1200.webp 1200w, /images/hero-taxi-2026.webp 2400w"
        sizes="(min-width: 1024px) 84vw, 100vw"
        alt=""
        width={2400}
        height={1018}
        fetchPriority="high"
        className="absolute right-0 top-0 h-full w-full lg:w-[84%] object-cover object-[64%_center] lg:object-right"
      />
    );
  }

  const web = `${DIR}/${img}-web.webp`;
  const webSet = `${DIR}/${img}-web-1200.webp 1200w, ${web} 2400w`;
  // Kein Preload: je Bildschirmgröße lädt nur das eigene Foto (<picture> + fetchPriority, der Browser findet es im HTML)
  return (
    <picture>
      <source media="(max-width: 1023px)" srcSet={BLANK} />
      <img
        src={web}
        srcSet={webSet}
        sizes="100vw"
        alt=""
        width={2400}
        height={1018}
        fetchPriority="high"
        data-hero-season={img}
        className="absolute inset-0 h-full w-full object-cover object-right hidden lg:block"
      />
    </picture>
  );
}

// Handy: Saisonfoto zwischen Text und Suche — oben weich in den dunklen Textbereich übergehend
export function HeroSeasonMobilePhoto({ img, snow }: { img: string; snow?: boolean }) {
  const fade = 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,.18) 8%, rgba(0,0,0,.55) 18%, rgba(0,0,0,.88) 28%, #000 38%, #000 80%, rgba(0,0,0,.7) 90%, transparent 100%)';
  return (
    <div className="lg:hidden relative -mx-4 sm:-mx-8 -mt-1 -mb-5 h-[62vw] max-h-[460px] pointer-events-none" aria-hidden="true">
      <picture>
        <source media="(min-width: 1024px)" srcSet={BLANK} />
        <img
          src={`${DIR}/${img}-mobile.webp`}
          alt=""
          width={1100}
          height={819}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[center_45%]"
          style={{ WebkitMaskImage: fade, maskImage: fade }}
        />
      </picture>
      {snow && (
        <div className="absolute inset-0 opacity-60"
          style={{ backgroundImage: SNOW, backgroundSize: '1400px 700px', backgroundPosition: '-300px -260px', WebkitMaskImage: SNOW_FADE, maskImage: SNOW_FADE }} />
      )}
    </div>
  );
}

// Dezente Schneeflocken über dem ganzen Hero (Winter/Advent) — über Text und Foto, nach unten ausgeblendet
const SNOW = `url(${DIR}/snow.webp)`;
const SNOW_FADE = 'linear-gradient(180deg, #000 0%, #000 70%, transparent 100%)';

const GLOW = `url(${DIR}/glow.webp)`;

export function HeroSnow({ snow, glow }: { snow: boolean; glow: boolean }) {
  return (
    <>
      {glow && (
        <div className="absolute inset-0 opacity-50 lg:opacity-60" aria-hidden="true"
          style={{ backgroundImage: GLOW, backgroundSize: '1400px 700px', WebkitMaskImage: SNOW_FADE, maskImage: SNOW_FADE }} />
      )}
      {snow && (
        <div className="absolute inset-0 opacity-60 lg:opacity-70" aria-hidden="true"
          style={{ backgroundImage: SNOW, backgroundSize: '1400px 700px', WebkitMaskImage: SNOW_FADE, maskImage: SNOW_FADE }} />
      )}
    </>
  );
}
