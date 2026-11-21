# Registro de evidências e pendências

## 1. Evidências iniciais do TokenizAi

| Arquivo | Evidência observada | Implicação |
|---|---|---|
| `package.json` | React, Vite, Express, TypeScript, Gemini e PWA | Stack inicial identificada |
| `server.ts` | DB_PATH e SYNC_STORE_PATH em /tmp | Persistência não durável para produção |
| `server.ts` | getCallerRole lê x-nettoscorp-role | Papel declarado pelo cliente não pode ser confiado |
| `server.ts` | getGeminiClient e fluxo de adapter Paperclip | Necessário rastrear runtime realmente chamado |
| `src/App.tsx` | Shell e módulos empresariais | Base de navegação existente |
| `src/domain/permissions.ts` | Papéis e capacidades | Referência de domínio; não prova autorização segura |
| `src/domain/agencyLibrary.ts` | Perfis com identidade, competências, skills e runbooks | Base de biblioteca profissional |

## 2. Referências do Agency Agents analisadas anteriormente

- Repositório: https://github.com/msitarzewski/agency-agents
- Estratégia NEXUS: `strategy/nexus-strategy.md`
- Orquestrador: `specialized/agents-orchestrator.md`
- Gerador Hermes: `scripts/build-hermes-plugin.py`
- Integração Hermes: `integrations/hermes/`
- Catálogo e divisões: `divisions.json`, diretórios de agentes e `CONTRIBUTING.md`

A revisão atual do repositório deve confirmar os caminhos, conteúdos e contagens antes da importação.

## 3. Referências arquiteturais do Paperclip

A inspeção inicial do fork identificou monorepo com UI, server, packages de banco/shared/adapters/plugins, CLI e skills. O checkout local ainda precisa ser identificado por remote, branch e commit antes de concluir a engenharia reversa.

## 4. Pendências prioritárias

### P0 — Segurança e confiabilidade
- [ ] Validar autenticação real e eliminar confiança em `x-nettoscorp-role`.
- [ ] Definir persistência durável e recuperação.
- [ ] Validar autorização no backend em todas as rotas.
- [ ] Verificar se o adaptador Paperclip realmente executa o runtime configurado.
- [ ] Identificar e classificar dados de demonstração.

### P1 — Auditoria de arquitetura
- [ ] Inspecionar checkout local do TokenizAi.
- [ ] Inspecionar checkout local do Paperclip.
- [ ] Inspecionar checkout local do Agency Agents.
- [ ] Mapear rotas, endpoints, schemas e fluxos.
- [ ] Executar testes seguros e registrar evidências.

### P2 — Modelo integrado
- [ ] Aprovar AgentProfile, AgentInstance e RuntimeConfig separados.
- [ ] Definir Team, TeamMembership, Department e Position.
- [ ] Definir Conversation, Participant, Message, Task e Delegation.
- [ ] Definir Execution, Heartbeat, UsageRecord e Budget.
- [ ] Definir proveniência e versionamento.

### P3 — Produto e operação
- [ ] Evoluir Team Composer.
- [ ] Implementar organograma configurável.
- [ ] Implementar chat de equipe e contexto.
- [ ] Implementar delegação hierárquica.
- [ ] Integrar runbooks e NEXUS.
- [ ] Implementar monitoramento e custos medidos.

## 5. Protocolo de evidência

Para cada achado, registrar:
- Identificador.
- Repositório e commit.
- Caminho e símbolo/linhas.
- Tipo de evidência (código, teste, execução, documentação).
- Procedimento de validação.
- Resultado.
- Severidade/impacto.
- Status e responsável.

## 6. Regra de honestidade técnica

Código presente não prova execução. Variável de ambiente não prova integração. Tela não prova persistência. Papel visual não prova autorização. Heartbeat simulado não prova disponibilidade. Custo estimado não prova consumo medido.

As conclusões devem refletir somente o que foi efetivamente inspecionado e validado.
