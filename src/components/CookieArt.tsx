/**
 * CookieArt.tsx — Cookie SVG fotorrealista 3D "assado de verdade".
 *
 * O cookie é o protagonista: massa dourada com RELEVO 3D (rim de espessura,
 * gradiente de forno, sombras de contato nas gotas, manchas de queimado,
 * textura de poros rachaduras) + gotas de chocolate definidas.
 *
 * O INDICADOR DO SABOR fica AO LADO do cookie (ancorado na borda, FORA do
 * clipPath) — NUNCA cobrindo o centro da massa, para não virar "borrão":
 *   Tradicional = apenas o chip cookie clássico (sem indicador extra)
 *   Meio Amargo = chips escuros ancorados na lateral direita
 *   Nutella     = mini pote de Nutella na lateral direita (gota de creme junto)
 *   Kinder      = chunk de Kinder Bueno na lateral direita
 *
 * RENDER ADAPTATIVO: em tamanhos pequenos simplifica (menos layers) para
 * manter a silhueta legível sem borrar.
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
    const w = radius * (0.16 + rng() * 0.12)
    const h = radius * (0.13 + rng() * 0.09)
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
      r: radius * (0.02 + rng() * 0.03),
      o: 0.05 + rng() * 0.12
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

function generateBrowning(
  cx: number, cy: number, radius: number,
  count: number, seed: number
): Array<{ x: number; y: number; r: number }> {
  const rng = seededRandom(seed)
  const pts: Array<{ x: number; y: number; r: number }> = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d = rng() * radius * 0.9
    pts.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: radius * (0.04 + rng() * 0.06)
    })
  }
  return pts
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
  const r = s * 0.42

  const isSmall = s < 40

  let seedHash = 0
  for (let i = 0; i < name.length; i++) seedHash = ((seedHash << 5) - seedHash + name.charCodeAt(i)) | 0
  const seed = Math.abs(seedHash) || 1

  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (k: string) => `${k}-${seed}-${uid}`

  const path = generateCookiePath(cx, cy, r, isSmall ? 10 : 14, seed)
  const texturePts = isSmall ? [] : generateTexturePoints(cx, cy, r, 26, seed + 200)
  const browning = isSmall ? [] : generateBrowning(cx, cy, r, 8, seed + 250)

  const chipCount = isSmall ? 5 : 11
  const chips = generateChips(cx, cy, r, chipCount, seed + 700, 0, isSmall ? 0.7 : 0.9)
    .filter((c) => Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2) < r * (isSmall ? 0.75 : 0.85))

  const cracks = isSmall ? [] : generateCracks(cx, cy, r, 5, seed + 300)

  const chipW = (c: { w: number }) => Math.max(1.6, c.w)

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
        {/* Gradiente de forno (Maillard): centro claro -> borda tostada -> fundo escuro */}
        <radialGradient id={id('cg')} cx="46%" cy="40%" r="58%" fx="42%" fy="36%">
          <stop offset="0%" stopColor="#FFEBB6" />
          <stop offset="22%" stopColor="#F3D79A" />
          <stop offset="45%" stopColor="#E7C582" />
          <stop offset="66%" stopColor="#D6AC6A" />
          <stop offset="85%" stopColor="#C49A54" />
          <stop offset="100%" stopColor="#A97C3E" />
        </radialGradient>

        <radialGradient id={id('ce')} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#A97E43" stopOpacity="0" />
          <stop offset="82%" stopColor="#8A5F2B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6E4A20" stopOpacity="0.55" />
        </radialGradient>

        <filter id={id('cs')} x="-25%" y="-15%" width="150%" height="150%">
          <feDropShadow dx="0" dy={s * 0.05} stdDeviation={s * 0.05} floodColor="#43290f" floodOpacity="0.4" />
        </filter>

        {/* Rim de espessura (3D): sombra interna na borda inferior do cookie */}
        <filter id={id('rim')} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy={s * 0.055} stdDeviation={s * 0.02} floodColor="#6b4517" floodOpacity="0.6" />
        </filter>

        <radialGradient id={id('ch')} cx="42%" cy="35%" r="35%">
          <stop offset="0%" stopColor="#FFF3D6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFF3D6" stopOpacity="0" />
        </radialGradient>

        <clipPath id={id('cc')}>
          <path d={path} />
        </clipPath>
      </defs>

      {/* sombra projetada + rim de espessura (lateral do cookie 3D) */}
      <path d={path} fill="#43290f" opacity="0.28" filter={`url(#${id('cs')})`} transform={`translate(0,${s * 0.022})`} />
      <path d={path} fill="#A97E43" />
      <path d={path} fill={`url(#${id('ce')})`} />
      <path d={path} fill={`url(#${id('cg')})`} />

      {/* manchas laterais de queimado para criar relevo na borda */}
      <g clipPath={`url(#${id('cc')})`}>
        {browning.map((p, i) => (
          <circle key={`br${i}`} cx={p.x} cy={p.y} r={p.r} fill="#9E733A" opacity="0.16" />
        ))}
        {/* textura de poros */}
        {texturePts.map((p, i) => (
          <circle key={`t${i}`} cx={p.x} cy={p.y} r={p.r} fill="#9A6F35" opacity={p.o} />
        ))}
        {/* rachaduras do assado */}
        {cracks.map((dd, i) => (
          <path key={`cr${i}`} d={dd} fill="none" stroke="#A97E43" strokeWidth={Math.max(0.4, s * 0.007)} opacity={0.2} strokeLinecap="round" />
        ))}
        {/* highlight de domo (topo esquerdo) */}
        <circle cx={cx * 0.88} cy={cy * 0.78} r={r * 0.5} fill={`url(#${id('ch')})`} />

        {/* gotas de chocolate com sombra de contato + specular */}
        {chips.map((c, i) => {
          const ccx = c.x, ccy = c.y
          const w = chipW(c), h = Math.max(1.5, c.h)
          return (
            <g key={`chip${i}`} transform={`rotate(${c.rot} ${ccx} ${ccy})`}>
              {/* sombra de contato na massa */}
              <ellipse cx={ccx + w * 0.05} cy={ccy + h * 0.12} rx={w * 0.55} ry={h * 0.5} fill="#2E1A0E" opacity="0.4" />
              {/* corpo da gota */}
              <ellipse cx={ccx} cy={ccy} rx={w * 0.5} ry={h * 0.46} fill="#2A160C" />
              <ellipse cx={ccx} cy={ccy} rx={w * 0.36} ry={h * 0.32} fill="#3E2412" />
              {/* massa subindo na lateral da gota (embutida) */}
              <ellipse cx={ccx - w * 0.1} cy={ccy - h * 0.12} rx={w * 0.5} ry={h * 0.4} fill="#E7C582" opacity="0.5" />
              {/* specular no topo (luz de cima) */}
              <ellipse cx={ccx - w * 0.16} cy={ccy - h * 0.22} rx={w * 0.14} ry={h * 0.12} fill="#FFE9C2" opacity="0.4" />
            </g>
          )
        })}

        {!isSmall && (
          <ellipse cx={cx * 0.8} cy={cy * 0.7} rx={r * 0.22} ry={r * 0.14} fill="#FFF6DC" opacity="0.25" transform={`rotate(-18 ${cx * 0.8} ${cy * 0.7})`} />
        )}
      </g>

      {/* ==== INDICADORES DE SABOR — AO LADO do cookie (fora do clipPath) ==== */}

      {/* Meio Amargo: 2-3 chips escuros ancorados na lateral direita (metade sobre a borda) */}
      {v === 'meio-amargo' && (
        <g>
          {(() => {
            const baseX = cx + r * 0.7
            const baseY = cy
            const bigW = r * (isSmall ? 0.34 : 0.4)
            return (
              <>
                <ellipse cx={baseX + s * 0.01} cy={baseY + s * 0.02} rx={bigW * 0.5} ry={bigW * 0.42} fill="#1A0E06" opacity="0.5" />
                <ellipse cx={baseX} cy={baseY} rx={bigW * 0.5} ry={bigW * 0.42} fill="#140A05" />
                <ellipse cx={baseX - bigW * 0.14} cy={baseY - bigW * 0.18} rx={bigW * 0.14} ry={bigW * 0.1} fill="#3D2515" opacity="0.6" />
                {!isSmall && (
                  <>
                    <circle cx={baseX - bigW * 0.9} cy={baseY - bigW * 0.7} r={bigW * 0.2} fill="#2D140A" />
                    <circle cx={baseX - bigW * 0.6} cy={baseY + bigW * 0.8} r={bigW * 0.17} fill="#1A0E06" />
                  </>
                )}
              </>
            )
          })()}
        </g>
      )}

      {/* Nutella: mini pote de Nutella ancorado na lateral direita + gota de creme */}
      {v === 'nutella' && (
        <g>
          {(() => {
            const pw = r * (isSmall ? 0.34 : 0.42)
            const ph = pw * (isSmall ? 1.4 : 1.5)
            const baseX = cx + r * 0.55
            const baseY = cy - ph * 0.42
            const red = '#C62828'
            const darkRed = '#9E1E1E'
            const cream = '#F7E7C9'
            const body = '#3E2715'
            return (
              <>
                {/* sombra */}
                <ellipse cx={baseX + pw * 0.5} cy={baseY + ph * 0.86} rx={pw * 0.6} ry={ph * 0.14} fill="#2E1A0E" opacity="0.35" />
                {/* corpo */}
                <rect x={baseX} y={baseY + ph * 0.18} width={pw} height={ph * 0.72} rx={pw * 0.1} fill={body} />
                <rect x={baseX + pw * 0.07} y={baseY + ph * 0.2} width={pw * 0.07} height={ph * 0.6} rx={pw * 0.03} fill="#FFFFFF" opacity="0.14" />
                {/* tampa vermelha arredondada */}
                <ellipse cx={baseX + pw * 0.5} cy={baseY + ph * 0.14} rx={pw * 0.44} ry={ph * 0.07} fill={darkRed} />
                <path d={`M ${baseX + pw * 0.02} ${baseY + ph * 0.12} Q ${baseX + pw * 0.5} ${baseY - ph * 0.02} ${baseX + pw * 0.98} ${baseY + ph * 0.12}`} fill={red} stroke={darkRed} strokeWidth={Math.max(0.5, s * 0.012)} />
                {/* rótulo com 'nutella' */}
                <rect x={baseX + pw * 0.08} y={baseY + ph * 0.32} width={pw * 0.84} height={ph * 0.34} rx={pw * 0.03} fill={cream} />
                <rect x={baseX + pw * 0.08} y={baseY + ph * 0.32} width={pw * 0.84} height={ph * 0.045} rx={pw * 0.02} fill={red} />
                {!isSmall && (
                  <text x={baseX + pw * 0.5} y={baseY + ph * 0.5} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize={Math.max(5, pw * 0.16)} fill="#3a1d0e">
                    <tspan fill="#C62828">n</tspan>utella
                  </text>
                )}
                {/* gota de creme escorrendo ao lado */}
                <path
                  d={`M ${baseX + pw * 1.05} ${baseY + ph * 0.78}
                      C ${baseX + pw * 1.18} ${baseY + ph * 0.66} ${baseX + pw * 1.14} ${baseY + ph * 0.5} ${baseX + pw * 1.02} ${baseY + ph * 0.46}
                      C ${baseX + pw * 0.9} ${baseY + ph * 0.42} ${baseX + pw * 0.86} ${baseY + ph * 0.56} ${baseX + pw * 0.92} ${baseY + ph * 0.66}
                      Z`}
                  fill="#5D4037"
                />
              </>
            )
          })()}
        </g>
      )}

      {/* Kinder Bueno: chunk de barra ancorado na lateral direita */}
      {v === 'kinder' && (
        <g>
          {(() => {
            const kw = r * (isSmall ? 0.34 : 0.42)
            const kh = kw * (isSmall ? 0.7 : 0.75)
            const kx = cx + r * 0.66
            const ky = cy - kh * 0.5
            return (
              <>
                <ellipse cx={kx + kw * 0.5} cy={ky + kh * 0.88} rx={kw * 0.6} ry={kh * 0.2} fill="#2E1A0E" opacity="0.35" />
                {/* cobertura chocolate ao leite */}
                <rect x={kx} y={ky} width={kw} height={kh} rx={s * 0.018} fill="#6B4426" />
                <rect x={kx} y={ky} width={kw} height={kh * 0.18} rx={s * 0.014} fill="#8A5A30" />
                {/* wafer */}
                <rect x={kx + kw * 0.08} y={ky + kh * 0.16} width={kw * 0.84} height={kh * 0.68} rx={s * 0.012} fill="#DCD0B0" />
                {/* creme branco núcleo */}
                <rect x={kx + kw * 0.16} y={ky + kh * 0.28} width={kw * 0.68} height={kh * 0.44} rx={s * 0.01} fill="#F7E7C9" />
                {!isSmall && (
                  <path d={`M ${kx + kw * 0.24} ${ky + kh * 0.38} Q ${kx + kw * 0.5} ${ky + kh * 0.3} ${kx + kw * 0.74} ${ky + kh * 0.38}`} fill="none" stroke="#FFF8E8" strokeWidth={Math.max(0.6, s * 0.018)} strokeLinecap="round" opacity="0.7" />
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
