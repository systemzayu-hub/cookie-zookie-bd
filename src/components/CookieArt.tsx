/**
 * CookieArt.tsx — Cookie SVG procedural com borda ondulada orgânica,
 * textura de massa assada, relevo 3D e indicadores por sabor.
 * Massa creme (nunca marrom/chocolate). Indicadores: Trad=liso, Meio Amargo=barra,
 * Nutella=pote, Kinder=coração.
 */

import React from 'react'

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/* ---- Gerar path de borda ondulada de cookie ---- */
function generateCookiePath(
  cx: number, cy: number, radius: number,
  nPoints: number, seed: number
): string {
  const rng = seededRandom(seed)
  const points: [number, number][] = []

  for (let i = 0; i < nPoints; i++) {
    const angle = (i / nPoints) * Math.PI * 2
    const r = radius + (rng() - 0.5) * radius * 0.28
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
  }

  let d = `M ${points[0][0]} ${points[0][1]} `
  for (let i = 0; i < nPoints; i++) {
    const curr = points[i]
    const next = points[(i + 1) % nPoints]
    const cpx = (curr[0] + next[0]) / 2 + (rng() - 0.5) * radius * 0.15
    const cpy = (curr[1] + next[1]) / 2 + (rng() - 0.5) * radius * 0.15
    d += `Q ${cpx} ${cpy} ${next[0]} ${next[1]} `
  }
  return d + 'Z'
}

/* ---- Gerar pontos de textura da massa ---- */
function generateTexturePoints(
  cx: number, cy: number, radius: number,
  count: number, seed: number
): Array<{ x: number; y: number; r: number; o: number }> {
  const rng = seededRandom(seed)
  const pts: Array<{ x: number; y: number; r: number; o: number }> = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d = rng() * radius * 0.85
    pts.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: 0.8 + rng() * 1.8,
      o: 0.03 + rng() * 0.07
    })
  }
  return pts
}

/* ---- Gerar fissuras da massa ---- */
function generateCracks(
  cx: number, cy: number, radius: number,
  count: number, seed: number
): string[] {
  const rng = seededRandom(seed)
  const cracks: string[] = []
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d1 = rng() * radius * 0.3
    const len = radius * (0.15 + rng() * 0.3)
    const x1 = cx + Math.cos(a) * d1
    const y1 = cy + Math.sin(a) * d1
    const x2 = x1 + Math.cos(a + (rng() - 0.5) * 0.6) * len
    const y2 = y1 + Math.sin(a + (rng() - 0.5) * 0.6) * len
    const cpx = (x1 + x2) / 2 + (rng() - 0.5) * len * 0.4
    const cpy = (y1 + y2) / 2 + (rng() - 0.5) * len * 0.4
    cracks.push(`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`)
  }
  return cracks
}

type Props = { name: string; size?: number; className?: string }

/* ---- Names → variant key (robust substring matching) ---- */
function variant(name: string): 'tradicional' | 'meio-amargo' | 'nutella' | 'kinder' {
  const n = name.toLowerCase()
  if (n.includes('meio amargo') || n.includes('meio-amargo') || n.includes('meioamargo')) return 'meio-amargo'
  if (n.includes('nutella')) return 'nutella'
  if (n.includes('kinder')) return 'kinder'
  return 'tradicional'
}

export function CookieArt({ name, size = 72, className }: Props) {
  const v = variant(name)
  const s = size
  const cx = s / 2
  const cy = s / 2
  const r = s * 0.40

  // Seed baseada no nome para consistência
  let seedHash = 0
  for (let i = 0; i < name.length; i++) seedHash = ((seedHash << 5) - seedHash + name.charCodeAt(i)) | 0
  const seed = Math.abs(seedHash) || 1

  // Sufixo ÚNICO por instância (evita colisão de IDs SVG entre cookies iguais)
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (k: string) => `${k}-${seed}-${uid}`

  const path = generateCookiePath(cx, cy, r, 14, seed)
  const innerPath = generateCookiePath(cx, cy, r * 0.88, 12, seed + 500)
  const texturePts = generateTexturePoints(cx, cy, r, 24, seed + 200)
  const cracks = generateCracks(cx, cy, r, 5, seed + 300)
  const edgeDots = generateTexturePoints(cx, cy, r * 0.95, 30, seed + 400)

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
        {/* Gradiente principal da massa */}
        <radialGradient id={id('cg')} cx="42%" cy="38%" r="58%" fx="38%" fy="35%">
          <stop offset="0%" stopColor="#FFF8EE" />
          <stop offset="35%" stopColor="#F5ECD7" />
          <stop offset="65%" stopColor="#EDE0C4" />
          <stop offset="100%" stopColor="#DCC9A3" />
        </radialGradient>

        {/* Gradiente da borda (mais escura) */}
        <radialGradient id={id('ce')} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#DCC9A3" stopOpacity="0" />
          <stop offset="85%" stopColor="#C4AD82" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#B89B6B" stopOpacity="0.5" />
        </radialGradient>

        {/* Sombra projetada */}
        <filter id={id('cs')} x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy={s * 0.04} stdDeviation={s * 0.04} floodColor="#8B7355" floodOpacity="0.3" />
        </filter>

        {/* Brilho do centro */}
        <radialGradient id={id('ch')} cx="40%" cy="35%" r="30%">
          <stop offset="0%" stopColor="#FFFCF5" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFFCF5" stopOpacity="0" />
        </radialGradient>

        {/* Clip path orgânico */}
        <clipPath id={id('cc')}>
          <path d={path} />
        </clipPath>
      </defs>

      {/* === Camada 1: Sombra projetada === */}
      <path d={path} fill="#8B7355" opacity="0.25" filter={`url(#${id('cs')})`} transform={`translate(0,${s * 0.02})`} />

      {/* === Camada 2: Borda escura (baked edge) === */}
      <path d={path} fill="#C4A265" />

      {/* === Camada 3: Massa creme com gradiente === */}
      <path d={path} fill={`url(#${id('cg')})`} />

      {/* === Camada 4: Escurecimento sutil da borda === */}
      <path d={path} fill={`url(#${id('ce')})`} />

      {/* === Camada 5: Detalhes internos (clipeados à forma do cookie) === */}
      <g clipPath={`url(#${id('cc')})`}>
        {/* Textura de massa — pontinhos */}
        {texturePts.map((p, i) => (
          <circle key={`t${i}`} cx={p.x} cy={p.y} r={p.r} fill="#C4A265" opacity={p.o} />
        ))}

        {/* Bordas internas — pontos escuros (edge dots) */}
        {edgeDots.map((p, i) => {
          const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
          if (dist < r * 0.6) return null
          return <circle key={`e${i}`} cx={p.x} cy={p.y} r={p.r * 0.6} fill="#B89B6B" opacity={p.o * 1.2} />
        })}

        {/* Fissuras da massa (linhas curvas leves) */}
        {cracks.map((d, i) => (
          <path key={`cr${i}`} d={d} fill="none" stroke="#C4A265" strokeWidth={0.4} opacity={0.15} strokeLinecap="round" />
        ))}

        {/* Centro levemente mais claro (relevo) */}
        <circle cx={cx * 0.92} cy={cy * 0.88} r={r * 0.35} fill={`url(#${id('ch')})`} />

        {/* Pequeno brilho especular */}
        <ellipse cx={cx * 0.82} cy={cy * 0.78} rx={r * 0.18} ry={r * 0.12} fill="#FFFCF5" opacity={0.25} transform={`rotate(-15 ${cx * 0.82} ${cy * 0.78})`} />
      </g>

      {/* === Indicadores por sabor === */}
      {v === 'meio-amargo' && (
        <g clipPath={`url(#${id('cc')})`}>
          {/* Barra diagonal escura — chocolate amargo sobre o cookie */}
          <rect
            x={cx - r * 0.65}
            y={cy - r * 0.12}
            width={r * 1.3}
            height={r * 0.24}
            rx={r * 0.06}
            fill="#3E2723"
            opacity={0.6}
            transform={`rotate(-35 ${cx} ${cy})`}
          />
          {/* Highlight na barra */}
          <rect
            x={cx - r * 0.5}
            y={cy - r * 0.06}
            width={r * 1.0}
            height={r * 0.04}
            rx={r * 0.02}
            fill="#5D4037"
            opacity={0.3}
            transform={`rotate(-35 ${cx} ${cy})`}
          />
        </g>
      )}

      {v === 'nutella' && (
        <g clipPath={`url(#${id('cc')})`}>
          {/* Pote de Nutella estilizado — centro do cookie */}
          {(() => {
            const jx = cx - r * 0.22
            const jy = cy - r * 0.28
            const jw = r * 0.44
            const jh = r * 0.48
            return (
              <>
                {/* Corpo do pote */}
                <rect x={jx} y={jy + jh * 0.15} width={jw} height={jh * 0.7} rx={jw * 0.12}
                  fill="#5D3A1A" stroke="#4A2E14" strokeWidth={0.5} />
                {/* Tampa branca */}
                <rect x={jx - jw * 0.05} y={jy} width={jw * 1.1} height={jh * 0.2} rx={jw * 0.1}
                  fill="#F5F0E8" stroke="#D4C8B5" strokeWidth={0.4} />
                {/* Label "Nutella" — barrinha vermelha + texto */}
                <rect x={jx + jw * 0.1} y={jy + jh * 0.32} width={jw * 0.8} height={jh * 0.28} rx={2}
                  fill="#CC0000" />
                <text x={jx + jw * 0.5} y={jy + jh * 0.53} textAnchor="middle"
                  fontSize={Math.max(5, r * 0.22)} fill="#FFF" fontWeight="700"
                  fontFamily="Arial,sans-serif">N</text>
                {/* Tampa brilho */}
                <rect x={jx + jw * 0.15} y={jy + jh * 0.03} width={jw * 0.7} height={jh * 0.06} rx={1}
                  fill="#FFF" opacity={0.35} />
              </>
            )
          })()}
        </g>
      )}

      {v === 'kinder' && (
        <g clipPath={`url(#${id('cc')})`}>
          {/* Retangulo Kinder com k + coração */}
          {(() => {
            const kx = cx - r * 0.28
            const ky = cy - r * 0.26
            const kw = r * 0.56
            const kh = r * 0.52
            return (
              <>
                {/* Base retangular Kinder (vermelho-marrom) */}
                <rect x={kx} y={ky} width={kw} height={kh} rx={kw * 0.15}
                  fill="#CC3333" stroke="#A02828" strokeWidth={0.5} />
                {/* Faixa branca no meio */}
                <rect x={kx} y={ky + kh * 0.3} width={kw} height={kh * 0.4}
                  fill="#FFF" />
                {/* "k" na faixa branca */}
                <text x={cx - r * 0.04} y={ky + kh * 0.6} textAnchor="middle"
                  fontSize={Math.max(6, r * 0.3)} fill="#CC3333" fontWeight="800"
                  fontFamily="Arial,sans-serif">k</text>
                {/* Coração azul claro — path proporcional */}
                {(() => {
                  const ts = r * 0.18
                  const hx = cx + r * 0.04
                  const hy = ky + kh * 0.11
                  return (
                    <path d={
                      `M ${hx} ${hy + ts * 0.35} ` +
                      `C ${hx - ts * 0.02} ${hy + ts * 0.22} ${hx - ts * 0.5} ${hy - ts * 0.05} ${hx - ts * 0.5} ${hy - ts * 0.25} ` +
                      `C ${hx - ts * 0.5} ${hy - ts * 0.55} ${hx} ${hy - ts * 0.35} ${hx} ${hy - ts * 0.1} ` +
                      `C ${hx} ${hy - ts * 0.35} ${hx + ts * 0.5} ${hy - ts * 0.55} ${hx + ts * 0.5} ${hy - ts * 0.25} ` +
                      `C ${hx + ts * 0.5} ${hy - ts * 0.05} ${hx + ts * 0.02} ${hy + ts * 0.22} ${hx} ${hy + ts * 0.35} Z`
                    } fill="#4DA6FF" opacity={0.85} />
                  )
                })()}
                {/* Brilho no retangulo */}
                <rect x={kx + kw * 0.1} y={ky + kh * 0.05} width={kw * 0.5} height={kh * 0.12}
                  rx={2} fill="#FFF" opacity={0.25} />
              </>
            )
          })()}
        </g>
      )}

      {/* Tradicional: sem indicador, cookie limpo */}
    </svg>
  )
}
