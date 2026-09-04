import React from 'react'

type CookieKind = 'tradicional' | 'meio-amargo' | 'nutella' | 'kinder'
type Props = { name: string; size?: number; className?: string }

const COOKIE_IMAGES: Record<CookieKind, string> = {
  'tradicional': `${import.meta.env.BASE_URL}assets/cookies/tradicional.png`,
  'meio-amargo': `${import.meta.env.BASE_URL}assets/cookies/meio-amargo.png`,
  'nutella': `${import.meta.env.BASE_URL}assets/cookies/nutella.png`,
  'kinder': `${import.meta.env.BASE_URL}assets/cookies/kinder.png`,
}

function getCookieKind(name: string): CookieKind {
  const value = name.toLocaleLowerCase('pt-BR')
  if (value.includes('meio amargo') || value.includes('meio-amargo') || value.includes('meioamargo')) return 'meio-amargo'
  if (value.includes('nutella')) return 'nutella'
  if (value.includes('kinder')) return 'kinder'
  return 'tradicional'
}

function CookieArtInner({ name, size = 72, className }: Props) {
  const kind = getCookieKind(name)
  const src = COOKIE_IMAGES[kind]

  return (
    <img
      src={src}
      alt={`Cookie de ${name}`}
      width={size}
      height={size}
      loading={size > 80 ? 'lazy' : 'eager'}
      decoding="async"
      className={className}
      style={{ display: 'block', maxWidth: '100%', objectFit: 'contain' }}
    />
  )
}

export const CookieArt = React.memo(CookieArtInner)
