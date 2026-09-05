# Cargos e auditoria — ativação

Implementação preparada em 04/09/2026. A conta da CLI Firebase existente não tem permissões IAM no projeto sitezayuo: regras e billing retornaram 403; testIamPermissions retornou nenhum dos acessos necessários. Não ativar o frontend de cargos antes do backend e do dono inicial.

## Matriz

| Operação | Funcionário | Administrador | Dono |
| --- | --- | --- | --- |
| Catálogo e venda paga/pendente | Sim | Sim | Sim |
| Alterar preços, estoque, clientes, pagamentos antigos | Não | Sim | Sim |
| Financeiro, relatórios, backup, auditoria e desfazer | Não | Sim | Sim |
| Convidar, bloquear e alterar cargos | Não | Não | Sim |
| Alterar o próprio cargo ou o dono | Não | Não | Não |

Sem cadastro autorizado = sem acesso. Não existe promoção pelo primeiro login.
Funcionários recebem somente produtos e nomes/IDs dos clientes pelo callable getOperations. Firestore nega acesso direto à loja, auditoria e equipe. Todas as escritas compartilhadas passam por Functions; o cargo é consultado dentro da transação.

## Validação local

Instalar com npm ci na raiz e na pasta functions. Executar npm run verify na raiz.
Os testes do backend usam um adaptador de transações em memória: verificam a lógica e as escritas atômicas, mas não substituem a validação das regras no Firebase Emulator ou no projeto autorizado.
As dependências do backend usam overrides de uuid e qs para as versões corrigidas; manter package-lock.json.

## Ativação coordenada

1. Autenticar uma conta autorizada no projeto Firebase e configurar Application Default Credentials para o script administrativo. Confirmar disponibilidade de Cloud Functions de segunda geração e faturamento do projeto.
2. Fazer backup do banco e das regras publicadas antes da migração.
3. Executar npm run verify.
4. Configurar o dono inicial com node scripts/bootstrap-owner.mjs --email EMAIL_DO_DONO. O comando apenas apresenta a prévia; --apply grava. Rejeita conta desabilitada/não verificada e recusa executar se já houver um dono.
5. Publicar Functions e regras juntas durante a transição: firebase deploy --only functions,firestore:rules --project sitezayuo.
6. Validar dono, administrador, funcionário e bloqueado com contas de teste autorizadas. Verificar uma venda, saldo de estoque, reversão, bloqueio e negação de escrita direta.
7. Só então publicar o frontend desta implementação. O dono define a equipe em Auditoria → Equipe e acessos.

Clientes antigos perderão a escrita direta quando as regras novas entrarem; publicar a nova interface na mesma janela. Se a verificação de acesso falhar, o novo frontend bloqueia a entrada em vez de atribuir um cargo presumido.

## Limites explícitos

- Ações antigas sem snapshots não podem ser reconstruídas para desfazer.
- Alterações compartilhadas são agrupadas por transação de sincronização. A confirmação mostra os tipos e quantidades de registros envolvidos.
- Backups muito grandes podem ultrapassar o limite de snapshots do diário; nesses casos há registro, sem botão de reversão.
- Custos/perdas continuam locais ao aparelho, como no sistema anterior. O histórico identifica essas ações e sua reversão local exige o mesmo aparelho/conta e um navegador com Web Locks.
- Registros de equipe são revertidos definindo novamente um cargo pela aba Equipe; não há restauração automática de acessos nem transferência do dono.
- A migração antiga de contatos criptografados foi preservada no repositório, mas não integra o novo fluxo sem senhas.
