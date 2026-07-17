// Small inline SVG flags for the language switcher (replaces emoji flags,
// which render inconsistently across platforms and look unprofessional).
export default function FlagIcon({ code, size = 16 }: { code: string; size?: number }) {
  const h = Math.round(size * 0.7);
  const common = { width: size, height: h, viewBox: '0 0 30 21', className: 'inline-block rounded-[2px] shrink-0' } as const;
  if (code === 'de') {
    return (
      <svg {...common} aria-hidden="true">
        <rect width="30" height="7" fill="#000" />
        <rect y="7" width="30" height="7" fill="#DD0000" />
        <rect y="14" width="30" height="7" fill="#FFCE00" />
      </svg>
    );
  }
  if (code === 'en') {
    return (
      <svg {...common} aria-hidden="true">
        <rect width="30" height="21" fill="#012169" />
        <path d="M0,0 L30,21 M30,0 L0,21" stroke="#fff" strokeWidth="4" />
        <path d="M0,0 L30,21 M30,0 L0,21" stroke="#C8102E" strokeWidth="2" />
        <path d="M15,0 V21 M0,10.5 H30" stroke="#fff" strokeWidth="7" />
        <path d="M15,0 V21 M0,10.5 H30" stroke="#C8102E" strokeWidth="4" />
      </svg>
    );
  }
  if (code === 'tr') {
    return (
      <svg {...common} aria-hidden="true">
        <rect width="30" height="21" fill="#E30A17" />
        <circle cx="12" cy="10.5" r="5.2" fill="#fff" />
        <circle cx="13.4" cy="10.5" r="4.2" fill="#E30A17" />
        <path d="M18.2,10.5 l3.6,1.17 -2.22-3.06 v3.78 l2.22-3.06 z" fill="#fff" />
      </svg>
    );
  }
  return null;
}
