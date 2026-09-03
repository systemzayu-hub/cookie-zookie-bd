

## 2026-09-03 - Redesign Profissional MoA + Cookies Massa Creme
Decisão: aplicar "MoA" (esquadrão 10) focando design profissional em todo o site, claro+escuro.
- CookieArt.tsx reescrito (360 linhas): massa creme #FDF8F0 (nunca marrom), gradiente radial, textura de grãos.
- Indicadores por tipo: Tradicional=liso; Meio Amargo=barra diag (opacity .65); Nutella=pote SVG c/ label "N"; Kinder=retângulo "k"+coração azul.
- Mapping substring case-insensitive (meio amargo/meio-amargo/meioamargo; nutella; kinder; else tradicional). Removido loose includes("meio").
- Dark mode: dough creme claro #F0E6D8 (era marrom #2D2620).
- styles.css (964 linhas): tokens elevação --sh-*, gradientes --grad-*, tipografia clamp --fs-*, sidebar 264px premium, cards gradiente+hover lift, login 440px.
- Validado: tsc 0 erros, build 19s, zero senhas em claro, preview 200, deploy gh-pages 527af9c, live HTTP 200 (CookieArt-BAnoYDmC.js, index-CgAFiFLL.css, index-BcV2XmAF.js).
- Pendente: Google login (Firebase Authorized Domains) segue aguardando ação do usuário.
