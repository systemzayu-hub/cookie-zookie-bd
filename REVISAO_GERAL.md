# Revisão geral — Cookie Zookie

## Entrega de 4 de setembro de 2026

### Experiência e operação

- Painel com resumo do dia, atalhos de reposição e cobrança, e sugestões de produção para três dias com base nas saídas dos últimos sete dias. As sugestões não movimentam estoque nem enviam mensagens.
- Alertas incluem sabores esgotados. Barras com valor zero têm largura zero.
- Clientes: busca por nome/telefone, filtros de situação, ordem alfabética e páginas de 25 registros. Histórico indexado por cliente para reduzir cálculos repetidos.
- Relatórios: busca por produto, filtros combinados, paginação, CSV com status e recebido, pagamentos parciais e presentes fora do faturamento.
- Datas dos relatórios no fuso de São Paulo; dias futuros excluídos. Recebimentos são agrupados pela venda de origem, pois o modelo existente não registra a data de cada recebimento.
- Correção das referências a variáveis CSS inexistentes; ajustes para telas menores, tema escuro, foco visível e impressão.
- Histórico de navegação funcional, menu responsivo acompanha mudanças de tamanho, campos de senha com identificadores únicos e confirmação acessível pelo teclado.

### Integridade e sincronização

- A gravação integral sem verificação foi removida. Transações com mesclagem de três versões preservam alterações em registros/campos independentes.
- Alterações simultâneas no mesmo estoque ou em campos incompatíveis geram conflito explícito. Não há escolha silenciosa de um vencedor.
- Uma cópia da versão de referência e das alterações locais permite recuperar pendências após recarregar. O envio é retomado ao voltar à rede, e há nova tentativa manual em falhas.
- Snapshots locais não são apresentados como confirmação do servidor; mudanças de metadados são observadas.
- Alterações recebidas durante uma gravação levam à renovação da assinatura para obter o estado confirmado mais recente.
- Vendas e baixa de estoque são calculadas juntas. Quantidades inválidas, IDs duplicados, clientes removidos, totais inconsistentes e estoque insuficiente são recusados.
- Importação por texto verifica todas as linhas e a quantidade acumulada do lote; correspondências ambíguas de cliente não são atribuídas automaticamente.
- Backups incompletos, dados não finitos e IDs duplicados são rejeitados. Mantida compatibilidade de leitura com os status legados.

### Automações e manutenção

- `npm run verify`: verificação TypeScript, testes e build de produção.
- Workflow de GitHub Actions preparado em `automation/verify.github-actions.yml`: verifica master/pull requests, audita dependências e guarda o build. A credencial GitHub recusou publicar arquivos em `.github/workflows` por falta do escopo `workflow`; por isso o workflow fica como modelo, não ativo. A validação local `npm run verify` está funcional.
- Dependabot configurado para revisões periódicas de dependências e actions.
- Vite atualizado para 7.3.6 e plugin React para 5.2.0; auditoria completa sem vulnerabilidades no momento da atualização.
- O build gera um service worker com versão baseada no conteúdo e precache de arquivos públicos. Após uma primeira carga online e instalação bem-sucedida, a estrutura do app pode abrir sem rede. Nenhuma resposta de Firebase/Google é armazenada pelo service worker. Escritas ainda dependem da confirmação online do Firestore.

### Segurança e limites concretos

- A senha geral continua em memória até F5; Auditoria mantém sua senha separada. A confirmação de vendas passou a usar a proteção geral.
- Corrigida a política CSP para permitir os endereços necessários ao reCAPTCHA do App Check. Uma chave válida e a ativação no Firebase continuam necessárias.
- `firestore.team.rules` e `firebase.team.json` preparam restrição por equipe. A regra consulta `app-access/team`, campo `emails` (lista), gerenciado exclusivamente pelo proprietário via console/Admin SDK. Os clientes não podem ler nem escrever essa configuração.
- **As regras restritas não foram implantadas:** a equipe autorizada não foi identificada e o acesso administrativo ao projeto não foi validado. A configuração padrão existente foi preservada para evitar bloqueio da operação. Senhas na interface não substituem regras de autorização no servidor.
- Custos e perdas continuam locais ao aparelho e incluídos no backup. Não foram migrados silenciosamente para outro esquema de banco. Perdas de exemplo deixaram de ser criadas em instalações vazias; novos lançamentos usam o custo editado no aparelho.
- O armazenamento compartilhado ainda usa um documento de loja; permanecem os limites do Firestore e os limites atuais de 500 produtos, 2.000 clientes e 5.000 vendas. Escalar além disso exige migração para coleções por entidade e testes com dados reais.
- Auditoria permanece append-only no esquema de regras, mas o envio é best-effort e separado da transação da loja; não constitui um livro de auditoria garantido pelo servidor. Desfazer continua limitado à sessão e às operações existentes.
- A suíte usa um adaptador simulado de Firestore nos testes do hook. Não equivale a testes contra o Firestore de produção nem a validação em dois aparelhos reais.
- O navegador controlável estava indisponível nesta sessão. A inspeção visual interativa e o login real não foram validados; não foram contornadas as proteções de acesso para produzir uma validação artificial.

### Validações locais

- 17 testes de regressão aprovados, incluindo o hook React com Firestore simulado e renderização HTML de componentes.
- TypeScript e build de produção aprovados com Vite 7.3.6.
- Auditoria completa de dependências: zero vulnerabilidades.
- Nenhuma variável CSS referenciada sem definição.
- Service worker gerado e sintaticamente validado; 23 arquivos estáticos no precache.
- Cópia adicional do último conflito preservada no aparelho e exportável pela barra lateral.

### Referências técnicas

- [Transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Migração para Vite 7](https://v7.vite.dev/guide/migration)

## Operação

Use Node 22.12 ou posterior. Instale com `npm ci` e execute `npm run verify`. Para desenvolver, `npm run dev`. O build está em `dist/` e utiliza caminhos relativos compatíveis com GitHub Pages.

Para ativar as regras por equipe, primeiro crie o documento de acesso com a lista correta pelo console Firebase/Admin SDK, valide contas permitidas e bloqueadas com o emulador, e então publique especificamente `firebase.team.json`. Nunca publique a regra restrita antes de provisionar o acesso do proprietário e da equipe.

Em conflitos, exporte a cópia local antes de carregar a versão da equipe. A versão exportada deve ser comparada e reaplicada com cuidado; não restaure um backup inteiro só para recuperar uma venda.
