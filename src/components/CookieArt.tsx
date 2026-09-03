import React from 'react'

/* ========== COOKIE ART ==========
 * Desenhos SVG de cookies com massa creme clara + indicadores por tipo.
 * TODOS os cookies têm base creme (nunca marrom/chocolate).
 * Indicadores:
 *   - Tradicional: massa lisa, sem indicador
 *   - Meio Amargo: barra diagonal fina escura (chocolate amargo)
 *   - Nutella: pote de creme de avelã com tampa prateada + label marrom
 *   - Kinder: retângulo marrom/vermelho com "k" ou coração azul-claro
 * Mapeamento robusto por substring (case-insensitive).
 * Cores adaptam-se a tema claro/escuro via CSS vars (currentColor, inherit).
 */

interface Props {
  name: string
  size?: number
  className?: string
}

type CookieType = 'tradicional' | 'meio-amargo' | 'nutella' | 'kinder'

/* Detecta tipo pelo nome (substring, case-insensitive) */
function getCookieType(name: string): CookieType {
  const n = name.toLowerCase()
  if (n.includes('meio amargo') || n.includes('meio-amargo') || n.includes('meioamargo')) {
    return 'meio-amargo'
  }
  if (n.includes('nutella')) {
    return 'nutella'
  }
  if (n.includes('kinder')) {
    return 'kinder'
  }
  return 'tradicional'
}

/* Rótulos para aria-label */
const TYPE_LABELS: Record<CookieType, string> = {
  tradicional: 'Cookie Tradicional',
  'meio-amargo': 'Cookie Meio Amargo',
  nutella: 'Cookie Nutella',
  kinder: 'Cookie Kinder',
}

/* --- SVG Indicadores --- */

/* Meio Amargo: barra diagonal fina */
function DarkChocolateBar({ size = 100 }: { size?: number }) {
  const w = size
  const h = size
  const barW = w * 0.08  // 8% da largura
  const len = Math.hypot(w, h) * 1.15
  const cx = w / 2
  const cy = h / 2
  const angle = -35  // graus

  return (
    <g role="img" aria-hidden="true">
      <rect
        x={cx - barW / 2}
        y={cy - len / 2}
        width={barW}
        height={len}
        fill="currentColor"
        opacity="0.65"
        transform={`rotate(${angle} ${cx} ${cy})`}
        style={{ color: 'var(--cz-700)' }}  // marrom escuro quente
      />
      {/* brilho sutil na borda da barra */}
      <rect
        x={cx - barW / 2}
        y={cy - len / 2}
        width={Math.max(1, barW * 0.25)}
        height={len}
        fill="currentColor"
        opacity="0.15"
        transform={`rotate(${angle} ${cx} ${cy})`}
        style={{ color: '#fff' }}
      />
    </g>
  )
}

/* Nutella: pote de creme de avelã estilizado */
function NutellaJar({ size = 100 }: { size?: number }) {
  const w = size
  const h = size
  // Pote centralizado na área inferior do cookie
  const jarW = w * 0.28
  const jarH = h * 0.32
  const x = (w - jarW) / 2
  const y = h * 0.58
  const r = jarW * 0.15

  return (
    <g role="img" aria-hidden="true">
      {/* Corpo do pote (vidro transparente com creme) */}
      <path
        d={[
          `M ${x + r} ${y}`,
          `H ${x + jarW - r}`,
          `A ${r} ${r} 0 0 1 ${x + jarW} ${y + r}`,
          `V ${y + jarH - r * 1.2}`,
          `A ${r} ${r} 0 0 1 ${x + jarW - r} ${y + jarH}`,
          `H ${x + r}`,
          `A ${r} ${r} 0 0 1 ${x} ${y + jarH - r * 1.2}`,
          `V ${y + r}`,
          `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
          'Z',
        ].join(' ')}
        fill="currentColor"
        opacity="0.92"
        style={{ color: '#D4A574' }}  // tom de creme de avelã
      />
      {/* Reflexo no vidro */}
      <path
        d={[
          `M ${x + jarW * 0.18} ${y + jarH * 0.15}`,
          `Q ${x + jarW * 0.35} ${y + jarH * 0.05} ${x + jarW * 0.55} ${y + jarH * 0.15}`,
          `Q ${x + jarW * 0.5} ${y + jarH * 0.35} ${x + jarW * 0.18} ${y + jarH * 0.15}`,
        ].join(' ')}
        fill="#fff"
        opacity="0.25"
      />
      {/* Tampa prateada */}
      <path
        d={[
          `M ${x - jarW * 0.04} ${y + r * 0.5}`,
          `H ${x + jarW + jarW * 0.04}`,
          `V ${y - jarW * 0.06}`,
          `H ${x - jarW * 0.04}`,
          'Z',
        ].join(' ')}
        fill="currentColor"
        style={{ color: '#C0C8D0' }}  // prata
      />
      {/* Borda da tampa */}
      <path
        d={[
          `M ${x - jarW * 0.04} ${y + r * 0.5}`,
          `H ${x + jarW + jarW * 0.04}`,
        ].join(' ')}
        stroke="currentColor"
        strokeWidth={Math.max(1, w * 0.006)}
        style={{ color: '#9AA4B0' }}
        fill="none"
      />
      {/* Label marrom no pote */}
      <rect
        x={x + jarW * 0.15}
        y={y + jarH * 0.35}
        width={jarW * 0.7}
        height={jarH * 0.18}
        rx={jarW * 0.04}
        fill="currentColor"
        opacity="0.9"
        style={{ color: '#5D3A1A' }}  // marrom escuro quente
      />
      {/* Texto "N" estilizado no label (simples, sem fonte) */}
      <text
        x={x + jarW / 2}
        y={y + jarH * 0.48}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={Math.max(8, jarW * 0.22)}
        fontWeight="700"
        fontFamily="Georgia, serif"
        fill="#fff"
        opacity="0.95"
        pointerEvents="none"
      >
        N
      </text>
    </g>
  )
}

/* Kinder: símbolo retângulo marrom/vermelho com "k" ou coração */
function KinderSymbol({ size = 100 }: { size?: number }) {
  const w = size
  const h = size
  const symW = w * 0.26
  const symH = h * 0.22
  const x = (w - symW) / 2
  const y = h * 0.6
  const r = symW * 0.18

  return (
    <g role="img" aria-hidden="true">
      {/* Base retangular arredondada (marrom/vermelho Kinder) */}
      <rect
        x={x}
        y={y}
        width={symW}
        height={symH}
        rx={r}
        fill="currentColor"
        style={{ color: '#8B2E2E' }}  // vermelho-marrom profundo
      />
      {/* Brilho superior */}
      <rect
        x={x + symW * 0.1}
        y={y + symH * 0.1}
        width={symW * 0.8}
        height={symH * 0.25}
        rx={r * 0.5}
        fill="#fff"
        opacity="0.18"
      />
      {/* "k" minúscula branca no centro */}
      <text
        x={x + symW / 2}
        y={y + symH * 0.62}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={Math.max(9, symW * 0.35)}
        fontWeight="700"
        fontFamily="Fraunces, Georgia, serif"
        fill="#fff"
        opacity="0.95"
        letterSpacing="-0.02em"
        pointerEvents="none"
      >
        k
      </text>
      {/* Coração azul-claro pequeno no canto (referência Kinder) */}
      <path
        d={[
          `M ${x + symW * 0.78} ${y + symH * 0.22}`,
          `C ${x + symW * 0.85} ${y + symH * 0.12} ${x + symW * 0.95} ${y + symH * 0.15} ${x + symW * 0.95} ${y + symH * 0.28}`,
          `C ${x + symW * 0.95} ${y + symH * 0.4} ${x + symW * 0.8} ${y + symH * 0.5} ${x + symW * 0.78} ${y + symH * 0.55}`,
          `C ${x + symW * 0.76} ${y + symH * 0.5} ${x + symW * 0.61} ${y + symH * 0.4} ${x + symW * 0.61} ${y + symH * 0.28}`,
          `C ${x + symW * 0.61} ${y + symH * 0.15} ${x + symW * 0.71} ${y + symH * 0.12} ${x + symW * 0.78} ${y + symH * 0.22}`,
          'Z',
        ].join(' ')}
        fill="currentColor"
        style={{ color: '#4FC3F7' }}  // azul-claro Kinder
        transform={`scale(0.65) translate(${symW * 0.15} ${symH * 0.15})`}
        transformOrigin={`${x + symW * 0.78} ${y + symH * 0.22}`}
      />
    </g>
  )
}

/* --- CookieArt Principal --- */

export function CookieArt({ name, size = 72, className }: Props) {
  const type = getCookieType(name)
  const ariaLabel = TYPE_LABELS[type]

  // Cores da massa creme (funcionam em ambos os temas via CSS vars)
  // Usamos currentColor herdado do container ou definimos inline com vars
  const doughBase = 'var(--cookie-dough-base, #FDF8F0)'      // creme bem claro
  const doughWarm = 'var(--cookie-dough-warm, #F5ECDB)'      // creme levemente quente
  const doughEdge = 'var(--cookie-dough-edge, #E8DDCD)'      // borda da massa
  const doughHighlight = 'var(--cookie-dough-highlight, #FFF)' // brilho
  const doughShadow = 'var(--cookie-dough-shadow, rgba(92,63,41,0.08))' // sombra suave

  // No tema escuro, as vars são sobrescritas via [data-theme="dark"] no CSS global
  // Mas para garantir, usamos cores inline que funcionam bem nos dois temas
  // A abordagem: SVG usa cores semânticas; o wrapper define as vars via style

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{
        filter: 'drop-shadow(0 3px 6px rgba(45,34,24,0.18))',
        // Define CSS vars para o SVG herdá-las (tema claro)
        // O tema escuro sobrescreve via [data-theme="dark"] no :root global
        '--cookie-dough-base': '#FDF8F0',
        '--cookie-dough-warm': '#F5ECDB',
        '--cookie-dough-edge': '#E8DDCD',
        '--cookie-dough-highlight': '#FFFFFF',
        '--cookie-dough-shadow': 'rgba(45,34,24,0.08)',
      } as React.CSSProperties}
      aria-label={ariaLabel}
      role="img"
    >
      <defs>
        {/* Gradiente radial suave para a massa (volume) */}
        <radialGradient id="doughGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={doughHighlight} stopOpacity="0.6" />
          <stop offset="40%" stopColor={doughBase} stopOpacity="1" />
          <stop offset="100%" stopColor={doughWarm} stopOpacity="1" />
        </radialGradient>
        {/* Sombra interna sutil na borda */}
        <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feOffset dx="0" dy="1.5" />
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Corpo do cookie (massa creme) */}
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="url(#doughGrad)"
        filter="url(#innerShadow)"
      />
      {/* Borda da massa (contorno adaptável) */}
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke={doughEdge}
        strokeWidth="1.5"
        opacity="0.6"
      />
      {/* Leve textura de "grãos" da massa (pontos sutis) */}
      <g opacity="0.06" fill={doughShadow}>
        <circle cx="32" cy="30" r="3.5" />
        <circle cx="68" cy="28" r="2.8" />
        <circle cx="38" cy="65" r="3.2" />
        <circle cx="62" cy="68" r="2.5" />
        <circle cx="50" cy="45" r="2.2" />
        <circle cx="45" cy="40" r="1.8" />
        <circle cx="55" cy="55" r="2" />
      </g>
      {/* Brilho superior (top highlight) */}
      <ellipse
        cx="38"
        cy="28"
        rx="22"
        ry="11"
        fill={doughHighlight}
        opacity="0.12"
      />
      <ellipse
        cx="35"
        cy="25"
        rx="11"
        ry="6"
        fill={doughHighlight}
        opacity="0.10"
      />

      {/* INDICADORES POR TIPO */}
      {type === 'meio-amargo' && <DarkChocolateBar size={100} />}
      {type === 'nutella' && <NutellaJar size={100} />}
      {type === 'kinder' && <KinderSymbol size={100} />}
      {/* Tradicional: sem indicador adicional */}
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