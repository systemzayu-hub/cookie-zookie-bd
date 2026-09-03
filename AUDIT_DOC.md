# Redesign Profissional - Cookie Zookie

## Design System (styles.css)
- Tokens de elevação: --sh-xs..--sh-xl, --sh-brand, --sh-brand-lg (sombras em camadas)
- Gradientes: --grad-page, --grad-card, --grad-sidebar (caramelo quente)
- Tipografia fluida: --fs-xs..--fs-4xl (clamp), Fraunces (display) + DM Sans (body)
- Tema claro (padrão) e escuro [data-theme=dark]
- Sidebar premium 264px com gradiente + border-right + shadow
- Cards com gradiente sutil, hover lift + shadow
- Login-gate 440px com top brand bar, logo glow

## CookieArt (CookieArt.tsx)
- Massa creme (#FDF8F0) com gradiente radial, textura de grãos, brilho
- NUNCA marrom/chocolate como base
- Indicadores por tipo (substring case-insensitive):
  - Tradicional → liso, sem indicador
  - Meio Amargo → barra diagonal (opacity 0.65)
  - Nutella → pote SVG com label 'N'
  - Kinder → retângulo k + coração azul-claro
- Dark mode: dough creme claro (#F0E6D8)
- Mapping: 'meio amargo', 'meio-amargo', 'meioamargo'; 'nutella'; 'kinder'; else tradicional
