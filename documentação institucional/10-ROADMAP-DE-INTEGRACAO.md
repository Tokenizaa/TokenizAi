# Roadmap de integração — NettosCorp Enterprise

## Diretriz

Evoluir o TokenizAi existente, preservando módulos úteis e corrigindo os fundamentos antes de ampliar operações. Não iniciar reescrita total nem implementar funcionalidades duplicadas sem auditoria.

## Fase 0 — Auditoria e inventário

- Auditar o checkout real do TokenizAi.
- Completar engenharia reversa local do Paperclip.
- Completar engenharia reversa local do Agency Agents.
- Comparar catálogo original com catálogo embutido.
- Mapear rotas, APIs, banco, persistência, autenticação e testes.
- Identificar mocks, seeds, dados demonstrativos e fluxos quebrados.
- Entregar matriz de aderência e inventário de riscos.

**Saída:** diagnóstico rastreável, sem alterações funcionais durante a auditoria.

## Fase 1 — Arquitetura e contratos

- Aprovar modelo de domínio.
- Definir fonte de verdade por entidade.
- Definir identidade, autorização e autoridade.
- Definir contratos de chat, tarefa, delegação e runtime.
- Definir estratégia de eventos e auditoria.
- Definir estratégia de migração e compatibilidade.

**Saída:** arquitetura técnica, ERD, contratos e decisões registradas.

## Fase 2 — Fundação corporativa

- Autenticação e autorização efetivas.
- Persistência durável.
- Organizações, departamentos, cargos e posições.
- Autoridade e políticas.
- Auditoria e eventos.
- Migração segura dos dados atuais.

**Saída:** base confiável e testes de segurança.

## Fase 3 — Biblioteca e inteligência profissional

- Importar catálogo original com proveniência.
- Versionar perfis e metodologias.
- Pesquisar e filtrar competências.
- Homologar perfis.
- Evoluir Team Composer.
- Explicar recomendações e lacunas.
- Preservar NEXUS e runbooks.

**Saída:** biblioteca rastreável e composição de equipes validada.

## Fase 4 — Organização e equipes

- Organograma configurável.
- Instâncias de agentes.
- Posições e relações hierárquicas.
- Formação de equipes e membership.
- Liderança, responsabilidades e metas.
- Equipes humanas e digitais.

**Saída:** estrutura organizacional funcional.

## Fase 5 — Comunicação e delegação

- Chat individual, de equipe e de projeto.
- Conversas contextuais e permissões.
- Tarefas e delegações.
- Handoffs e colaboração entre especialistas.
- Revisão, bloqueios e escalonamento.
- Histórico e evidências.

**Saída:** equipes capazes de coordenar trabalho com rastreabilidade.

## Fase 6 — Runtime e monitoramento

- Contratos de adaptadores.
- Integração efetiva com Hermes/provedores.
- Ferramentas e credenciais seguras.
- Execuções, sessões e heartbeat.
- Logs, falhas, retries e cancelamentos.
- Orçamentos e consumo medido.

**Saída:** execução observável e controlada.

## Fase 7 — Integração empresarial

- Projetos conectados a equipes e tarefas.
- Financeiro conectado a orçamento e consumo.
- Pessoas e organograma integrados.
- Comercial, clientes, produtos e operações conectados.
- Indicadores executivos baseados em dados reais.

**Saída:** processos empresariais integrados.

## Fase 8 — Homologação e retirada das dependências de interface

- Testes ponta a ponta.
- Testes de segurança e autorização.
- Testes de persistência e recuperação.
- Testes de adaptadores.
- Validação de desempenho e acessibilidade.
- Confirmar que o usuário não precisa abrir painéis independentes.
- Desativar dependências de interface antigas somente após equivalência comprovada.

**Saída:** TokenizAi homologado como interface e plataforma central.

## Regra de execução por fase

Cada fase deve produzir:
1. Escopo e decisões.
2. Alterações identificadas.
3. Testes executados.
4. Evidências verificáveis.
5. Pendências e riscos.
6. Critério objetivo de aceite.
7. Atualização desta documentação.

Não declarar fase concluída com base apenas em build ou relatório sem evidência.
