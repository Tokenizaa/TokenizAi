# Plano de Refatoração — Fase 5: Module Architecture

**Repositório:** `@nettoscorp/tokenizai`
**Base:** `server.ts` monolítico (~1.741 linhas, ~68 KB), estado em memória JSON, handlers inline por domínio.
**Alvo:** `createApp({ modules })` com carregamento dinâmico de módulos, interface `Module { routes, services, ui, migrations, config }`.
**Estratégia:** Strangler Fig — `server.ts` segue rodando; novo app é montado módulo a módulo; feature flag `MODULES_ENABLED` alterna; `server.legacy.ts` como rollback.

---

## Artefatos criados neste pacote

| Caminho | Conteúdo |
|---------|----------|
| `packages/kernel/` | `@nettoscorp/kernel`: `Module` interface, `DiContainer`, `SimpleEventBus`, `ModuleLoader` (topológico) |
| `app.ts` | Fábrica `createApp({ modules })`: middleware global, DI, montagem de rotas por prefixo, health agregado |
| `modules/registry.ts` | Catálogo dos 18 módulos com id e caminho do `module.ts` |
| `modules/gateway/module.ts` | Exemplo: health, SSE, bootstrap, reset (extraído do `server.ts`) |
| `modules/chat/module.ts` | Exemplo: rotas, serviços DI, UI lazy, health |
| `docs/adr/ADR-004.md` … `ADR-010.md` | ADRs de decisões arquiteturais (7 novos + índice) |
| `docs/adr/README.md` | Índice de todos os 10 ADRs (01–03 já aprovados) |

---

## Estrutura de pastas alvo (Fase 5)

```
tokenizai/
├── app.ts                      # createApp({ modules }) — entrypoint da nova app
├── server.ts                   # mantido como legacy durante transição (feature flag)
├── server.legacy.ts            # cópia do server.ts atual (rollback imediato)
├── modules/                    # UM diretório por domínio de negócio
│   ├── registry.ts             # catálogo id -> caminho do module.ts
│   ├── gateway/                # core: health, SSE, bootstrap, reset
│   │   ├── module.ts           # export default Module
│   │   ├── routes/             # adaptadores Express (handlers finos)
│   │   ├── services/           # use cases (regras de negócio)
│   │   ├── domain/             # entidades/value objects (puro, sem framework)
│   │   ├── migrations/         # up/down ou SQL bruto deste módulo
│   │   ├── config/             # schema de config, env defaults, feature flags
│   │   └── ui/                 # componentes React lazy (frontend)
│   ├── chat/                   # conversas, mensagens, diálogo inter-agente
│   ├── org/                    # departamentos, posições, organograma
│   ├── tasks/                  # tarefas, delegação
│   ├── runtime/                # agentes operacionais, heartbeat, ACL Paperclip
│   ├── projects/               # projetos, gates NEXUS
│   ├── finance/                # centros de custo, orçamentos
│   ├── commercial/             # oportunidades, pipeline
│   ├── marketing/              # campanhas
│   ├── products/               # catálogo de produtos/serviços
│   ├── customers/              # contas, contatos
│   ├── people/                 # organograma de pessoas, capacidade
│   ├── operations/             # execuções operacionais
│   ├── agency-library/         # catálogo de agentes, contratação (Fase 7)
│   ├── team-composer/          # composição de times
│   ├── operational-agents/     # instâncias operacionais
│   ├── governance/             # autoridade, policy, auditoria (Fase 8)
│   └── admin/                  # usuários, sistema
├── packages/
│   ├── shared/                 (@nettoscorp/shared)  — tipos, schemas, constantes, utils (Fase 1)
│   ├── db/                     (@nettoscorp/db)      — schema Drizzle, migrations base (Fase 1)
│   ├── auth/                   (@nettoscorp/auth)    — RBAC, ModuleId, permissoes (Fase 1)
│   ├── kernel/                 (@nettoscorp/kernel)  — contrato Module, DI, event bus, loader (NOVO)
│   ├── ui-primitives/          (@nettoscorp/ui-primitives) — (Fase 4)
│   ├── design-tokens/          (@nettoscorp/design-tokens) — (Fase 4)
│   ├── frontend-query/         (@nettoscorp/frontend-query) — (Fase 4)
│   ├── plugin-sdk/             (@nettoscorp/plugin-sdk) v2 — (Fase 3)
│   ├── adapter-*/              (@nettoscorp/adapter-*) — (Fase 2)
│   └── mcp-server/             (@nettoscorp/mcp-server) — (Fase 2)
├── supabase/migrations/        # migrações SQL versionadas (PostgreSQL + RLS)
├── docs/adr/                   # ADR-001.md … ADR-010.md + README.md
├── package.json                (packages:build inclui @nettoscorp/kernel)
├── pnpm-workspace.yaml         (já cobre packages/*)
├── tsconfig.json / vite.config.ts
└── .env / .env.example         (SUPABASE_URL, PAPERCLIP_ENDPOINT, etc. reais)
```

---

## Passos de execução (ordem recomendada)

### Passo 1 — Fundação do kernel (esta entrega)
- [x] Criar `@nettoscorp/kernel` com `Module`, `DiContainer`, `SimpleEventBus`, `ModuleLoader`.
- [x] Criar `app.ts` com `createApp({ modules })`.
- [x] Criar `modules/registry.ts` + módulos exemplo `gateway` e `chat`.
- [x] Criar ADRs 04–10 e índice.
- [ ] Adicionar `@nettoscorp/kernel` ao script `packages:build` do root `package.json` (feito).
- [ ] Instalar `tsup` (`pnpm add -D tsup@^8 -w`) para build do kernel.

### Passo 2 — Extrair gateway (bloco inicial do `server.ts`)
- [ ] Mover `/api/health`, `/api/events/stream`, `/api/bootstrap`, `/api/state/reset` para `modules/gateway/routes/*.ts`.
- [ ] Mover `sseClients`, `broadcastEvent`, `appendServerAudit`, `makeAuditHash` para `modules/gateway/services/` + event bus do kernel.
- [ ] Manter `server.ts` rodando; `createApp` monta apenas `gateway` inicialmente.

### Passo 3 — Extrair domínios um a um (Strangler Fig)
Para cada domínio (chat, org, tasks, runtime, projects, finance, …):
1. Criar `modules/<id>/module.ts` com `routes`, `services`, `migrations`, `ui`, `config`.
2. Extrair handlers inline de `server.ts` para `modules/<id>/routes/*.ts` (adaptadores Express finos).
3. Extrair lógica de negócio para `modules/<id>/services/*.ts` (use cases) e entidades para `domain/*.ts` — sem imports de Express/Drizzle (ADR-006).
4. Adicionar migrations em `modules/<id>/migrations/`.
5. Registrar o módulo em `modules/registry.ts` e passar para `createApp({ modules })`.
6. Ligar o módulo via feature flag `MODULES_ENABLED=<id>`; validar health e rotas.

### Passo 4 — Persistência (bloqueador de produção)
- [ ] Conectar PostgreSQL/Supabase (`Drizzle` + `postgres` driver).
- [ ] Migrar estado do JSON em `/tmp` para tabelas por módulo (script one-off).
- [ ] Ativar RLS + `company_id` + middleware de tenant (ADR-007).
- [ ] Fail no build se houver drift entre schema Drizzle e migrations (ADR-009).

### Passo 5 — Remoção do monolito
- [ ] Quando todos os domínios estiverem em módulos e validados, remover `server.ts` e `server.legacy.ts`.
- [ ] `app.ts` + `createApp` tornam-se o único entrypoint; `npm start` → `tsx app.ts`.
- [ ] Atualizar `package.json` scripts (`dev`/`start` apontam para `app.ts`).

### Passo 6 — Governança (Fase 8, depende da Fase 5)
- [ ] Implementar `modules/governance/` com Authority Engine, Policy Engine (OPA/Rego), Approval Gateway, Audit Trail imutável (ADR-008).

---

## Critérios de aceitação (Definition of Done da Fase 5)

- [ ] `createApp({ modules })` sobe e responde `/api/health` com status de cada módulo.
- [ ] Cada módulo exporta default conformando à interface `Module` (valida pelo `ModuleLoader`).
- [ ] Rotas de cada módulo montadas sob seu `routePrefix` sem editar `app.ts`.
- [ ] Migrações de cada módulo executadas em ordem topológica de dependências.
- [ ] Carregamento dinâmico via `import()` funciona em dev (`tsx`) e os módulos buildam com `tsup`.
- [ ] Nenhuma regra de negócio importa Express/Drizzle/GenAI (ADR-006 verificado por lint/review).
- [ ] Rollback testado: feature flag desliga os novos módulos e `server.legacy.ts` responde.
- [ ] ADRs 04–10 aprovados pelo Founder.

---

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Dupla manutenção (monolito + novo app) durante transição | Limitar janela; definir data de remoção do `server.ts` no roadmap |
| Estado em JSON não é transacional | Bloquear produção até PostgreSQL + RLS (Passo 4) |
| Módulo com falha derruba servidor ao carregar | `try/catch` no `ModuleLoader.load`; módulo com falha é desabilitado, não derruba o app |
| Import "por fora" das camadas (quebra ADR-006) | Code review + regra de lint: `domain/` e `services/` não importam `express`/`drizzle-orm` |
| Migrações de módulos em ordem errada | Loader ordena topologicamente; erro explícito em dependência circular |
