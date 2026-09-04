# Relatório de segurança — Cookie Zookie

Atualizado em 04/09/2026. Este documento não contém senhas, hashes, chaves ou dados pessoais.

## Correções implantadas

- Removidos do código público os hashes e a verificação local de senha.
- Removidos do bundle os clientes e as vendas usados como dados iniciais.
- Login e reautenticação sensível passam pela conta Google conectada ao Firebase.
- Áreas financeiras e de auditoria não renderizam o conteúdo enquanto bloqueadas.
- Ações de alteração e exclusão pedem reautenticação recente.
- Liberações sensíveis ficam apenas em memória e expiram após cinco minutos de inatividade.
- O logout e o fechamento da página revogam todas as liberações locais.
- Erros de armazenamento local deixam de ser ignorados silenciosamente.
- Regras do Firestore limitam leitura e gravação a usuários autenticados, proíbem exclusão direta do documento principal e tornam a auditoria somente-acréscimo.
- Entradas de auditoria só podem declarar o e-mail da própria conta autenticada.

## Limites importantes

Autenticação não substitui autorização por cargo. Antes de abrir o aplicativo para contas Google não confiáveis, deve ser implantada uma lista de membros ou RBAC no Firestore (por exemplo, documentos de papéis administrados fora do cliente ou custom claims). As regras atuais evitam acesso anônimo, mas aceitam qualquer conta que o projeto Firebase permita autenticar.

O histórico antigo do Git pode conservar versões anteriores de arquivos. Como as antigas senhas locais deixaram de autorizar qualquer operação, elas não controlam mais o sistema. Mesmo assim, quaisquer credenciais reutilizadas em outro lugar devem ser trocadas. Uma limpeza destrutiva do histórico remoto deve ser planejada separadamente.

## Próximas camadas recomendadas

1. Lista de membros e cargos (`admin`, `vendedor`, `auditor`) aplicada nas regras Firestore.
2. App Check para reduzir clientes automatizados não autorizados.
3. Lixeira lógica com prazo de recuperação, em vez de exclusão imediata.
4. Backup automatizado e teste periódico de restauração.
5. Alertas de login e revisão periódica da auditoria.
6. Política de retenção e consentimento adequada aos dados pessoais armazenados.

## Validação mínima de cada publicação

- Executar o build de produção.
- Confirmar que o bundle não contém dados iniciais pessoais, hashes ou credenciais.
- Testar login, reautenticação, expiração por inatividade e logout.
- Testar regras em ambiente controlado antes de endurecer papéis e permissões.
- Conferir as telas de produtos e os bloqueios em desktop e celular.
