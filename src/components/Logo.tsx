interface LogoProps {
  /** Show the tagline under the wordmark. */
  tagline?: boolean;
  inverse?: boolean;
}

/** The lamp/beam glyph on a navy tile. Decorative when used next to a text label. */
export function LogoMark({ decorative = true }: { decorative?: boolean }) {
  return (
    <svg
      className="logo-mark"
      viewBox="0 0 64 64"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'OfficeLume logo' })}
      focusable="false"
    >
      <rect width="64" height="64" rx="14" fill="#0b2a4a" />
      <path
        d="M32 12c-8.8 0-16 6.9-16 15.4 0 5 2.5 9.4 6.4 12.2V44c0 1.7 1.3 3 3 3h13.2c1.7 0 3-1.3 3-3v-4.4c3.9-2.8 6.4-7.2 6.4-12.2C48 18.9 40.8 12 32 12Z"
        fill="#ffffff"
      />
      <path d="M27 51h10" stroke="#3b9cff" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 20v13m0 0-5-5m5 5 5-5" stroke="#1a73e8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** OfficeLume mark plus the wordmark. */
export function Logo({ tagline = false, inverse = false }: LogoProps) {
  return (
    <span className={inverse ? 'logo logo-inverse' : 'logo'}>
      <LogoMark decorative={false} />
      <span className="logo-text">
        <span className="logo-word">
          Office<span className="logo-accent">Lume</span>
        </span>
        {tagline && <span className="logo-tagline">Less admin. More service.</span>}
      </span>
    </span>
  );
}
