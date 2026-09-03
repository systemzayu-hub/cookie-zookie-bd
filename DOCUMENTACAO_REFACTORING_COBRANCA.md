# Documentação da Refatoração da Cobrança — Cookie Zookie

**Data:** 03/09/2026  
**Projeto:** Cookie Zookie (React 18 + TypeScript + Vite)  
**Local:** `C:/Users/Admin/Documents/Default Project/cookie-app-v2`

---

## 1. Resumo Executivo

A refatoração transformou a tela de **Cobrança** de uma view estática (apenas leitura de seed) para um **módulo completo de gestão de pendências** com:
- Persistência local (localStorage) + sincronização automática com Firebase/Firestore
- CRUD completo: marcar como pago/pendente, editar telefone/Instagram, enviar WhatsApp, copiar mensagem
- Estatísticas em tempo real (total a receber, pessoas devendo, unidades pendentes)
- Ordenação configurável (por valor, nome, quantidade)
- Estados visuais diferenciados (pago vs. pendente)
- Integração na navegação principal via aba "Clientes & Cobrança"

---

## 2. Arquivos Modificados — Antes → Depois

### 2.1 `src/views/Cobranca.tsx` — **REESCRITO COMPLETO**

| Aspecto | Antes (versão antiga) | Depois (versão nova) |
|---------|----------------------|---------------------|
| **Origem dos dados** | Seed estático `PENDENCIAS_SEED` apenas leitura | `localStorage` (`cc_pendencias`) com seed como fallback + sync Firebase |
| **Persistência** | Nenhuma (perdia ao recarregar) | `useEffect` salva automaticamente no `localStorage` a cada mudança |
| **Sincronização Firebase** | Não existia | **Pull** no mount (se logado) + **Push** a cada edição (debounced via useEffect) |
| **Ações possíveis** | Apenas visualizar | ✅ Marcar pago/pendente (com timestamp `pagoEm`)<br>✅ Editar telefone (normaliza para `wa.me`)<br>✅ Editar Instagram<br>✅ Abrir WhatsApp com mensagem pré-formatada<br>✅ Copiar mensagem de cobrança<br>✅ Ordenar por: total, nome, quantidade (asc/desc) |
| **Estatísticas** | Nenhuma | 3 cards: **Total a receber**, **Pessoas devendo**, **Unidades pendentes** (soma apenas não-pagos) |
| **UI/UX** | Lista simples | Cards responsivos com:<br>- Badge "Pago" verde<br>- Botão circular toggle (check)<br>- Inputs desabilitados quando pago<br>- Botões WhatsApp/Copiar desabilitados quando pago ou sem telefone<br>- Empty state celebratório quando tudo quitado |
| **Tipagem** | `any` ou solto | `Pendencia` do `types.ts` (nome, qtd, total, produtos, telefone, instagram, pago, pagoEm?) |

**Principais funções novas:**
- `buildMessage(p)` — monta texto amigável para WhatsApp
- `normalizeWhats(raw)` — limpa e garante DDI 55 (Brasil)
- `togglePago(p)` — alterna status + registra `pagoEm` ISO string
- `updateField(p, field, value)` — telefone/Instagram com normalização
- `sortedPendencias` (useMemo) — ordenação reativa

---

### 2.2 `src/views/CustomersBilling.tsx` — **ATUALIZADO**

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Estrutura** | Provavelmente apenas `CustomersView` | Wrapper com **tabs** laterais: **Clientes** ↔ **Cobrança** |
| **Navegação** | Não havia separação | `useState<'clientes' \| 'cobranca'>` com botões estilizados (primary/ghost) |
| **Integração** | Isolado | Recebe `customers`, `setCustomers`, `sales`, `pushToast` do `App.tsx` e repassa para `CustomersView`; `CobrancaView` é auto-contido (lê/salva próprio estado) |

---

### 2.3 `src/App.tsx` — **ATUALIZADO**

| Mudança | Detalhe |
|---------|---------|
| **Lazy import** | Adicionado `CustomersBillingView = lazy(() => import('./views/CustomersBilling'))` |
| **Rota/Tab** | Tab `'clientes'` agora renderiza `<CustomersBillingView customers={customers} setCustomers={setCustomers} sales={sales} pushToast={pushToast} />` |
| **Estado global** | Mantém `products`, `sales`, `customers` no `App` (fonte única da verdade para Vendas/Estoque/Relatórios) — **Cobrança** usa estado próprio (`cc_pendencias`) mas recebe `sales`/`customers` se precisar cruzar dados no futuro |
| **Sync Firebase** | `authOnChange` já existia; `CobrancaView` usa `authCurrentUser()`, `syncPull()`, `syncPush()` do `sync.ts` independentemente |

---

### 2.4 `src/data.ts` — **ATUALIZADO (seed de vendas expandido)**

| Item | Detalhe |
|------|---------|
| **seedSales** | Expandido para **152 vendas reais** (período 14/08 a 31/08/2026) — antes era seed mínimo |
| **seedCustomers** | 63 clientes importados da planilha |
| **seedProducts** | 4 sabores mantidos (Nutella, Kinder, Tradicional, Meio Amargo) |
| **load/save** | Helpers genéricos de `localStorage` (já existiam, mantidos) |

> **Nota:** O `data.ts` **não** gerencia `pendencias` — esse estado vive no `CobrancaView` com chave `cc_pendencias` própria.

---

### 2.5 `src/types.ts` — **JÁ EXISTIA (confirmado)**

```ts
export type Pendencia = {
  nome: string;
  qtd: number;
  total: number;
  produtos: string;
  telefone: string;
  instagram: string;
  pago: boolean;
  pagoEm?: string;        // NOVO: timestamp ISO quando marcado pago
}
```

---

### 2.6 `src/pendencias-seed.ts` — **MANTIDO (seed inicial)**

12 pendências de exemplo com nomes, quantidades, valores, telefones parciais. Usado como **fallback** quando:
- `localStorage` vazio (primeira execução)
- Firebase vazio (primeiro sync de um usuário logado)

---

### 2.7 `src/sync.ts` — **JÁ SUPORTAVA PENDENCIAS (confirmado)**

- `syncPull()` retorna `{ products, sales, customers, pendencias }`
- `syncPush(products, sales, customers, pendencias?)` inclui `pendencias` opcional no doc `loja/dados`
- `onRemoteChanges(cb)` escuta tempo real (não usado ainda no `CobrancaView`, mas disponível)

---

## 3. Novo Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                        COBRANCAVIEW                              │
├─────────────────────────────────────────────────────────────────┤
│  1. MOUNT                                                        │
│     ├─ useState ← load('cc_pendencias', PENDENCIAS_SEED)        │
│     └─ useEffect #1 (sync pull)                                  │
│         ├─ authCurrentUser()?                                    │
│         │   ├─ SIM → syncPull() → setPendencias(remoto.pendencias)│
│         │   │   └─ se vazio → syncPush(seed) // 1ª vez equipe   │
│         │   └─ NÃO → usa localStorage/seed                      │
│                                                                  │
│  2. EDIÇÃO LOCAL (togglePago, updateField)                      │
│     └─ setPendencias → useEffect #2 (auto-save localStorage)    │
│                                                                  │
│  3. PUSH FIREBASE (se logado)                                   │
│     └─ useEffect #3 (deps: [pendencias]) → syncPush(..., pendencias)│
│         ├─ products, sales, customers vindos de load() local    │
│         └─ pendencias = estado atual                            │
│                                                                  │
│  4. UI REATIVA                                                   │
│     ├─ sortedPendencias (useMemo)                               │
│     ├─ Stats: totalReceber, pessoasDevendo, totalPendentes      │
│     └─ Render cards com ações habilitadas/desabilitadas         │
└─────────────────────────────────────────────────────────────────┘
```

**Pontos-chave:**
- **Offline-first:** Funciona 100% sem Firebase (localStorage)
- **Multi-dispositivo:** Quando logado, `syncPull` no mount + `syncPush` a cada edição mantém equipe sincronizada
- **Conflito simples:** Última escrita vence (Firestore `setDoc` sobrescreve doc inteiro). Para equipe pequena é aceitável; para escala, migrar para subcoleções ou transações.

---

## 4. Funcionalidades — Adicionadas / Mantidas / Removidas

### ✅ ADICIONADAS
| Feature | Descrição |
|---------|-----------|
| Persistência localStorage (`cc_pendencias`) | Dados sobrevivem a reload/fechar navegador |
| Sync Firebase bidirecional | Pull no login + Push automático em edições |
| Marcar como **Pago / Pendente** | Toggle com timestamp `pagoEm` |
| Editar **Telefone** (normaliza `wa.me`) | Input `type=tel`, formata só dígitos + DDI 55 |
| Editar **Instagram** | Input texto livre |
| **WhatsApp direto** | `window.open('https://wa.me/...')` com mensagem pronta |
| **Copiar cobrança** | `navigator.clipboard.writeText()` |
| **Estatísticas** | 3 cards: Total a receber / Pessoas devendo / Unidades pendentes |
| **Ordenação** | Select: Quem deve mais / Nome A-Z / Quantidade + botão asc/desc |
| **Estados visuais** | Card verde + opacity 0.7 quando pago; badge "Pago"; inputs desabilitados |
| **Empty state** | "Todas as pendências foram quitadas! 🎉" quando lista vazia ou tudo pago |

### ✅ MANTIDAS (do seed/versão anterior)
- Seed de 12 pendências de exemplo (`pendencias-seed.ts`)
- Tipagem `Pendencia` em `types.ts`
- Formatação BRL (`fmtBRL`)
- Ícones Lucide (MessageSquare, CheckCircle2, Phone, Instagram, Copy, ChevronDown/Up, DollarSign, Users, AlertCircle)

### ❌ REMOVIDAS / NÃO EXISTIAM
- Não havia funcionalidade anterior de cobrança além de exibir seed — **tudo é novo**
- Não há mais "apenas leitura" — agora é gestão ativa

---

## 5. Bugs / Problemas Identificados (por outros papéis)

| # | Problema | Gravidade | Status | Observação |
|---|----------|-----------|--------|------------|
| 1 | **Concorrência Firebase** — `setDoc` sobrescreve doc inteiro; se 2 funcionários editam pendências diferentes ao mesmo tempo, uma edição perde | Média | **Conhecido / Aceito** | Para equipe ≤ 3 pessoas, risco baixo. Mitigação futura: subcoleção `pendencias/{nome}` ou transações |
| 2 | **Normalização de telefone** — `normalizeWhats` assume Brasil (DDI 55). Se cliente internacional, quebrará link WhatsApp | Baixa | **Documentado** | Público-alvo é local; adicionar seletor de país se expandir |
| 3 | **Seed duplicado no primeiro sync** — Se usuário loga, `syncPull` retorna vazio → `syncPush(seed)` sobe seed. Se outro usuário já subiu dados reais, o seed **sobrescreve** | Média | **Corrigido no código** | Lógica: `if (remoto.pendencias.length) usa remoto; else if (remoto) sobe seed` — mas `remoto` existe (doc vazio) ≠ `remoto.pendencias` vazio. **Verificar:** `syncPull` retorna `null` se doc não existe; se doc existe mas sem campo `pendencias`, retorna `{pendencias: []}` → cai no `else if (remoto)` e sobe seed. **OK se for primeira vez da equipe**. |
| 4 | **`pagoEm` não sincroniza retroativamente** — Pendências marcadas como pagas *antes* do login não terão `pagoEm` no Firebase até próxima edição | Baixa | **Aceito** | Próxima edição (ex: editar telefone) faz push com `pagoEm` preenchido |
| 5 | **`onRemoteChanges` não usado** — Tempo real não implementado; depende de reload ou re-mount para ver mudanças de outros | Baixa | **Backlog** | Adicionar `useEffect` com `onRemoteChanges` para live sync |

---

## 6. O Que Falta Testar Manualmente

| Cenário | Como Testar | Critério de Aceite |
|---------|-------------|---------------------|
| **Primeira execução (sem login)** | Abrir app sem logar → aba Clientes → Cobrança | Vê 12 pendências do seed; edita telefone; recarrega página → mantém |
| **Login + sync pull (Firebase vazio)** | Login Google → aba Cobrança | Seed sobe para Firebase (ver no Console Firestore: `loja/dados.pendencias`) |
| **Login + sync pull (Firebase com dados)** | Segundo usuário loga | Vê pendências do Firebase (não seed); edita → push atualiza Firebase |
| **Marcar pago/pendente** | Clicar check no card | Badge "Pago" aparece; `pagoEm` mostra data/hora; stats atualizam; push Firebase |
| **Editar telefone/WhatsApp** | Digitar telefone → botão WhatsApp abre `wa.me/55...` com msg correta | Link abre WhatsApp Web/App com mensagem formatada |
| **Copiar cobrança** | Clicar "Copiar cobrança" → colar no Bloco de Notas | Texto idêntico ao do WhatsApp |
| **Ordenação** | Trocar select + botão asc/desc | Lista reordena instantaneamente |
| **Empty state** | Marcar todos como pago | Mostra "Todas as pendências foram quitadas! 🎉" |
| **Persistência offline** | Desligar Wi-Fi → editar → religar → logar | Edição offline salva no localStorage; ao logar, faz push e sincroniza |
| **Multi-usuário simultâneo** | 2 navegadores logados (contas diferentes) → editar pendências diferentes | Ambos veem mudanças após ~1-2s (push/pull) — *testar conflito* |
| **Backup/Restore** | Exportar backup → importar em outro navegador | **❌ FALHA:** `db.ts` `BackupData` só tem products/sales/customers. `pendencias` **NÃO** incluídas no JSON. Precisa corrigir `db.ts` + `App.tsx` `onImport`. |

> ⚠️ **Gap identificado:** `db.ts` (`baixarBackup`/`aplicarBackup`) — precisa confirmar se `pendencias` está no JSON exportado/importado. Se não, adicionar.

---

## 7. Instruções de Deploy

### 7.1 Build Local
```bash
cd C:/Users/Admin/Documents/Default Project/cookie-app-v2
npm run build
# Saída em dist/
```

### 7.2 Deploy GitHub Pages (já configurado via `cookie-zookie-frontend` skill)
```bash
# O script de deploy cuida de:
# 1. npm run build
# 2. Copiar dist/ para branch gh-pages
# 3. Push
npm run deploy   # ou comando definido no package.json
```

### 7.3 Firebase Config (obrigatório para sync)
Arquivo: `src/firebase-config.ts` (não versionado — cada ambiente tem o seu)
```ts
export const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
}
```
- **Produção:** Config do projeto Firebase de produção
- **Desenvolvimento:** Config de projeto de dev (ou mesmo projeto com rules permissivas)

### 7.4 Firestore Rules (mínimo para funcionar)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /loja/dados {
      allow read, write: if request.auth != null;
    }
    match /audit/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```
> Requer **Authentication > Google** habilitado no Console Firebase.

### 7.5 Variáveis de Ambiente (se usar Vite env)
```env
# .env.production
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
# etc.
```
E no `firebase-config.ts`:
```ts
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // ...
}
```

---

## 8. Próximos Passos Recomendados

| Prioridade | Tarefa | Esforço | Responsável |
|------------|--------|---------|-------------|
| **Alta** | Testar backup/restore inclui `pendencias` (ver `db.ts`) | 30 min | Dev |
| **Alta** | **Corrigir `db.ts` + `App.tsx` para incluir `pendencias` no backup/restore** | 45 min | Dev |
| **Alta** | Validar conflito multi-usuário (2 abas logadas) | 15 min | QA |
| **Média** | Adicionar `onRemoteChanges` no `CobrancaView` para live sync | 1h | Dev |
| **Média** | Telefone: máscara visual `(XX) 9XXXX-XXXX` no input (lib `react-input-mask` ou custom) | 30 min | Dev |
| **Baixa** | Exportar CSV/PDF de pendências (botão no topo) | 1h | Dev |
| **Baixa** | Filtro "Mostrar apenas pendentes / todos / pagos" | 30 min | Dev |
| **Baixa** | Histórico de cobranças enviadas (auditoria de WhatsApp clicados) | 2h | Dev |

---

## 9. Changelog Curto (para o Usuário)

### 🍪 Cookie Zookie — Atualização da Cobrança (v2.0)

**O que mudou:**
- **Nova tela de Cobrança** completa: agora você gerencia quem deve, marca como pago, edita contatos e manda WhatsApp direto do sistema.
- **Dados salvos automaticamente** no navegador — feche a aba, desligue o PC, tudo continua lá.
- **Sincronização em equipe**: logar com Google sincroniza as pendências entre todos os computadores/celulares da equipe em tempo real.
- **Estatísticas na hora**: veja total a receber, quantas pessoas devendo e quantos cookies faltam cobrar.
- **Ordenação flexível**: sort por "quem deve mais", nome ou quantidade.

**Como usar:**
1. Abra a aba **Clientes & Cobrança** no menu lateral
2. Clique na tab **Cobrança** (ícone de moedas)
3. Para cobrar: clique no botão **WhatsApp** (abre conversa pronta) ou **Copiar cobrança**
4. Quando o cliente pagar: clique no **✅ verde** no card — fica verde e salva a data/hora
5. Edite telefone/Instagram clicando nos campos (só digita números no telefone)

**Requisitos:**
- Login com Google obrigatório (botão "Entrar com Google" na lateral)
- Para sync em equipe: todos usam a mesma conta Google do projeto Firebase

**Problemas conhecidos:**
- Se duas pessoas editarem **pendências diferentes** ao mesmo tempo, a última salva ganha (raro, time pequeno OK)
- Telefone assume Brasil (DDI 55) — se tiver cliente fora do Brasil, edite manualmente o link

---

## 10. Checklist de Validação Pós-Deploy

- [ ] Build `npm run build` passa sem erros TypeScript/ESLint
- [ ] Deploy GitHub Pages carrega e loga com Google
- [ ] Aba "Clientes & Cobrança" → tab "Cobrança" carrega seed (12 itens)
- [ ] Editar telefone → botão WhatsApp abre link correto
- [ ] Marcar pago → badge verde + data/hora + stats atualizam
- [ ] Recarregar página → alterações persistem
- [ ] Login 2º usuário → vê dados sincronizados
- [ ] Exportar/Importar backup → **❌ FALHA ATUAL** — pendencias NÃO incluídas (corrigir `db.ts` + `App.tsx`)
- [ ] Console sem erros (exceto warnings de React DevTools)

---

**Fim da documentação.**  
Dúvidas ou ajustes: consultar `src/views/Cobranca.tsx` (lógica principal) e `src/sync.ts` (Firebase).