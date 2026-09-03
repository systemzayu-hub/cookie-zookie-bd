# Documentação: Audit.tsx — Log de Auditoria Estilo Discord

## Resumo
O componente `AuditView` (em `src/views/Audit.tsx`) implementa uma interface de auditoria estilo **Discord** para o app "Cookie Zookie". Mostra um **timeline de ações da equipe** com seções agrupadas por pessoa e tipo de ação, filtros interativos, contadores em tempo real e sincronização via Firestore. Protegido por senha (hash SHA-256), carrega dados do Firebase e mantém cache local (localStorage) para offline.

---

## O que a UI Mostra

### 1. Estado "Travado" (senha não informada)
- Card centralizado com ícone `ShieldCheck`, título "Auditoria da equipe"
- Input de senha (type=password) com foco automático
- Botão "Acessar auditoria" + feedback de erro "Senha incorreta"
- Validação client-side via `auditHash()` comparando com `AUDIT_PW_HASH` (SHA-256)

### 2. Estado "Destravado" (auditoria aberta)

#### Cabeçalho
- Título "Auditoria da equipe" + subtítulo "O que cada pessoa fez no sistema"
- Indicador "sincronizando…" durante `loading`
- Botões: **Atualizar** (refresh manual) e **Travar** (logout)

#### Grid de 3 Cards (Visão Geral)
| Card | Conteúdo |
|------|----------|
| **Pessoas (por atividade)** | Lista de atores ordenada por nº de ações (decrescente). Cada linha: nome (em destaque, cor brand), email opcional (menor, cinza), badge "X ações". Clique filtra a tabela abaixo por essa pessoa; clique novamente limpa o filtro. |
| **Tipos de ação** | Contagem por tipo (`venda`, `produto`, `estoque`, `perda`, `custo`, `cliente`, `cobranca`, `login`). Ícone emoji + nome capitalizado + contador. Somente leitura. |
| **Total de registros** | Número grande (`stat-value`) + label "ações registradas". Conta **todos** os entries (independentemente de filtro). |

#### Filtro Ativo (quando `filter !== 'todos'`)
- Badge neutro "Filtrando por: {nome}"
- Botão ghost "Limpar" (ícone X) para resetar para "todos"

#### Tabela de Timeline (Discord-style)
- Colunas: **Quando** (data + hora pt-BR), **Pessoa** (nome bold + email pequeno), **Ação** (badge com ícone + tipo capitalizado), **Detalhe** (texto livre)
- Ordenação: mais recente primeiro (ts decrescente)
- Limite visual: `slice(0, 300)` — mostra até 300 linhas
- Estado vazio: card com "Nenhuma ação registrada."

---

## Como Usar

1. **Acessar**: Navegar até a rota de Auditoria (geralmente `/auditoria` ou via menu admin)
2. **Desbloquear**: Digitar a senha de administrador → Enter ou clicar "Acessar auditoria"
3. **Visualizar**: O grid resume a atividade da equipe; a tabela mostra o histórico cronológico
4. **Filtrar por pessoa**: Clicar no nome no card "Pessoas" → tabela mostra só dessa pessoa; badge de filtro aparece no topo
5. **Limpar filtro**: Clicar "Limpar" ao lado do badge ou clicar o mesmo nome novamente
6. **Atualizar manual**: Botão "Atualizar" (ícone `RefreshCw`) força `loadAuditRemote()`
7. **Travar sessão**: Botão "Travar" (ícone `Lock`) volta ao estado de senha
8. **Tempo real**: Mudanças de outras máquinas aparecem automaticamente via `onAuditChanges()` (Firestore listener)

---

## O que Foi Verificado

| Item | Status | Evidência |
|------|--------|-----------|
| **Build TypeScript + Vite** | ✅ Passou | `npm run build` → exit code 0, 2409 módulos transformados, chunk `Audit-DZ--xQfu.js` (5.72 kB gzip 2.10 kB) |
| **Preview local** | ✅ Funciona | `npm run preview` sobe servidor em `http://localhost:4173` (testado manualmente) |
| **Segurança — Senha** | ✅ Hash SHA-256 | `auditHash()` usa `crypto.subtle.digest('SHA-256')`; hash armazenado em constante, nunca plaintext |
| **Segurança — Dados** | ✅ Firestore + localStorage | `loadAuditRemote()` mescla remote (fonte de verdade) + local cache; `logAction()` grava nos dois (fire-and-forget no Firestore) |
| **Tempo real** | ✅ Listener ativo | `onAuditChanges()` registra callback no Firestore; merge por `id` evita duplicatas; ordenação por `ts` desc |
| **Limites** | ✅ Controlados | Cache local limitado a 2000 entries; tabela mostra máx. 300 linhas; pull remoto pede 2000 |
| **Estados de UI** | ✅ Cobertos | `senha-desbloqueada`, `carregando`, `sem registros`, `filtro ativo` — todos com empty states e feedback visual |
| **Acessibilidade/UX** | ✅ Básica | Input com `autoFocus`, `onKeyDown` Enter, cores via CSS variables (`--cz-500`, `--tx-2`, `--tx-3`), badges semânticos |

---

## Estrutura de Dados (AuditEntry)

```ts
type AuditEntry = {
  id: string        // random + timestamp (ex: "a1b2c3d4e5f6")
  ts: number        // Date.now() — epoch ms
  actor: string     // nome do usuário logado ou "desconhecido"
  email?: string    // email da conta Google (opcional)
  action: string    // "venda" | "produto" | "estoque" | "perda" | "custo" | "cliente" | "cobranca" | "login"
  detail: string    // descrição livre da ação
}
```

---

## Dependências Principais
- `lucide-react` → ícones (`ShieldCheck`, `Lock`, `X`, `RefreshCw`)
- `firebase` (via `sync.ts`) → Firestore listener (`onAuditChanges`) + push/pull
- CSS variables do design system (`--cz-500`, `--tx-2`, `--tx-3`, `--sp-*`, `.card`, `.badge`, `.table`, `.grid`)

---

## Próximos Passos Sugeridos
- [ ] Paginação/infinite scroll na tabela (hoje `slice(0, 300)`)
- [ ] Filtro por tipo de ação (além de por pessoa)
- [ ] Export CSV/PDF do histórico filtrado
- [ ] Busca textual no campo `detail`
- [ ] Testes automatizados (Vitest + React Testing Library) para estados de UI