import React from 'react'

/* ========== COOKIE ART ==========
 * Desenhos SVG de cookies de verdade, com textura por sabor.
 * Cores em tema claro/escuro (via CSS vars) e sombra caramel.
 */
interface Props {
  name: string
  size?: number
  className?: string
}

const VARIANTS: Record<string, { base: string; spots: string[]; chips: string | undefined }> = {
  'Nutella': {
    base: '#6b3a1f',
    spots: ['#8a4a22', '#7a3f1c', '#5e3018', '#8d5126'],
    chips: '#f7e6c4',
  },
  'Kinder': {
    base: '#8c5a2b',
    spots: ['#a06a30', '#7d4f24', '#96602a', '#b0753a'],
    chips: '#f7e6c4',
  },
  'Tradicional': {
    base: '#c8903f',
    spots: ['#d9a14b', '#b67c34', '#cf9842', '#e0ab5c'],
    chips: '#5a3215',
  },
  'Meio Amargo': {
    base: '#4a2a15',
    spots: ['#5c3518', '#3f2210', '#5a3114', '#6b3d1c'],
    chips: '#8a5a28',
  },
}

const FALLBACK = VARIANTS['Tradicional']

export function CookieArt({ name, size = 72, className }: Props) {
  const v = VARIANTS[name] || Object.values(VARIANTS).find(x => name.toLowerCase().includes(x === VARIANTS['Tradicional'] ? 'trad' : name.toLowerCase())) || FALLBACK
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}
      style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' }} aria-label={name}>
      {/* cookie body */}
      <circle cx="50" cy="50" r="42" fill={v.base} />
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="2" />
      {/* texture spots */}
      {v.spots.map((c, i) => (
        <ellipse key={i} cx={35 + (i % 2) * 28 + i * 3} cy={28 + i * 11 + (i % 2) * 6} rx="9" ry="6"
          fill={c} opacity="0.5" transform={`rotate(${i * 40} ${35 + (i % 2) * 28 + i * 3} ${28 + i * 11})`} />
      ))}
      {/* chocolate chips */}
      {v.chips && [0, 1, 2, 3, 4, 5].map(i => (
        <g key={`c${i}`} transform={`rotate(${i * 60} 50 50)`}>
          <circle cx="50" cy="21" r="5.5" fill={v.chips} />
          <circle cx="50" cy="21" r="4" fill={v.chips} opacity="0.6" />
          <ellipse cx="50" cy="21" rx="2" ry="1.4" fill="#fff" opacity="0.35" />
        </g>
      ))}
      {/* slight top highlight */}
      <ellipse cx="38" cy="28" rx="22" ry="12" fill="#ffffff" opacity="0.10" />
      <ellipse cx="34" cy="25" rx="10" ry="6" fill="#ffffff" opacity="0.10" />
    </svg>
  )
}

/* Banner/header de cookie grande */
export function CookieBanner({ name, label }: { name: string; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
      <CookieArt name={name} size={64} />
      <div style={{ fontWeight: 700, fontSize: '1.15em' }}>{label || name}</div>
    </div>
  )
}
