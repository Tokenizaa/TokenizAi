# Diagnóstico Técnico e Plano de Ativação — TokenizAi

**Repositório:** `https://github.com/Tokenizaa/TokenizAi.git`  
**Branch:** `main`  
**SHA atual:** `388759edf9f170b4385d2a663fe2454af38e7087`  
**Sincronizado com origin/main:** Sim  
**Data:** 22 de novembro de 2026

---

## 1. Matriz de funcionalidades — estado real no código

| Domínio | Item | Estado | Evidência de código |
|---------|------|--------|---------------------|
| Identidade | `@nettoscorp/auth` (enums RBAC, ClearanceLevel, AuthorityLevel, UserRole, ModuleId) | Código existente, não conectado | `packages/auth/src/index.ts` |
| Identidade | Login, registro, logout, sessão, JWT | Código existente no backend | `backend/src/auth.ts` |
| Persistência | `@nettoscorp/db` (schema Drizzle, 13 tabelas) | Código existente, não conectado ao Supabase real | `packages/db/src/schema.ts` |
| Persistência | Supabase real conectado | **Ausente** — credenciais não configuradas | `packages/db/migrations/0000_initial_schema.sql` |
| Segurança | RLS policies | Escrito na migration | `packages/db/migrations/0000_initial_schema.sql` |
| Segurança | JWT governança | Código existente no backend | `backend/src/auth.ts` |
| Agentes | `@nettoscorp/agent-hire` (hireAgent, RBAC, tool-provisioning, budget-binding, Paperclip) | Código existente, não conectado ao Paperclip real | `packages/agent-hire/src/` |
| Agentes | Paperclip integration | Código existente (PaperclipClient), não conectado | `packages/agent-hire/src/paperclip-client.ts` |
| Chat | `server.ts` tem `/api/ai/chatbot` com Gemini | Parcial (simulado, sem agente real) | `server.ts:1551` |
| Backend | `backend/src/index.ts` (Express, autenticação, health check) | Código existente, não rodando em produção | `backend/src/index.ts` |
| Frontend | Cloudflare Pages deploy ao vivo | Funcionando (estático) | `https://ca474cf7.tokenizai.pages.dev` |
| Observabilidade | Health check real | Implementado no backend | `backend/src/index.ts` |

---

## 2. Gaps críticos para uso real

| # | Gap | Impacto | O que fazer |
|---|-----|---------|-------------|
| 1 | **Backend não rodando em produção** | Sem backend, não há autenticação nem API | Fazer deploy do `backend/` em ambiente Node.js contínuo (Railway, Render, Fly.io, etc.) |
| 2 | **Supabase não conectado** | Sem persistência, sem RLS, sem autenticação real | Configurar `SUPABASE_URL` e `SUPABASE_ANON_KEY` reais; executar migrations |
| 3 | **Autenticação não funcionando** | Usuário não pode entrar | Login/register via `/api/auth/*` depende do Supabase |
| 4 | **Agentes não operacionais** | `hireAgent` não cria instância no Paperclip real | Configurar `PAPERCLIP_API_URL` e `PAPERCLIP_API_KEY`; rodar Paperclip server |
| 5 | **Frontend não consome backend** | Interface estática, sem ação real | Conectar frontend Cloudflare Pages à URL do backend |
| 6 | **Credenciais são placeholders** | `.env` tem valores truncados | Preencher credenciais reais no `backend/.env` |

---

## 3. Arquivos entregues (Fase 1 e Fase 2)

### Fase 1 — Infraestrutura (código pronto)

| Arquivo | Função |
|---------|--------|
| `backend/package.json` | Dependências: express (única dependência externa) |
| `backend/tsconfig.json` | TypeScript strict, target ES2022 |
| `backend/src/supabase.ts` | Cliente Supabase via `fetch` built-in (anon key + service role) |
| `backend/src/auth.ts` | Login, registro, logout, me, JWT HS256 via crypto built-in, middlewares authenticate/requireAuthority/requireRole |
| `backend/src/index.ts` | Express app, CORS manual, health check real, rotas `/api/auth/*`, `/api/user/profile`, `/api/admin/metrics`, middleware global de erros |
| `backend/.env.example` | Variáveis de ambiente obrigatórias |

**Rotas expostas:**
- `GET /api/health` — status do Supabase e ambiente
- `POST /api/auth/login` — autentica via Supabase + emite JWT
- `POST /api/auth/register` — cadastra usuário no Supabase + emite JWT
- `POST /api/auth/logout` — encerra sessão (requer autenticação)
- `GET /api/auth/me` — perfil do usuário (requer autenticação)
- `GET /api/user/profile` — perfil detalhado (requer autenticação)
- `GET /api/admin/metrics` — métricas admin (requer `executiva_humana`)

### Fase 2 — Agency Agents + Paperclip (código pronto)

| Arquivo | Função |
|---------|--------|
| `packages/agent-hire/src/hire-agent.ts` | `hireAgent(slug, options)` — fluxo completo: RBAC → corpus → division-mapping → frontmatter → validação Zod → tool-provisioning → budget-binding → criação no Paperclip |
| `packages/agent-hire/src/paperclip-client.ts` | `PaperclipClient` — `POST /api/agents` com `AgentConfigurationDocument`, validação de spec, health check |
| `packages/agent-hire/src/rbac-hire.ts` | `authorizeHire`/`enforceHireAction` — 6 papéis, matriz de grants, isolamento multi-tenant |
| `packages/agent-hire/src/corpus-client.ts` | `corpusGet(slug)` — fallback chain Paperclip → catalog-sync → HTTP |
| `packages/agent-hire/src/division-mapping.ts` | 21 divisões AA → papéis NettosCorp (config-driven) |
| `packages/agent-hire/src/frontmatter-extension.ts` | Bloco `nettoscorp` com precedência de merge |
| `packages/agent-hire/src/budget-binding.ts` | Vinculação de orçamento por autoridade |
| `packages/agent-hire/src/tool-provisioning.ts` | Provisionamento em 3+ runtimes ACP/MCP |
| `packages/agent-hire/src/types.ts` | Tipos de domínio (AgentConfig, HireOptions, PaperclipAgentResult, etc.) |
| `packages/agent-hire/src/index.ts` | Barrel de exports |

---

## 4. Plano de execução (ordem obrigatória)

| Ordem | Fase | Entrega | Resultado | Status |
|-------|------|---------|-----------|--------|
| 1 | Fase 0 | Diagnóstico (este documento) | Matriz completa | ✅ Concluído |
| 2 | Fase 1 | Backend + Supabase + Autenticação | Usuário entra, dados persistidos | 🚧 Código pronto, aguardando credenciais reais e deploy |
| 3 | Fase 2 | Agency Agents + Paperclip | Agentes operacionais reais | 🚧 Código pronto, aguardando credenciais reais e Paperclip server |
| 4 | Fase 3 | Chat persistente | Usuário conversa com agente real | ⏳ Pendente |
| 5 | Fase 4 | Organograma | Hierarquia controla operação | ⏳ Pendente |
| 6 | Fase 5 | Gestão empresarial | Departamentos administráveis | ⏳ Pendente |
| 7 | Fase 6 | Governança + auditoria | Eventos auditáveis | 🚧 Código parcial (packages existentes, não integrados) |
| 8 | Fase 7 | Testes E2E + deploy | Plataforma homologada | ⏳ Pendente |

---

## 5. Scripts criados para facilitar a ativação

| Script | Função |
|--------|--------|
| `scripts/init-supabase.sh` | Instruções para aplicar migrations no Supabase (SQL Editor ou psql) |
| `scripts/validate-backend.sh` | Testa se o backend está rodando e respondendo (health, auth rotas, etc.) |
| `supabase/migrations/0001_seed_initial_data.sql` | Dados iniciais: empresa, 10 roles, 18 departamentos, 12 skills |

---

## 6. Como colocar em uso real (próximos passos imediatos)

### Passo 1 — Configurar credenciais reais

Copie `backend/.env.example` para `backend/.env` e preencha:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key_real
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_real
JWT_SECRET=sua_chave_secreta_de_32_chars_minimo
JWT_ISSUER=tokenizai.local
JWT_AUDIENCE=tokenizai-app
PAPERCLIP_API_URL=https://api.paperclip.example.com/v1
PAPERCLIP_API_KEY=sua_chave_do_paperclip
PORT=3001
APP_URL=https://seu-backend.example.com
ENVIRONMENT=production
```

### Passo 2 — Aplicar migrations no Supabase

1. Acesse https://app.supabase.com
2. Vá em SQL Editor
3. Cole e execute: `packages/db/migrations/0000_initial_schema.sql`
4. Cole e execute: `supabase/migrations/0001_seed_initial_data.sql`
5. Crie o primeiro usuário admin via Auth > Users > Add user
6. Atualize o `owner_id` da empresa com o ID do usuário criado

### Passo 3 — Fazer deploy do backend

O backend precisa rodar em ambiente Node.js contínuo (não no Cloudflare Pages, que serve apenas estáticos):

```bash
cd backend
cp .env.example .env
# edite .env com credenciais reais
npx tsx src/index.ts
# ou faça deploy em Railway, Render, Fly.io, etc.
```

### Passo 4 — Conectar o frontend

No frontend (Cloudflare Pages), configure a variável de ambiente para apontar para a URL do backend e reconstrua o deploy.

### Passo 5 — Validar

```bash
./scripts/validate-backend.sh https://seu-backend.example.com
```

Deve retornar:
- `GET /api/health` → `{"status":"ok","integrations":{"supabase":true,...}}`
- `POST /api/auth/login` → JWT válido com credenciais corretas
- `GET /api/auth/me` (com token) → perfil do usuário

---

## 7. Regras de execução

- Não criar mais pacotes isolados sem integrá-los.
- Não manter dados demonstrativos como se fossem reais.
- Não considerar build bem-sucedido como prova de funcionamento.
- Primeira vitória concreta: autenticar usuário real, gravar no Supabase, consumir API do backend.

---
