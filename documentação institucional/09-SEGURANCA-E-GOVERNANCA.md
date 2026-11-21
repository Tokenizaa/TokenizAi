# Segurança e governança

## 1. Objetivo

Aplicar a governança institucional da NettosCorp de forma efetiva no backend, preservando a autoridade executiva humana e delegando autonomia operacional dentro de limites explícitos.

## 2. Identidade e autenticação

- Usuários humanos devem ser autenticados por mecanismo confiável.
- O backend valida assinatura, emissor, audiência, expiração e sessão.
- Identidade e papel nunca devem ser aceitos apenas porque o frontend os declarou em um cabeçalho.
- Ações de agentes devem ser atribuídas à instância, ao runtime e à tarefa que as originaram.
- Identidade humana e identidade de agente são tipos distintos.

## 3. Autorização

Cada operação deve validar:
- Ator autenticado.
- Organização/tenant.
- Recurso e escopo.
- Permissão específica.
- Relação hierárquica relevante.
- Política de autoridade.
- Estado do recurso.
- Aprovação adicional, quando necessária.

Ocultar botões no frontend não é controle de segurança.

## 4. Autoridade institucional

Distinguir:
- Autoridade executiva humana.
- Autoridade estratégica delegada.
- Autoridade gerencial.
- Autoridade operacional.
- Autoridade técnica.

A hierarquia organizacional não concede automaticamente poder para aprovar orçamento, alterar estratégia, modificar políticas ou executar ações reservadas ao fundador.

Aplicar o Modelo de Autoridade institucional homologado pela NettosCorp como fonte normativa, com referência e versão explícitas. A implementação técnica não deve inventar ou reinterpretar limites sem registrar a regra correspondente.

## 5. Aprovações

Ações de risco ou impacto elevado devem possuir política de aprovação: alteração estrutural relevante, compromisso financeiro, mudança de autoridade, exclusão destrutiva, publicação ou operação irreversível.

A aprovação precisa registrar solicitante, aprovador, política, escopo, decisão, justificativa e instante.

## 6. Auditoria

Registrar alterações de:
- Perfis e versões.
- Homologações.
- Instâncias e cargos.
- Hierarquia e delegações.
- Permissões e ferramentas.
- Configurações de runtime.
- Orçamentos e consumo.
- Tarefas e entregas.
- Execuções e cancelamentos.
- Decisões e aprovações.

O registro deve identificar ator, ação, alvo, contexto, instante, resultado e correlação. Hash isolado não substitui armazenamento íntegro, controle de acesso e retenção.

## 7. Segurança de agentes

- Privilégio mínimo.
- Isolamento por projeto/organização.
- Limites de execução e orçamento.
- Proteção contra prompt injection em conteúdo externo.
- Aprovação humana para ações críticas.
- Segregação de ferramentas por perfil e instância.
- Controle de saída e acesso a dados.
- Limites para delegação recursiva e execução paralela.

## 8. Critérios de homologação

Testes negativos de autorização são obrigatórios: usuário operacional não pode simular papel executivo; agente não pode elevar autoridade; subordinado não pode acessar conversas privadas fora do escopo; credenciais não podem ser expostas; orçamento e ferramentas devem ser respeitados no backend.
