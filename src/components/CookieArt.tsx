/**
 * CookieArt.tsx — Cookie SVG fotorrealista estilo "assado de verdade".
 * Massa dourada assada + gotas de chocolate (chips) embutidas + textura.
 * RENDER ADAPTATIVO: em tamanhos pequenos simplifica (menos/maiores chips,
 * menos textura) para não virar borrão.
 * Indicadores de sabor assados na superfície (não logos flutuando):
 *   Tradicional = chip cookie clássico (limpo)
 *   Meio Amargo = chips escuros meio-amargo (sem barra)
 *   Nutella     = topo de creme de avelã (Nutella) derretido + avelã
 *   Kinder      = chunk de Kinder Bueno (chocolate branco + wafer + cobertura)
 */

import React from 'react'

function seededRandom(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateCookiePath(
  cx: number, cy: number, radius: number,
  nPoints: number, seed: number
): string {
  const rng = seededRandom(seed)
  const points: [number, number][] = []
  for (let i = 0; i < nPoints; i++) {
    const angle = (i / nPoints) * Math.PI * 2
    const r = radius + (rng() - 0.5) * radius * 0.3
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
  }
  let d = `M ${points[0][0]} ${points[0][1]} `
  for (let i = 0; i < nPoints; i++) {
    const curr = points[i]
    const next = points[(i + 1) % nPoints]
    const cpx = (curr[0] + next[0]) / 2 + (rng() - 0.5) * radius * 0.16
    const cpy = (curr[1] + next[1]) / 2 + (rng() - 0.5) * radius * 0.16
    d += `Q ${cpx} ${cpy} ${next[0]} ${next[1]} `
  }
  return d + 'Z'
}

function generateChips(
  cx: number, cy: number, radius: number,
  count: number, seed: number, minD: number, spread: number
): Array<{ x: number; y: number; w: number; h: number; rot: number }> {
  const rng = seededRandom(seed)
  const chips: Array<{ x: number; y: number; w: number; h: number; rot: number }> = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d = minD + rng() * (radius * spread - minD)
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    const w = radius * (0.15 + rng() * 0.12)
    const h = radius * (0.12 + rng() * 0.09)
    const rot = rng() * Math.PI
    chips.push({ x, y, w, h, rot })
  }
  return chips
}

function generateTexturePoints(
  cx: number, cy: number, radius: number,
  count: number, seed: number
): Array<{ x: number; y: number; r: number; o: number }> {
  const rng = seededRandom(seed)
  const pts: Array<{ x: number; y: number; r: number; o: number }> = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d = rng() * radius * 0.86
    pts.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: radius * (0.018 + rng() * 0.028),
      o: 0.06 + rng() * 0.12
    })
  }
  return pts
}

function generateCracks(
  cx: number, cy: number, radius: number,
  count: number, seed: number
): string[] {
  const rng = seededRandom(seed)
  const cracks: string[] = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d1 = rng() * radius * 0.3
    const len = radius * (0.12 + rng() * 0.28)
    const x1 = cx + Math.cos(a) * d1
    const y1 = cy + Math.sin(a) * d1
    const x2 = x1 + Math.cos(a + (rng() - 0.5) * 0.7) * len
    const y2 = y1 + Math.sin(a + (rng() - 0.5) * 0.7) * len
    const cpx = (x1 + x2) / 2 + (rng() - 0.5) * len * 0.4
    const cpy = (y1 + y2) / 2 + (rng() - 0.5) * len * 0.4
    cracks.push(`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`)
  }
  return cracks
}

type Props = { name: string; size?: number; className?: string }

function variant(name: string): 'tradicional' | 'meio-amargo' | 'nutella' | 'kinder' {
  const n = name.toLowerCase()
  if (n.includes('meio amargo') || n.includes('meio-amargo') || n.includes('meioamargo')) return 'meio-amargo'
  if (n.includes('nutella')) return 'nutella'
  if (n.includes('kinder')) return 'kinder'
  return 'tradicional'
}

function CookieArtInner({ name, size = 72, className }: Props) {
  const v = variant(name)
  const s = size
  const cx = s / 2
  const cy = s / 2
  const r = s * 0.40

  // Nível de detalhe por tamanho (grande = cheio, pequeno = simplificado)
  const isSmall = s < 40
  const isTiny = s < 28

  let seedHash = 0
  for (let i = 0; i < name.length; i++) seedHash = ((seedHash << 5) - seedHash + name.charCodeAt(i)) | 0
  const seed = Math.abs(seedHash) || 1

  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (k: string) => `${k}-${seed}-${uid}`

  const path = generateCookiePath(cx, cy, r, isSmall ? 10 : 14, seed)
  const texturePts = isSmall
    ? []
    : generateTexturePoints(cx, cy, r, isTiny ? 12 : 30, seed + 200)

  // Gotas de chocolate: grandes = muitas/pequenas; pequenas = poucas/maiores
  const chipCount = v === 'kinder' ? (isSmall ? 4 : 6) : (isSmall ? 5 : 11)
  const chips = generateChips(cx, cy, r, chipCount, seed + 700, 0, isSmall ? 0.72 : 0.9)
    .filter((c) => Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2) < r * (isSmall ? 0.74 : 0.86))
  const whiteChips = v === 'kinder'
    ? generateChips(cx, cy, r, isSmall ? 2 : 5, seed + 800, 0, 0.8)
        .filter((c) => Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2) < r * 0.82)
    : []

  const cracks = isSmall ? [] : generateCracks(cx, cy, r, isTiny ? 2 : 5, seed + 300)

  const chipW = (c: { w: number }) => Math.max(1.5, c.w)

  return (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      width={s}
      height={s}
      className={className}
      role="img"
      aria-label={`Cookie ${name}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={id('cg')} cx="42%" cy="36%" r="62%" fx="38%" fy="32%">
          <stop offset="0%" stopColor="#F7E6C3" />
          <stop offset="38%" stopColor="#EDD29B" />
          <stop offset="68%" stopColor="#DDBE7E" />
          <stop offset="90%" stopColor="#C9A25F" />
          <stop offset="100%" stopColor="#BC9150" />
        </radialGradient>

        <radialGradient id={id('ce')} cx="50%" cy="50%" r="50%">
          <stop offset="58%" stopColor="#A97E43" stopOpacity="0" />
          <stop offset="84%" stopColor="#9A6F35" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#8A5F2B" stopOpacity="0.55" />
        </radialGradient>

        <filter id={id('cs')} x="-25%" y="-15%" width="150%" height="150%">
          <feDropShadow dx="0" dy={s * 0.045} stdDeviation={s * 0.045} floodColor="#5b3d16" floodOpacity="0.35" />
        </filter>

        <radialGradient id={id('ch')} cx="40%" cy="34%" r="34%">
          <stop offset="0%" stopColor="#FFF6DC" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FFF6DC" stopOpacity="0" />
        </radialGradient>

        <clipPath id={id('cc')}>
          <path d={path} />
        </clipPath>
      </defs>

      <path d={path} fill="#5b3d16" opacity="0.25" filter={`url(#${id('cs')})`} transform={`translate(0,${s * 0.02})`} />
      <path d={path} fill="#A97E43" />
      <path d={path} fill={`url(#${id('cg')})`} />
      <path d={path} fill={`url(#${id('ce')})`} />

      <g clipPath={`url(#${id('cc')})`}>
        {texturePts.map((p, i) => (
          <circle key={`t${i}`} cx={p.x} cy={p.y} r={p.r} fill="#9A6F35" opacity={p.o} />
        ))}

        {cracks.map((dd, i) => (
          <path key={`cr${i}`} d={dd} fill="none" stroke="#A97E43" strokeWidth={Math.max(0.3, s * 0.006)} opacity={0.18} strokeLinecap="round" />
        ))}

        <circle cx={cx * 0.94} cy={cy * 0.9} r={r * 0.42} fill={`url(#${id('ch')})`} />

        {/* gotas de chocolate */}
        {chips.map((c, i) => {
          const ccx = c.x, ccy = c.y
          const w = chipW(c), h = Math.max(1.3, c.h)
          return (
            <g key={`chip${i}`} transform={`rotate(${c.rot} ${ccx} ${ccy})`}>
              <ellipse cx={ccx + w * 0.03} cy={ccy + h * 0.09} rx={w * 0.55} ry={h * 0.52} fill="#7A4E1F" opacity="0.35" />
              <ellipse cx={ccx} cy={ccy} rx={w * 0.5} ry={h * 0.48} fill="#3E2412" />
              <ellipse cx={ccx - w * 0.12} cy={ccy - h * 0.18} rx={w * 0.16} ry={h * 0.13} fill="#7A4E1F" opacity="0.6" />
              <ellipse cx={ccx - w * 0.16} cy={ccy - h * 0.22} rx={w * 0.08} ry={h * 0.07} fill="#FFE9C2" opacity="0.35" />
            </g>
          )
        })}

        {/* chips brancos Kinder */}
        {whiteChips.map((c, i) => {
          const ccx = c.x, ccy = c.y
          const w = chipW(c), h = Math.max(1.3, c.h)
          return (
            <g key={`wchip${i}`} transform={`rotate(${c.rot} ${ccx} ${ccy})`}>
              <ellipse cx={ccx + w * 0.03} cy={ccy + h * 0.09} rx={w * 0.55} ry={h * 0.52} fill="#7A4E1F" opacity="0.25" />
              <ellipse cx={ccx} cy={ccy} rx={w * 0.5} ry={h * 0.48} fill="#F5EFE0" />
              <ellipse cx={ccx - w * 0.12} cy={ccy - h * 0.18} rx={w * 0.16} ry={h * 0.13} fill="#FFFFFF" opacity="0.8" />
            </g>
          )
        })}

        {!isSmall && (
          <ellipse cx={cx * 0.8} cy={cy * 0.74} rx={r * 0.2} ry={r * 0.13} fill="#FFF6DC" opacity="0.28" transform={`rotate(-16 ${cx * 0.8} ${cy * 0.74})`} />
        )}
      </g>

      {/* ==== Indicadores de sabor (assados na superfície) ==== */}

      {/* Meio Amargo: chips escuros extras mais intensos (sem barra) */}
      {v === 'meio-amargo' && (
        <g clipPath={`url(#${id('cc')})`}>
          {(() => {
            const extraCount = isSmall ? 3 : 6
            const extraChips = generateChips(cx, cy, r, extraCount, seed + 500, 0, isSmall ? 0.65 : 0.78)
              .filter((c) => Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2) < r * 0.8)
            return (
              <>
                {extraChips.map((c, i) => {
                  const ccx = c.x, ccy = c.y
                  const w = chipW(c) * 1.15, h = Math.max(1.5, c.h) * 1.1
                  return (
                    <g key={`mc${i}`} transform={`rotate(${c.rot} ${ccx} ${ccy})`}>
                      <ellipse cx={ccx + w * 0.03} cy={ccy + h * 0.09} rx={w * 0.55} ry={h * 0.52} fill="#1A0E06" opacity="0.4" />
                      <ellipse cx={ccx} cy={ccy} rx={w * 0.5} ry={h * 0.48} fill="#201108" />
                      <ellipse cx={ccx - w * 0.1} cy={ccy - h * 0.15} rx={w * 0.14} ry={h * 0.11} fill="#3D2515" opacity="0.5" />
                    </g>
                  )
                })}
              </>
            )
          })()}
        </g>
      )}

      {/* Nutella: POTE de Nutella assado/saliente ao centro (combina com o print do menu) */}
      {v === 'nutella' && (
        <g clipPath={`url(#${id('cc')})`}>
          {(() => {
            // Pote ocupando o centro, proporcional ao tamanho
            const pw = s * (isSmall ? 0.32 : 0.38)
            const ph = s * (isSmall ? 0.46 : 0.52)
            const px = cx - pw / 2
            const py = cy - ph * 0.42
            const red = '#C62828'
            const darkRed = '#9E1E1E'
            const cream = '#F7E7C9'
            const bodyDark = '#4a2c1a'
            return (
              <>
                {/* sombra projetada na massa */}
                <ellipse cx={cx} cy={py + ph * 0.98} rx={pw * 0.58} ry={ph * 0.2} fill="#2E1A0E" opacity="0.32" />

                {/* corpo do pote (vidro/chocolate escuro) */}
                <rect x={px} y={py + ph * 0.18} width={pw} height={ph * 0.72} rx={pw * 0.12} fill={bodyDark} />
                {/* brilho lateral do vidro */}
                <rect x={px + pw * 0.08} y={py + ph * 0.2} width={pw * 0.08} height={ph * 0.62} rx={pw * 0.04} fill="#FFFFFF" opacity="0.12" />

                {/* tampa redonda vermelha */}
                <ellipse cx={cx} cy={py + ph * 0.14} rx={pw * 0.42} ry={ph * 0.08} fill={darkRed} />
                <rect x={cx - pw * 0.42} y={py} width={pw * 0.84} height={ph * 0.12} rx={pw * 0.08} fill={red} />
                <path d={`M ${px - pw * 0.05} ${py + ph * 0.12} Q ${cx} ${py - ph * 0.06} ${px + pw * 1.05} ${py + ph * 0.12}`} fill={red} stroke={darkRed} strokeWidth={Math.max(0.5, s * 0.012)} />

                {/* rótulo vermelho com 'nutella' */}
                <rect x={px + pw * 0.1} y={py + ph * 0.38} width={pw * 0.8} height={ph * 0.3} rx={pw * 0.03} fill={cream} />
                <rect x={px + pw * 0.1} y={py + ph * 0.38} width={pw * 0.8} height={ph * 0.05} rx={pw * 0.02} fill={red} />
                {/* texto 'nutella' (estilizado, n vermelho / utella escuro) */}
                {!isSmall && (
                  <text
                    x={cx} y={py + ph * 0.58}
                    textAnchor="middle" fontFamily="Arial, sans-serif"
                    fontWeight="900" fontSize={Math.max(5, pw * 0.17)}
                    fill="#3a1d0e"
                  >
                    <tspan fill="#C62828">n</tspan>utella
                  </text>
                )}

                {/* gota de creme ao lado (chamando atenção) */}
                <path
                  d={`M ${px + pw * 1.12} ${py + ph * 0.9}
                      C ${px + pw * 1.28} ${py + ph * 0.78} ${px + pw * 1.32} ${py + ph * 0.62} ${px + pw * 1.18} ${py + ph * 0.55}
                      C ${px + pw * 1.05} ${py + ph * 0.48} ${px + pw * 0.98} ${py + ph * 0.62} ${px + pw * 1.02} ${py + ph * 0.76}
                      C ${px + pw * 1.05} ${py + ph * 0.85} ${px + pw * 1.08} ${py + ph * 0.9} ${px + pw * 1.12} ${py + ph * 0.9} Z`}
                  fill="#5D4037"
                />
                {!isSmall && (
                  <path
                    d={`M ${px + pw * 1.1} ${py + ph * 0.68} Q ${px + pw * 1.16} ${py + ph * 0.62} ${px + pw * 1.22} ${py + ph * 0.66}`}
                    fill="none" stroke="#8D6E63" strokeWidth={Math.max(0.5, s * 0.014)} strokeLinecap="round" opacity="0.7"
                  />
                )}
              </>
            )
          })()}
        </g>
      )}

      {/* Kinder Bueno: chunk de barra Kinder embutido (orgânico, com borda irregular) */}
      {v === 'kinder' && (
        <g clipPath={`url(#${id('cc')})`}>
          {(() => {
            const kw = r * (isSmall ? 0.58 : 0.7)
            const kh = r * (isSmall ? 0.4 : 0.48)
            const kx = cx - kw / 2, ky = cy - kh * 0.5
            const dark = isSmall ? '#6b4426' : '#7C4F2B'
            const fillShadow = '#2E1A0E'
            return (
              <>
                {/* sombra orgânica projetada na massa */}
                <ellipse cx={cx} cy={ky + kh * 0.88} rx={kw * 0.62} ry={kh * 0.32} fill={fillShadow} opacity="0.3" />

                {/* corpo de chocolate ao leite (borda irregular = feito na mão) */}
                <path
                  d={`M ${kx + kw * 0.12} ${ky + kh * 0.86}
                      C ${kx - kw * 0.08} ${ky + kh * 0.6} ${kx - kw * 0.02} ${ky + kh * 0.28} ${kx + kw * 0.18} ${ky + kh * 0.14}
                      C ${kx + kw * 0.32} ${ky + kh * 0.02} ${kx + kw * 0.6} ${ky - kh * 0.06} ${kx + kw * 0.8} ${ky + kh * 0.1}
                      C ${kx + kw * 1.05} ${ky + kh * 0.3} ${kx + kw * 1.0} ${ky + kh * 0.62} ${kx + kw * 0.82} ${ky + kh * 0.82}
                      C ${kx + kw * 0.66} ${ky + kh * 0.98} ${kx + kw * 0.3} ${ky + kh * 0.98} ${kx + kw * 0.12} ${ky + kh * 0.86} Z`}
                  fill={dark}
                />
                {/* wafer crocante (camada interna clara, menor, orgânica) */}
                <path
                  d={`M ${kx + kw * 0.22} ${ky + kh * 0.7}
                      C ${kx + kw * 0.08} ${ky + kh * 0.5} ${kx + kw * 0.14} ${ky + kh * 0.26} ${kx + kw * 0.34} ${ky + kh * 0.16}
                      C ${kx + kw * 0.5} ${ky + kh * 0.06} ${kx + kw * 0.72} ${ky + kh * 0.08} ${kx + kw * 0.82} ${ky + kh * 0.26}
                      C ${kx + kw * 0.92} ${ky + kh * 0.44} ${kx + kw * 0.82} ${ky + kh * 0.66} ${kx + kw * 0.66} ${ky + kh * 0.76}
                      C ${kx + kw * 0.5} ${ky + kh * 0.86} ${kx + kw * 0.34} ${ky + kh * 0.86} ${kx + kw * 0.22} ${ky + kh * 0.7} Z`}
                  fill="#DCD0B0"
                />
                {/* creme branco de avelã (núcleo, o charme do Kinder Bueno) */}
                <path
                  d={`M ${kx + kw * 0.3} ${ky + kh * 0.62}
                      C ${kx + kw * 0.2} ${ky + kh * 0.46} ${kx + kw * 0.26} ${ky + kh * 0.28} ${kx + kw * 0.42} ${ky + kh * 0.2}
                      C ${kx + kw * 0.56} ${ky + kh * 0.12} ${kx + kw * 0.7} ${ky + kh * 0.16} ${kx + kw * 0.76} ${ky + kh * 0.3}
                      C ${kx + kw * 0.82} ${ky + kh * 0.44} ${kx + kw * 0.72} ${ky + kh * 0.6} ${kx + kw * 0.58} ${ky + kh * 0.66}
                      C ${kx + kw * 0.44} ${ky + kh * 0.72} ${kx + kw * 0.38} ${ky + kh * 0.72} ${kx + kw * 0.3} ${ky + kh * 0.62} Z`}
                  fill="#F7E7C9"
                />
                {/* brilho suave no creme */}
                {!isSmall && (
                  <path
                    d={`M ${kx + kw * 0.36} ${ky + kh * 0.4} C ${kx + kw * 0.46} ${ky + kh * 0.32} ${kx + kw * 0.6} ${ky + kh * 0.3} ${kx + kw * 0.68} ${ky + kh * 0.38}`}
                    fill="none" stroke="#FFF8E8" strokeWidth={Math.max(0.6, s * 0.02)} strokeLinecap="round" opacity="0.7"
                  />
                )}
                {/* partículas de wafer crocante dentro do creme (pontinhos) */}
                {!isSmall && (
                  <>
                    <ellipse cx={cx - kw * 0.12} cy={ky + kh * 0.38} rx={s * 0.018} ry={s * 0.012} fill="#B8A984" opacity="0.8" transform={`rotate(-20 ${cx - kw * 0.12} ${ky + kh * 0.38})`} />
                    <ellipse cx={cx + kw * 0.08} cy={ky + kh * 0.5} rx={s * 0.016} ry={s * 0.01} fill="#B8A984" opacity="0.7" transform={`rotate(30 ${cx + kw * 0.08} ${ky + kh * 0.5})`} />
                  </>
                )}
                {/* rebordo de massa dobrada sobre as bordas (assado/embutido) */}
                {!isSmall && (
                  <>
                    <path
                      d={`M ${kx + kw * 0.05} ${ky + kh * 0.5} C ${kx + kw * 0.2} ${ky + kh * 0.68} ${kx + kw * 0.4} ${ky + kh * 0.8} ${kx + kw * 0.6} ${ky + kh * 0.75}`}
                      fill="none" stroke="#DDBE7E" strokeWidth={Math.max(1.2, s * 0.032)} strokeLinecap="round" opacity="0.6"
                    />
                    <path
                      d={`M ${kx + kw * 0.4} ${ky + kh * 0.05} C ${kx + kw * 0.3} ${ky - kh * 0.1} ${kx + kw * 0.6} ${ky - kh * 0.14} ${kx + kw * 0.72} ${ky - kh * 0.04}`}
                      fill="none" stroke="#C9A25F" strokeWidth={Math.max(1.2, s * 0.03)} strokeLinecap="round" opacity="0.55"
                    />
                  </>
                )}
              </>
            )
          })()}
        </g>
      )}
    </svg>
  )
}

// memo evita re-render desnecessário dos cookies em grids/listas (perf)
export const CookieArt = React.memo(CookieArtInner)
