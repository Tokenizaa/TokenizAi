# Evidências e Pendências — Auditoria Técnica NettosCorp Enterprise

> **Versão:** 2.0  
> **Data:** 21 de novembro de 2026  
> **Status:** **CONSOLIDADO COM EVIDÊNCIAS REAIS** — Atualizado com auditoria direta de 4 repositórios e estado do GitHub Actions  
> **Responsável:** Hermes

---

## 1. Resumo de Evidências por Repositório

### 1.1 TokenizAi (Plataforma Central) — `/home/lg/workspace/NettosCorp/TokenizAi`

| Componente | Status | Evidência (arquivo:linha) | Classificação |
|------------|--------|---------------------------|---------------|
| **Frontend React 19** | ✅ **FUNCIONAL** | `src/App.tsx:1-475`, `src/main.tsx:1-5`, `package.json:22-23` | ✅ **APROVEITAR** |
| **17 Módulos React** | ✅ **IMPLEMENTADOS** | `src/modules/` (17 dirs), `App.tsx:311-421` | ✅ **APROVEITAR** |
| **RBAC Frontend (11 roles)** | ✅ **IMPLEMENTADO** | `src/domain/permissions.ts:15-137`, `App.tsx:60,113-119` | ✅ **APROVEITAR** |
| **17 Módulos Navegação** | ✅ **IMPLEMENTADOS** | `App.tsx:311-421` (hash routing) | ✅ **APROVEITAR** |
| **Persistência localStorage** | ✅ **FUNCIONAL** | `enterpriseService.ts:17-76` | ⚠️ **APENAS BROWSER** |
| **Sync Queue + Offline** | ✅ **IMPLEMENTADO** | `enterpriseService.ts:61-76`, `App.tsx:59,92-94,209-216` | ⚠️ **APENAS BROWSER** |
| **Audit Log (FNV-1a)** | ✅ **IMPLEMENTADO** | `enterpriseService.ts:84-121` | ⚠️ **APENAS BROWSER** |
| **Tipos TypeScript (374 linhas)** | ✅ **COMPLETO** | `src/types/enterprise.ts:1-374` | ✅ **APROVEITAR** |
| **Mock Data (enterpriseSeed)** | ⚠️ **100% MOCK** | `enterpriseSeed.ts:5-882` (todos `origin: 'demonstrativo'`) | 🔴 **SUBSTITUIR** |
| **Backend Express** | ✅ **FUNCIONAL** | `server.ts:1-390` | ⚠️ **MÍNIMO** |
| **Health Check** | ✅ **FUNCIONAL** | `server.ts:47-61` | ✅ **APROVEITAR** |
| **Gemini AI Endpoints** | ✅ **FUNCIONAL** | `server.ts:166-290` | ✅ **APROVEITAR** (precisa key) |
| **GitHub API (público)** | ✅ **FUNCIONAL** | `server.ts:63-164` | ⚠️ **PÚBLICO APENAS** |
| **Sync State API** | ✅ **FUNCIONAL** | `server.ts:333-369` | ⚠️ **APENAS /tmp** |
| **Health Check Integrations** | ✅ **FUNCIONAL** | `server.ts:47-61` | ✅ **APROVEITAR** |

---

### 1.2 Agency Agents — Corpus Fork — `Tokenizaa/agency-agents`

| Componente | Status | Evidência | Classificação |
|------------|--------|-----------|---------------|
| **Catálogo de agentes** | ✅ **EVIDENCIADO** | 282 arquivos de agentes nas 18 divisões definidas em `divisions.json` | ✅ **APROVEITAR** |
| **Hermes Plugin Builder** | ✅ **PRESENTE** | `scripts/build-hermes-plugin.py` | 🟡 **VALIDAÇÃO CI PENDENTE** |
| **Hermes Plugin Contract Check** | ✅ **PRESENTE** | `scripts/check-hermes-plugin.py` | 🟡 **VALIDAÇÃO CI PENDENTE** |
| **Hermes Plugin Behavior Test** | ✅ **PRESENTE** | `scripts/test-hermes-plugin.py` | 🟡 **VALIDAÇÃO CI PENDENTE** |
| **Scripts operacionais** | ✅ **PRESENTES** | `scripts/lib.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh`, `check-tools.sh` | 🟡 **EXECUÇÃO CI PENDENTE** |
| **NEXUS Strategy** | ✅ **PRESENTE** | `strategy/nexus-strategy.md`, `strategy/playbooks/` (7 playbooks), `strategy/runbooks/` (4 runbooks) | 🟡 **VALIDAÇÃO CI PENDENTE** |
| **Antigravity** | ✅ **DETERMINÍSTICO NO CÓDIGO ATUAL** | `scripts/convert.sh`: conversor não emite `date_added`; teste de regressão criado em `scripts/test-antigravity-determinism.sh` | 🟡 **EXECUÇÃO CI PENDENTE** |
| **Agents Orchestrator** | ✅ **REFERÊNCIA CORRIGIDA** | `specialized/agents-orchestrator.md`: quatro referências atualizadas para `testing-evidence-collector` | ✅ **CORRIGIDO** |
| **Workflows do corpus** | ⚠️ **EXECUÇÃO NÃO HOMOLOGADA** | Workflows existentes; novas verificações Hermes/Antigravity adicionadas em `.github/workflows/check-tools.yml` | 🔴 **BLOQUEIO CI** |

### 1.3 Agency Agents — Desktop App — `Tokenizaa/agency-agents-app`

| Componente | Status | Evidência | Classificação |
|------------|--------|-----------|---------------|
| **Frontend** | ✅ **EVIDENCIADO** | `package.json`: Svelte 5 + SvelteKit + Vite | ✅ **APROVEITAR** |
| **Desktop backend** | ✅ **EVIDENCIADO** | `src-tauri/Cargo.toml`: Tauri 2 + Rust edition 2021 | ✅ **APROVEITAR** |
| **Rust formatting** | ✅ **NO WORKFLOW** | `.github/workflows/pr-check.yml`: `cargo fmt --check` | 🟡 **EXECUÇÃO CI PENDENTE** |
| **Rust tests** | ✅ **NO WORKFLOW** | `.github/workflows/pr-check.yml`: `cargo test` | 🟡 **EXECUÇÃO CI PENDENTE** |
| **Frontend typecheck** | ✅ **NO WORKFLOW** | `.github/workflows/pr-check.yml`: `npm run check` | 🟡 **EXECUÇÃO CI PENDENTE** |
| **Frontend production build** | ✅ **ADICIONADO** | Commit `5757c80`: `npm run build` incluído no PR Check | 🟡 **EXECUÇÃO CI PENDENTE** |

### 1.4 Paperclip — `/home/lg/workspace/NettosCorp/NettosCorp/paperclip`

| Componente | Status | Evidência | Classificação |
|------------|--------|-----------|---------------|
| **Monorepo (27 packages)** | ✅ **EVIDENCIADO** | `pnpm-workspace.yaml`, `package.json` | ✅ **APROVEITAR** |
| **Server Express 5** | ✅ **EVIDENCIADO** | `server/src/index.ts`, `app.ts` (1485 linhas) | ✅ **APROVEITAR** |
| **UI React 19 + Vite** | ✅ **EVIDENCIADO** | `ui/src/main.tsx`, `App.tsx` (887 linhas) | ✅ **APROVEITAR** |
| **Database (Drizzle + PG)** | ✅ **EVIDENCIADO** | `packages/db/` — 480+ tabelas, 490+ migrations | ✅ **APROVEITAR** |
| **Adapters ACP (12)** | ✅ **EVIDENCIADO** | `packages/adapters/*` | ✅ **APROVEITAR** |
| **Plugin SDK v1.0.0** | ✅ **EVIDENCIADO** | `packages/plugins/sdk/` | ✅ **APROVEITAR** |
| **MCP Server (STDIO)** | ✅ **EVIDENCIADO** | `packages/mcp-server/` | ✅ **APROVEITAR** |
| **Embedded PostgreSQL** | ✅ **EVIDENCIADO** | `packages/db/src/embedded-postgres-*.ts` | ✅ **APROVEITAR** |
| **Docker / ECS / Quadlet** | ✅ **EVIDENCIADO** | `docker/` | ✅ **APROVEITAR** |
| **Hermes Adapter** | ✅ **EVIDENCIADO** | `packages/adapters/hermes/` | ✅ **APROVEITAR** |
| **Testes (230/230 pass)** | ✅ **EVIDENCIADO** | `pnpm test` — 230/230 pass | ✅ **APROVEITAR** |
| **CI/CD (Turbo + Changesets)** | ✅ **EVIDENCIADO** | `turbo.json`, `changesets` | ✅ **APROVEITAR** |
| **OpenAPI Spec** | ❌ **AUSENTE** | Rotas documentadas manualmente | 🟢 **IMPLEMENTAR** |
| **RLS Policies** | ⚠️ **DEFINIDAS, NÃO ATIVAS** | Definidas, ativáveis via `ENABLE_RLS_ENFORCEMENT` | 🟢 **ATIVAR** |
| **Better Auth v1.7** | ✅ **EVIDENCIADO** | `server/src/auth/better-auth.ts` | ⚠️ **VERSION LOCK** |
| **OpenAPI Spec** | ❌ **AUSENTE** | Rotas documentadas manualmente | 🟢 **IMPLEMENTAR** |

---

## 2. Pendências Críticas (P0 — Bloqueiam Início)

| ID | Pendência | Repositório | Evidência | Ação Necessária | Responsável | Prazo |
|----|-----------|-------------|-----------|-----------------|-------------|-------|
| **P0-01** | **Nenhum banco de dados / ORM no TokenizAi** | TokenizAi | `grep -r "drizzle\|prisma\|supabase" src/` → vazio | Implementar Drizzle + PostgreSQL + migrations | Platform Engineer | Fase 1 |
| **P0-02** | **Nenhuma autenticação backend** | TokenizAi | `server.ts` — sem auth middleware | Implementar Better Auth + JWT + sessions | Platform Engineer | Fase 1 |
| **P0-03** | **Nenhuma persistência real** | TokenizAi | `localStorage` + `/tmp` apenas | PostgreSQL + Drizzle + migrations + RLS | Platform Engineer | Fase 1 |
| **P0-04** | **Nenhum auth providers** | TokenizAi | `server.ts` — sem auth middleware | Better Auth + GitHub/Google/Slack OAuth | Platform Engineer | Fase 1 |
| **P0-04** | **Paperclip não configurado** | TokenizAi | `enterpriseSeed.ts:771-778`, `server.ts:57` | Configurar `PAPERCLIP_ENDPOINT` + `PAPERCLIP_API_KEY` | Platform Engineer | Fase 0 |
| **P0-05** | **Supabase não configurado** | TokenizAi | `enterpriseSeed.ts:751-760`, `server.ts:56` | Configurar `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Platform Engineer | Fase 0 |
| **P0-06** | Validação funcional do Hermes Plugin | Agency Agents | Builder, contract check e behavior test presentes; execução ainda não homologada | CI gera o plugin e executa os dois testes; exigir execução verde | Platform | Fase 0 |
| **P0-07** | Validação dos scripts do Agency Agents | Agency Agents | `lib.sh`, `install.sh`, `lint-agents.sh`, `check-divisions.sh` e `check-tools.sh` presentes no fork | Executar workflows de validação e corrigir falhas reais | Platform | Fase 0 |
| **P0-08** | Validação da NEXUS Strategy | Agency Agents | `strategy/nexus-strategy.md`, 7 playbooks e 4 runbooks presentes | Executar validação de runbooks e revisar consistência | Platform | Fase 0 |
| **P0-09** | Regressão de determinismo Antigravity | Agency Agents | Conversor atual não emite `date_added`; teste determinístico adicionado | Executar `scripts/test-antigravity-determinism.sh` em CI | Platform | Fase 0 |
| **P0-10** | Referência EvidenceQA obsoleta | Agency Agents | Quatro ocorrências em `specialized/agents-orchestrator.md` substituídas por `testing-evidence-collector` no commit `4df4038` | Reexecutar linter após restauração do CI | Platform | Fase 0 |
| **P0-11** | Parity/determinismo Antigravity | Agency Agents | Teste de regressão adicionado; resultado ainda não executado | Confirmar resultado verde do teste | Platform | Fase 0 |
| **P0-12** | NEXUS Strategy — item duplicado de P0-08 | Agency Agents | Conteúdo presente em `strategy/`; não é mais ausência de arquivo | Consolidar como resolvido após validação CI | Platform | Fase 0 |
| **P0-13** | Scripts de validação — item duplicado de P0-07 | Agency Agents | Scripts previstos estão presentes no fork | Consolidar como resolvido após validação CI | Platform | Fase 0 |
| **P0-14** | Homologação do GitHub Actions | Agency Agents + Desktop App | Workflows adicionados/atualizados; execuções falharam antes de iniciar steps (steps vazios/nulos), sem logs recuperáveis | Verificar disponibilidade/permissões dos runners e obter CI verde nos dois repositórios | Platform | Fase 0 |

---

## 3. Pendências Altas (P1 — Necessárias para MVP)

| ID | Pendência | Repositório | Evidência | Ação Necessária | Fase |
|----|-----------|-------------|-----------|-----------------|------|
| **P1-01** | Foundation Packages (`shared`, `db`, `auth`) | — | — | Extrair `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` | Fase 1 |
| **P1-01** | **Nenhum banco de dados / ORM** | TokenizAi | `grep -r "drizzle\|prisma" src/` → vazio | Implementar Drizzle + PostgreSQL + migrations | Fase 1 |
| **P1-02** | **Nenhuma autenticação backend** | TokenizAi | `server.ts` — sem auth middleware | Implementar Better Auth + JWT + sessions | Fase 1 |
| **P1-03** | **Nenhuma persistência real** | TokenizAi | `localStorage` + `/tmp` apenas | PostgreSQL + Drizzle + migrations + RLS | Fase 1 |
| **P1-04** | **Nenhum auth providers** | TokenizAi | `server.ts` — sem auth middleware | Better Auth + GitHub/Google/Slack OAuth | Fase 1 |
| **P1-05** | **Paperclip não configurado** | TokenizAi | `enterpriseSeed.ts:771-778` | Configurar `PAPERCLIP_ENDPOINT` + `PAPERCLIP_API_KEY` | Fase 0 |
| **P1-06** | **Supabase não configurado** | TokenizAi | `enterpriseSeed.ts:751-760` | Configurar `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Fase 0 |
| **P1-07** | Adapters + MCP packages (14) | — | — | Publicar 12 adapters ACP + MCP server/gateway | Fase 2 |
| **P1-08** | Catalog Sync Pipeline (AA → Paperclip) | — | — | GitHub webhook → Paperclip Skill Catalog | Fase 6 |
| **P1-09** | Agent Hire Flow (`hireAgent(slug)`) | — | — | AA corpus → Paperclip agent provisioning | Fase 7 |

---

## 4. Pendências Médias (P2 — Pós-MVP)

| ID | Pendência | Repositório | Ação Necessária | Fase |
|----|-----------|-------------|-----------------|------|
| **P2-01** | Governance Layer (Authority + Policy + Audit) | — | Authority Engine, Policy Engine (OPA), Audit Trail | Fase 8 |
| **P2-02** | Memory Layer (Vector DB + RAG + Graph) | — | pgvector + RAG + Knowledge Graph (Apache Age) | Fase 9 |
| **P2-02** | **NEXUS Strategy ausente no fork** | Agency Agents | Sync `strategy/` do upstream `msitarzewski/agency-agents` | Fase 0 |
| **P2-03** | **Scripts validação AA ausentes** | Agency Agents | Recuperar `lib.sh`, `install.sh`, `lint-agents.sh`, etc. do upstream | Fase 0 |
| **P2-04** | **CI/CD ausente no fork AA** | Agency Agents | Implementar GitHub Actions básico | Fase 0 |
| **P2-05** | NEXUS Playbooks/Runbooks | Agency Agents | Adotar `playbooks/`, `runbooks/`, `runbooks.json` do upstream | Fase 10 |

---

## 5. Pendências de Auditoria Complementar (Não Verificadas)

| Área | Item | Status | Necessita Acesso/Execução |
|------|------|--------|---------------------------|
| **TokenizAi** | Supabase D1/D1 bindings reais | ❓ Não Verificado | Precisa `wrangler.toml` bindings + `npx wrangler dev` |
| **TokenizAi** | D1 schema / migrations reais | ❓ Não Verificado | Precisa `npx wrangler d1 execute` |
| **TokenizAi** | D1 data persistence real | ❓ Não Verificado | Precisa deploy preview + test |
| **TokenizAi** | Cloudflare KV/D1/R2 bindings | ❓ Não Verificado | Precisa `wrangler.toml` bindings reais |
| **TokenizAi** | Deploy Cloudflare Pages real | ❓ Não Verificado | Precisa `pnpm run build` + `wrangler pages deploy` |
| **Paperclip** | Embedded PG behavior under load | ❓ Não Verificado | Precisa load test |
| **Paperclip** | RLS Policies enforcement real | ❓ Não Verificado | Precisa `ENABLE_RLS_ENFORCEMENT=true` + test |
| **Paperclip** | MCP Gateway OAuth flow real | ❓ Não Verificado | Precisa client credentials test |
| **Agency Agents** | Hermes plugin build + behavior | ⚠️ Implementado, não homologado | Builder, contract check e behavior test estão presentes; CI não iniciou steps |
| **Agency Agents** | NEXUS playbooks/runbooks completeness | ⚠️ Conteúdo presente, validação pendente | 7 playbooks e 4 runbooks; workflow de consistência sem execução homologada |
| **Agency Agents** | Hermes plugin end-to-end | ❓ Não Verificado | Precisa plugin instalado no Hermes + test |

---

## 6. Decisões Arquiteturais Pendentes (Requer Aprovação Founder)

| Decisão | Opções | Recomendação Técnica | Impacto |
|---------|--------|---------------------|---------|
| **Vector DB** | pgvector (PG) vs Pinecone vs Weaviate | **pgvector** (unified PG, custo zero) | Baixo custo, unified stack |
| **Knowledge Graph** | Apache Age (PG extension) vs Neo4j | **Apache Age** (unified PG) | Baixo custo, unified stack |
| **Workflow Engine** | Paperclip routines + NEXUS vs Temporal vs custom | **Paperclip + NEXUS** (reutilização) | Reutiliza código existente |
| **API Gateway** | Cloudflare Workers (atual) vs Kong vs custom | **Cloudflare Workers** (já em TokenizAi) | Aproveita infra atual |
| **Secrets** | 1Password (Paperclip) vs Vault vs AWS Secrets | **1Password** (já integrado) | Aproveita integração atual |
| **Frontend Framework** | React 19 (Paperclip) vs Svelte 5 (TokenizAi/AA) | **React 19** (Paperclip base) | Migração TokenizAi necessária |
| **Package Manager** | pnpm (Paperclip/AA) vs Bun (TokenizAi) | **pnpm** (monorepo standard) | Migração TokenizAi necessária |
| **Monorepo Structure** | Single package (TokenizAi) vs 27 packages (Paperclip) | **pnpm workspace** (Paperclip model) | Reestruturação TokenizAi |

---

## 7. Riscos Técnicos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **TokenizAi backend rebuild completo** | Alta | Alto | Fase 1 dedicada + team dedicado |
| **React 19 / Express 5 breaking changes** | Média | Médio | Lock versions exatas; test matrix CI |
| **Better Auth v1.x breaking changes** | Alta | Médio | Wrapper próprio + version lock |
| **Upstream Agency Agents API changes** | Baixa | Médio | Pin commit `8ae6164`; sync controlado |
| **Paperclip React 19/Express 5 RC** | Média | Médio | Lock versions; test matrix |
| **OPA/Rego learning curve** | Média | Médio | Treinamento + templates prontos |
| **Vector DB performance at scale** | Média | Médio | pgvector primeiro; migra se necessário |
| **Founder availability para approvals** | Alta | Alto | Agendar reviews semanais fixos |
| **TokenizAi React migration (Svelte→React)** | Alta | Alto | Fase 4 dedicada + team frontend |

---

## 7. Próximas Ações Imediatas (Esta Semana)

| Ação | Responsável | Critério de Conclusão |
|------|-------------|-----------------------|
| 1. Recuperar `build-hermes-plugin.py` do upstream | Hermes | Script funcional, gera plugin Hermes |
| 2. Recuperar `scripts/` completos do upstream AA | Hermes | Scripts executam sem erro |
| 3. Sync `strategy/` (NEXUS) do upstream | Hermes | 7 arquivos NEXUS no checkout |
| 4. Patch Antigravity `date_added` → determinístico | Hermes | Parity test passa |
| 4. Configurar GitHub Actions básico (fmt, test, build) | Platform | CI verde no fork Tokenizaa |
| 5. Configurar `PAPERCLIP_ENDPOINT` + `PAPERCLIP_API_KEY` no TokenizAi | Platform | Health check mostra `paperclip: true` |
| 6. Configurar `SUPABASE_URL` + `SUPABASE_ANON_KEY` no TokenizAi | Platform | Health check mostra `supabase: true` |
| 7. Configurar `GEMINI_API_KEY` válida no TokenizAi | Platform | Endpoints `/api/ai/*` retornam 200 |
| 8. Configurar `GITHUB_TOKEN` no TokenizAi | Platform | `/api/integrations/github/inspect` funciona para repos privados |
| 9. Iniciar Fase 1: `@nettoscorp/shared`, `@nettoscorp/db`, `@nettoscorp/auth` | Platform Engineer | 3 packages publicados no npm privado |

---

## 8. Evidências Consolidadas (Referência Rápida)

| Repositório | Commit | Arquivos-Chave Auditados | Total Linhas Auditadas |
|-------------|--------|-------------------------|------------------------|
| **TokenizAi** | `2988750` | `server.ts:390`, `App.tsx:475`, `enterpriseService.ts:349`, `enterpriseSeed.ts:883`, `permissions.ts:145`, `enterprise.ts:374`, `server.ts:390` | ~2.500 linhas |
| **Agency Agents** | `da407fe` (fork) / `8ae6164` (upstream) | `tools.json`, `agency-categories.json`, `convert.sh:954`, `corpus-baseline/` (282 agents), `src-tauri/src/` (Rust) | ~1.500 linhas + 282 agents |
| **Paperclip** | `cb64a236b` | `server/src/index.ts`, `app.ts:1485`, `ui/src/App.tsx:887`, `packages/db/` (480 tabelas), `packages/adapters/*` (12) | ~3.000 linhas + 480 tabelas |

**Total de evidências rastreadas:** ~7.000 linhas de código + 282 agentes + 480 tabelas + 27 packages

---

*Documento consolidado com evidências reais de auditoria de código. Cada pendência tem evidência rastreável (`arquivo:linha` ou comando de busca). Pendências P0 bloqueiam início da implementação; P1 necessárias para MVP; P2 pós-MVP.*

## 9. Atualização da Fase 0 — 22/11/2026

### Commits publicados

- Agency Agents corpus: `4df40386ee1c09c3c5b569f08fe3f7f3f23afd53` — correção das referências do orquestrador, execução do builder/testes Hermes e teste de determinismo Antigravity conectado ao workflow.
- Agency Agents desktop app: `5757c807066db62c22fefbe7d2ca9e4a5c29c070` — `npm run build` incluído no PR Check.

### Evidência de GitHub Actions

As execuções criadas para os dois commits terminaram com `conclusion=failure`. Os endpoints de jobs retornaram `steps=[]` ou `steps=null`, com duração de aproximadamente três segundos; os logs não estavam disponíveis para recuperação. O mesmo padrão ocorreu após uma tentativa de reexecução. Portanto, não há evidência de que os comandos de build/test tenham começado, nem evidência de falha causada pelo código.

**Decisão:** Fase 0 parcialmente implementada, mas **não homologada**. A única condição impeditiva para encerramento é obter execução real e verde dos workflows. Não iniciar a Fase 1 antes disso.
