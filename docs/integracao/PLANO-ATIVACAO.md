# Diagnóstico Técnico e Plano de Ativação — TokenizAi

**Repositório:** `https://github.com/Tokenizaa/TokenizAi.git`  
**Branch:** `main`  
**SHA atual:** `bd4d19ad4b9509b2299325465e12c7f0f2c05b75`  
**Sincronizado com origin/main:** Sim  
**Data:** 22 de novembro de 2026

---

## 1. Matriz de funcionalidades existentes, incompletas, ausentes e não verificadas

| Domínio | Item | Estado | Evidência de código |
|---------|------|--------|---------------------|
| Identidade | `@nettoscorp/auth` (enums RBAC, ClearanceLevel, AuthorityLevel, UserRole, ModuleId) | Código existente, não conectado | `packages/auth/src/index.ts` |
| Identidade | Login, sessão, recuperação, encerramento | Ausente | Nenhuma rota de auth no `server.ts` |
| Persistência | `@nettoscorp/db` (schema Drizzle, 13 tabelas) | Código existente, não conectado | `packages/db/src/schema.ts` |
| Persistência | Supabase real conectado | Ausente | `.env` tem variáveis mas `server.ts` usa `/tmp/nettoscorp-tokenizai-db.json` |
| Segurança | RLS policies | Escrito na migration | `packages/db/migrations/0000_initial_schema.sql` |
| Segurança | JWT governança | Código existente, não conectado | `packages/authority-engine/src/jwt-governance.ts` |
| Agentes | `@nettoscorp/agent-hire` (hireAgent, RBAC, tool-provisioning, budget-binding) | Código existente, não conectado | `packages/agent-hire/src/` |
| Agentes | Paperclip integration | Ausente | Nenhuma chamada ao Paperclip no `server.ts` |
| Chat | `server.ts` tem `/api/ai/chatbot` com Gemini | Parcial (simulado, sem agente real) | `server.ts:1551` |
| Backend | `server.ts` (Express monolítico ~1.7k linhas) | Roda localmente, não deployado | `server.ts` |
| Frontend | Cloudflare Pages deploy ao vivo | Funcionando (estático) | `https://ca474cf7.tokenizai.pages.dev` |
| Observabilidade | Health check | Falso (supabase: false hardcoded) | `server.ts:205` |

---

## 4. Plano de execução (ordem obrigatória)

| Ordem | Fase | Entrega | Resultado | Status |
|-------|------|---------|-----------|--------|
| 1 | Fase 0 | Diagnóstico (este documento) | Matriz completa | ✅ Concluído |
| 2 | Fase 1 | Backend + Supabase + Autenticação | Usuário entra, dados persistidos | 🚧 Em execução |
| 3 | Fase 2 | Agency Agents + Paperclip | Agentes operacionais reais | ⏳ Pendente |
| 4 | Fase 3 | Chat persistente | Usuário conversa com agente real | ⏳ Pendente |
| 5 | Fase 4 | Organograma | Hierarquia controla operação | ⏳ Pendente |
| 6 | Fase 5 | Gestão empresarial | Departamentos administráveis | ⏳ Pendente |
| 7 | Fase 6 | Governança + auditoria | Eventos auditáveis | ⏳ Pendente |
| 8 | Fase 7 | Testes E2E + deploy | Plataforma homologada | ⏳ Pendente |

---

## 5. Fase 1 — O que foi implementado (código no disco)

| Arquivo | Função |
|---------|--------|
| `backend/package.json` | Dependências: express, @supabase/supabase-js, jsonwebtoken, zod, cors, dotenv |
| `backend/tsconfig.json` | TypeScript strict, target ES2022, module bundler |
| `backend/src/supabase.ts` | Cliente Supabase (anon key para usuário, service role para admin) |
| `backend/src/auth.ts` | Login, registro, logout, me, emissão de JWT, middleware authenticate, requireAuthority, requireRole |
| `backend/src/index.ts` | Express app, CORS, health check real (verifica Supabase), rotas /api/auth/*, /api/user/profile, /api/admin/metrics |
| `backend/.env.example` | Variáveis de ambiente obrigatórias |

**Rotas expostas pelo backend:**
- `GET /api/health` — status do Supabase e ambiente
- `POST /api/auth/login` — autentica via Supabase + emite JWT
- `POST /api/auth/register` — cadastra usuário no Supabase + emite JWT
- `POST /api/auth/logout` — encerra sessão (requer autenticação)
- `GET /api/auth/me` — retorna perfil do usuário autenticado (requer autenticação)
- `GET /api/user/profile` — perfil detalhado (requer autenticação)
- `GET /api/admin/metrics` — métricas administrativas (requer autoridade executiva_humana)

---

## 6. Regras de execução

- Não criar mais pacotes isolados sem integrá-los.
- Não manter dados demonstrativos como se fossem reais.
- Não considerar build bem-sucedido como prova de funcionamento.
- Primeira vitória concreta: autenticar usuário real, gravar no Supabase, consumir API do backend.

---

---

## 4. Regras de execução

- Não criar mais pacotes isolados sem integrá-los.
- Não manter dados demonstrativos como se fossem reais.
- Não considerar build bem-sucedido como prova de funcionamento.
- Primeira vitória concreta: autenticar usuário real, gravar no Supabase, consumir API do backend.

---