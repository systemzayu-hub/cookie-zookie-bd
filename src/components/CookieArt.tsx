import React from 'react'

type CookieKind = 'tradicional' | 'meio-amargo' | 'nutella' | 'kinder'
type Props = { name: string; size?: number; className?: string }

const CHIPS = [
  [29, 30, 5, -18], [49, 23, 4.5, 12], [68, 31, 5.5, 28],
  [23, 50, 4.5, 20], [45, 47, 5, -10], [72, 53, 4.6, 8],
  [34, 69, 5.2, 30], [58, 70, 4.4, -22],
] as const

const CRUMBS = [
  [20, 39, 1.1], [35, 18, .9], [60, 19, 1.2], [79, 42, .9],
  [18, 61, .8], [48, 79, 1], [70, 72, 1.1], [38, 39, .7], [61, 57, .8],
] as const

function cookieKind(name: string): CookieKind {
  const value = name.toLocaleLowerCase('pt-BR')
  if (value.includes('meio amargo') || value.includes('meio-amargo') || value.includes('meioamargo')) return 'meio-amargo'
  if (value.includes('nutella')) return 'nutella'
  if (value.includes('kinder')) return 'kinder'
  return 'tradicional'
}

function CookieArtInner({ name, size = 72, className }: Props) {
  const kind = cookieKind(name)
  const small = size < 40
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (part: string) => `cookie-${part}-${uid}`
  const darkDough = kind === 'meio-amargo'

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Cookie de ${name}`}
      style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={id('dough')} cx="34%" cy="27%" r="76%">
          {darkDough ? (
            <>
              <stop offset="0" stopColor="#9a6844" />
              <stop offset=".48" stopColor="#75452d" />
              <stop offset=".82" stopColor="#56301f" />
              <stop offset="1" stopColor="#3a2016" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#f8dda0" />
              <stop offset=".45" stopColor="#e8bd70" />
              <stop offset=".8" stopColor="#bd7838" />
              <stop offset="1" stopColor="#895027" />
            </>
          )}
        </radialGradient>
        <linearGradient id={id('edge')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={darkDough ? '#6e402b' : '#c78743'} />
          <stop offset="1" stopColor={darkDough ? '#321b13' : '#76401f'} />
        </linearGradient>
        <radialGradient id={id('chip')} cx="30%" cy="24%" r="80%">
          <stop offset="0" stopColor="#6b432b" />
          <stop offset=".55" stopColor="#3a2116" />
          <stop offset="1" stopColor="#190e0a" />
        </radialGradient>
        <linearGradient id={id('hazelnut')} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f4d28c" />
          <stop offset="1" stopColor="#9b582d" />
        </linearGradient>
        <filter id={id('shadow')} x="-30%" y="-30%" width="170%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#2a1509" floodOpacity=".38" />
        </filter>
        <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <clipPath id={id('clip')}>
          <path d="M50 7 C61 6 69 10 78 17 C87 24 91 34 90 45 C94 57 88 68 80 77 C73 87 62 92 50 90 C39 94 27 88 19 80 C10 72 7 61 10 50 C6 39 11 27 19 19 C27 10 38 7 50 7Z" />
        </clipPath>
      </defs>

      <ellipse cx="50" cy="88" rx="34" ry="6" fill="#2a1509" opacity=".18" filter={`url(#${id('soft')})`} />
      <path d="M50 9 C62 8 72 12 80 20 C89 28 91 39 89 49 C92 60 87 72 78 80 C69 88 59 91 49 89 C37 92 26 87 18 78 C10 68 8 57 11 47 C8 36 13 26 21 18 C29 10 39 8 50 9Z" fill={`url(#${id('edge')})`} filter={`url(#${id('shadow')})`} />
      <path d="M50 7 C61 6 69 10 78 17 C87 24 91 34 90 45 C94 57 88 68 80 77 C73 87 62 92 50 90 C39 94 27 88 19 80 C10 72 7 61 10 50 C6 39 11 27 19 19 C27 10 38 7 50 7Z" fill={`url(#${id('dough')})`} />

      <g clipPath={`url(#${id('clip')})`}>
        <ellipse cx="39" cy="26" rx="27" ry="20" fill="#fff6d8" opacity={darkDough ? .08 : .2} />
        <path d="M15 68 C32 82 66 88 86 64" fill="none" stroke="#4b2514" strokeWidth="6" opacity=".13" />
        {!small && CRUMBS.map(([x, y, radius], index) => (
          <circle key={index} cx={x} cy={y} r={radius} fill={darkDough ? '#d39b68' : '#8d5027'} opacity=".32" />
        ))}
        {!small && (
          <g fill="none" stroke={darkDough ? '#3b2117' : '#9c5e2f'} strokeWidth="1.2" opacity=".42" strokeLinecap="round">
            <path d="M18 58 Q27 55 31 61 T43 62" />
            <path d="M55 16 Q58 23 65 25" />
            <path d="M53 79 Q57 72 64 70 T72 62" />
          </g>
        )}

        {kind !== 'nutella' && CHIPS.slice(0, small ? 5 : 8).map(([x, y, radius, rotation], index) => (
          <g key={index} transform={`rotate(${rotation} ${x} ${y})`}>
            <ellipse cx={x + .8} cy={y + 1.4} rx={radius * 1.08} ry={radius * .72} fill="#32170d" opacity=".38" />
            <path d={`M${x-radius} ${y-1} Q${x-radius*.45} ${y-radius} ${x+.5} ${y-radius*.7} Q${x+radius} ${y-radius*.2} ${x+radius*.85} ${y+radius*.6} Q${x} ${y+radius} ${x-radius} ${y-1}Z`} fill={`url(#${id('chip')})`} />
            {!small && <ellipse cx={x - radius * .25} cy={y - radius * .35} rx={radius * .22} ry={radius * .13} fill="#ffe9c6" opacity=".35" />}
          </g>
        ))}

        {kind === 'meio-amargo' && (
          <g>
            <path d="M54 32 L72 27 L78 40 L61 46Z" fill="#24120d" stroke="#120907" strokeWidth="1.5" />
            <path d="M58 33 L70 30 L73 38 L62 41Z" fill="#4a2a1d" />
            {!small && <path d="M64 31 L66 40 M57 36 L75 33" stroke="#76503a" strokeWidth=".8" opacity=".7" />}
          </g>
        )}

        {kind === 'nutella' && (
          <g>
            <path d="M22 51 C28 31 52 24 70 34 C84 42 81 62 67 71 C51 82 28 72 22 58 C32 67 48 68 61 61 C72 55 73 44 63 40 C52 35 37 40 33 51 C30 60 41 64 50 60 C58 57 61 49 55 46 C49 42 41 47 42 53" fill="none" stroke="#4b2417" strokeWidth={small ? 7 : 9} strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
            <path d="M25 48 C34 33 53 30 67 37" fill="none" stroke="#8b5137" strokeWidth="2.2" strokeLinecap="round" opacity=".8" />
            <circle cx="70" cy="64" r="7" fill={`url(#${id('hazelnut')})`} stroke="#7c4324" strokeWidth="1.2" />
            {!small && <path d="M67 59 Q72 63 73 69" fill="none" stroke="#fff0c4" strokeWidth="1.2" opacity=".7" />}
          </g>
        )}

        {kind === 'kinder' && (
          <g transform="rotate(9 61 46)">
            <path d="M50 29 Q64 24 77 31 L74 50 Q61 56 48 49Z" fill="#7a3f24" stroke="#4a2518" strokeWidth="1.5" />
            <path d="M53 32 Q64 28 73 33 L71 45 Q61 49 52 46Z" fill="#fff3d6" />
            <path d="M54 34 Q64 30 72 34" fill="none" stroke="#d94232" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M60 30 L59 48 M68 29 L67 47" stroke="#c4976c" strokeWidth="1" opacity=".7" />
            <path d="M47 43 Q55 48 77 42 L76 54 Q61 61 47 53Z" fill={`url(#${id('dough')})`} opacity=".88" />
          </g>
        )}
      </g>

      <path d="M22 25 Q34 12 49 12" fill="none" stroke="#fff9e8" strokeWidth="2.2" opacity={darkDough ? .12 : .35} strokeLinecap="round" />
    </svg>
  )
}

export const CookieArt = React.memo(CookieArtInner)
