# Especificação Técnica — Fase 8: Camada de Governança de Identidade

**Repositório:** TokenizAi / NettosCorp Enterprise  
**Pacote alvo:** `@nettoscorp/auth` (`packages/auth`)  
**Referência:** auditoria `AUDITORIA-FASES-1-8-REPORT.md` (Fase 8 classificada como parcial)  
**Entregável:** especificação técnica. Não é implementação de código.

---

## 1. Estado atual (fatos do repositório)

- `@nettoscorp/auth` expõe apenas tipos: enums `ClearanceLevel`, `PermissionLevel`, `AuthorityLevel`, `UserRole`, `ModuleId`, mais mapeamentos estáticos (`ROLE_DEFAULT_AUTHORITY`, `MODULE_PERMISSIONS`) e interfaces (`UserClearance`, `ModulePermissionsStruct`, `RoleAuthority`). Não há issuance de token, sessão, refresh, middleware de autorização, nem valores reais de ambiente.
- `@nettoscorp/db` (Drizzle) modela `companies`, `users`, `roles`, `memberships` (usuário ↔ empresa via `company_id`, `roleId`, `status`). A tabela `users` **não** tem `company_id`: o tenant do usuário só existe através de `memberships`. Não há tabela de sessões nem de refresh tokens.
- Supabase tem 3 migrations: hardening RLS (remove políticas públicas das 3 tabelas `agency_agent_*`), restrição da função `SECURITY DEFINER rls_auto_enable()`, e criação de `public.company_memberships` vinculando `auth.users` do Supabase Auth a `companies`, com RLS habilitada e política única `select_self` (`user_id = auth.uid()`). Não há políticas por `company_id` nas demais tabelas.
- `.env.example` contém apenas `GEMINI_API_KEY` e `APP_URL`. Não há `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` nem `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`.

**Conclusão:** os enums são contrato de tipo, não autorização. A Fase 8 não está implementada em produção.

---

## 2. Estrutura dos claims do JWT (access token e ID token)

O JWT carrega **identificadores, não segredos nem PII desnecessária**. Claims mínimos, issuer e audiência pinados, `alg` em allowlist (`RS256`; `none` proibido). O `company_id` (tenant) vem exclusivamente do contexto autenticado (membership ativa na empresa), nunca de parâmetros de request.

### 2.1 Tabela de claims

| Claim | Tipo | Obrigatório | Semântica |
|-------|------|-------------|-----------|
| `iss` | string | Sim | Issuer do servidor de auth (Better Auth / Supabase Auth), pinado na verificação |
| `aud` | string | Sim | Audiência (client_id da aplicação), pinado |
| `sub` | UUID | Sim | Identificador do usuário autenticado (`users.id` / `auth.uid()`) |
| `jti` | UUID | Sim | Identificador único do token; usado para revogação e detecção de replay |
| `iat`, `exp`, `nbf` | timestamp | Sim | Emissão, expiração e não-antes-de; access token curto (≤ 15 min) |
| `email` | string | Não | E-mail verificado apenas quando confirmado |
| `email_verified` | boolean | Não | Status de verificação do e-mail |
| `company_id` | UUID | Sim | Tenant da sessão; fonte: membership ativa do usuário na empresa |
| `company_slug` | string | Não | Slug da empresa para uso em URLs/redirecionamentos internos |
| `role` | string (`UserRole`) | Sim | Papel primário do usuário dentro da empresa (da membership/role ativa) |
| `roles` | string[] | Sim | Todos os papéis do usuário na empresa (permitir mudança de contexto sem novo login) |
| `authority_level` | `AuthorityLevel` | Sim | Nível de autoridade derivado do papel (mapa `ROLE_DEFAULT_AUTHORITY`) |
| `clearance_level` | `ClearanceLevel` | Sim | Nível de sigilo máximo autorizado, derivado do papel + contexto da empresa |
| `modules` | Record<`ModuleId`, `PermissionLevel`> | Não | Grants de módulo para a empresa (`LER` < `ESCREVER` < `GERENCIAR` < `ADMIN`) |
| `session_id` | UUID | Não | Identificador da sessão server-side; usada para revogação instantânea |
| `auth_method` | string | Não | Método de autenticação (`password`, `sso`, `passkey`) |
| `amr` | string[] | Não | Métodos de autenticação usados (para step-up / MFA) |
| `acr` | string | Não | Nível de confiança da autenticação (para step-up em ações sensíveis) |

### 2.2 Exemplo de claims (access token)

```json
{
  "iss": "https://auth.tokenizai.example.com",
  "aud": "tokenizai-app",
  "sub": "a1b2c3d4-...",
  "jti": "e5f6...",
  "iat": 1763700000,
  "exp": 1763700900,
  "email": "usuario@empresa.example.com",
  "email_verified": true,
  "company_id": "9f0e1234-...",
  "company_slug": "nettoscorp",
  "role": "gestor",
  "roles": ["gestor", "financeiro"],
  "authority_level": "gerencial",
  "clearance_level": "restrito",
  "modules": {
    "finance": "gerenciar",
    "projects": "escrever",
    "chat": "ler",
    "admin": "ler"
  },
  "session_id": "7g8h9i...",
  "auth_method": "passkey",
  "amr": ["pwd", "webauthn"],
  "acr": "2"
}
```

### 2.3 Regras de derivação e uso

- `UserRole` → `AuthorityLevel`: mapa estático `ROLE_DEFAULT_AUTHORITY` como baseline; override possível por membership/role da empresa.
- `PermissionLevel` por módulo: `MODULE_PERMISSIONS` como baseline de defaults; grants efetivos vem da tabela de permissões da empresa (ainda a criar).
- `ClearanceLevel` não é campo livre: deriva da combinação papel + sensibilidade do recurso acessado; nunca confiado cegamente do client.
- Toda decisão de autorização server-side lê `company_id`, `role` e `modules` do token (ou do contexto derivado dele) e impõe via RLS + verificação de aplicação. UI esconder opções não é controle de segurança.

---

## 3. Renovação automática de tokens — Better Auth + Supabase

Better Auth já consta como `peerDependency` de `@nettoscorp/auth`. A arquitetura abaixo pressupõe Better Auth gerenciando sessão e refresh, com Supabase como fonte de dados e camada RLS.

### 3.1 Modelos de token

| Token | TTL | Formato | Armazenamento client | Propósito |
|-------|-----|---------|----------------------|-----------|
| Access token | ≤ 15 min | JWT (assinado RS256) | Memória / variável de estado do client; nunca `localStorage` | Acesso a APIs e validação de RLS na borda |
| Refresh token | dias (configurável por tenant) | Opcional, aleatório (opaco) | Cookie `HttpOnly; Secure; SameSite=Lax` | Renovação silenciosa do access token |
| Sessão server-side | sliding (configurável) | Linha em tabela de sessões (Better Auth) | Server-side (DB) | Revogação instantânea e rastreamento |

### 3.2 Fluxo de renovação automática

1. Client acessa API com o access token no `Authorization: Bearer`.
2. Quando o token expira (ou antecipadamente, por renovação deslizante do client Better Auth), o client recebe `401` ou dispara renovação proativa.
3. Client envia o **refresh token cookie** (automático, não acessível via JS) para o endpoint de renovação do Better Auth.
4. Better Auth valida o refresh token na tabela de sessões, detecta uso (rotação):
   - Invalida o refresh token anterior.
   - Emite novo access token e novo refresh token (novo cookie).
   - Se o mesmo refresh token for apresentado duas vezes (reuse = possível roubo), revoga toda a família de tokens da sessão, invalida a sessão, levanta alerta de auditoria e invalida o `jti` do access token circulante.
5. Client recebe novo access token e repete a requisição original automaticamente. O usuário não é redirecionado ao login.

### 3.3 Papel do Supabase nesta arquitetura

- **Identidade:** `auth.users` do Supabase Auth como âncora de identidade (ou tabela própria do Better Auth; decidir na implementação, não duplicar identidades).
- **Aplicação:** cliente Supabase com `SUPABASE_ANON_KEY` carrega o access token do usuário; o Postgres aplica RLS com `company_id` vinculado ao `auth.uid()` via `company_memberships`.
- **Operações privilegiadas:** `SUPABASE_SERVICE_ROLE_KEY` usado exclusivamente pelo backend/server para: issuance de claims, leitura de perfil/permissões, break-glass, e bind transacional de `app.company_id`. Nunca exposto ao client. Nunca usado por conexão que sirva request de usuário final sem contexto de tenant definido.
- **Contexto de tenant no Postgres:** no início de cada request autenticado, o backend executa `SELECT set_config('app.company_id', :company_id, true)` (transaction-local). Todas as queries da request herdam o tenant. Pool de conexão não vaza tenant entre requests graças ao `true`.

### 3.4 Revogação

- Logout / revogação de sessão: deleção da linha de sessão (Better Auth) + invalidação do `jti` (denylist curto, TTL do access token).
- Desativação de usuário (membership `suspended` ou SCIM offboarding): revogar todas as sessões e tokens da empresa/usuário em ≤ 60 s (critério da Fase 8).
- Senha/MFA alterada: revogar famílias de refresh de todos os dispositivos exceto o atual (step-up recomendado).

---

## 4. Políticas RLS no Supabase — multi-tenancy por `company_id`

**Princípio:** isolamento de tenant é propriedade da camada de dados, não de disciplina do desenvolvedor. Toda request roda com `company_id` vinculado ao contexto autenticado; políticas recusam tudo que não bater.

### 4.1 Application role

- Criar papel de aplicação restrito (ex: `app_request_user`) sem superuser e sem `BYPASSRLS`.
- Conexões que servem requests de usuário final usam este papel.
- `service_role` (ou papel equivalente) usado apenas por backend/break-glass, com auditoria obrigatória; nunca em conexão de request-serving de usuário final.

### 4.2 Bind transacional do tenant

No início de cada transação/request autenticado:

```sql
SELECT set_config('app.company_id', CAST(:authenticated_company_id AS text), true);
```

- O terceiro parâmetro `true` torna o contexto transaction-local: ao `COMMIT`/`ROLLBACK` o contexto some, impedindo vazamento de tenant entre requests via pool de conexão.
- `company_id` vem do `sub` do token através de `company_memberships` (fonte de verdade), nunca de parâmetro de query/body/header do client.

### 4.3 Política padrão (tenant-scoped)

Habilitar RLS e forçar em **todas** tabelas tenant-scoped:

```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON <tabela>
  FOR ALL
  TO app_request_user
  USING (company_id = current_setting('app.company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.company_id', true)::uuid);
```

- `FORCE` sujeia também o owner da tabela à RLS.
- Revogar todos os privilégios de `anon`, `authenticated` e `PUBLIC` nas tabelas sensíveis; conceder apenas ao papel da aplicação.
- Usar `security_invoker` views onde disponível; evitar `SECURITY DEFINER` em funções chamadas por requests (conforme migration existente que restringe `rls_auto_enable()`).

### 4.4 Tabelas e políticas específicas

| Tabela | Chave de tenant | Política de leitura | Política de gravação |
|--------|----------------|---------------------|----------------------|
| `companies` | `id` | Somente membros da empresa | Apenas admin da empresa / serviço |
| `users` (profiles) | via `memberships.company_id` | Membros da empresa | Próprio perfil (restrito) + admin |
| `memberships` | `company_id` | `user_id = auth.uid()` (self) + admin da empresa | Admin da empresa / serviço de provisioning |
| `projects` | `company_id` (via `linked_account_id`) | Membros da empresa | Membros com `gerenciar` no módulo `projects` |
| `project_tasks` | `company_id` (herdado do projeto) | Membros da empresa | Membros da empresa |
| `agents`, `departments`, `positions`, `governance_records` | `company_id` (ou herdado) | Membros da empresa | Papéis com grant no módulo correspondente |
| `company_memberships` (existente) | `company_id` | `user_id = auth.uid()` (política `select_self` já existe) | Admin da empresa / serviço |

### 4.5 Recursos de usuário não tenant-scoped

Recursos estritamente pessoais (ex: sessão própria, prefs) usam `user_id = auth.uid()`; não precisam de `company_id`, mas continuam sob RLS.

### 4.6 O que já existe e o que falta

- Existe: `company_memberships` com RLS + `select_self`; revogação de políticas públicas das tabelas `agency_agent_*`; restrição de `rls_auto_enable()`.
- Falta: RLS nas 13 tabelas do schema Drizzle (`companies`, `users`, `roles`, `memberships`, `projects`, `project_tasks`, `agents`, `departments`, `positions`, `skills`, `governance_records`, etc.); papel de aplicação restrito; bind `set_config('app.company_id', ...)` no backend; políticas `WITH CHECK` para gravação; auditoria de alterações de política.

---

## 5. Gap: do enums TypeScript à autorização real em produção

Itens ausentes, com o que cada um exige para ficar pronto:

| # | Item | O que falta | Critério de aceitação |
|---|------|-------------|-----------------------|
| 1 | Valores reais de ambiente | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` ausentes de `.env.example` | `.env.example` documenta todas as variáveis; valores reais injetados em produção sem commit no git |
| 2 | Implementação de auth real | Configurar Better Auth (providers, callbacks, secret), tabelas de sessão/refresh no DB | Login, callback e logout funcionam sem inventar token format |
| 3 | Issuance de claims nos enums | Mapear `UserRole` → `AuthorityLevel`, derivar `ClearanceLevel`, montar `modules` por empresa e assinar JWT com os claims da seção 2 | Todo access token contém `iss`, `aud`, `sub`, `jti`, `company_id`, `role`, `authority_level`, `clearance_level` |
| 4 | Middleware de autorização server-side | Verificação de token e permissão em **toda** rota API; UI não é controle | Nenhuma rota acessível sem token válido e grant de módulo |
| 5 | RLS completa por `company_id` | Políticas `USING`/`WITH CHECK` em todas as tabelas tenant-scoped; papel restrito; bind `app.company_id` | Teste automatizado cross-tenant tenta acessar dado de outra empresa e recebe `403`/vazio |
| 6 | Renovação e rotação de refresh | Refresh token rotativo, detecção de reuse, revogação de família + alerta | Refresh roubado apresentado duas vezes revoga toda a família |
| 7 | Revogação instantânea | Delete de sessão + denylist de `jti` | Logout/desativação invalida access tokens circulantes dentro do TTL |
| 8 | Audit trail de eventos de auth | Log estruturado de login, falha, lockout, reset, concessão/remoção de permissão, alteração de SSO | Todo evento de auth gravado com quem, de onde, após quantas tentativas; user vê apenas "credenciais inválidas" |
| 9 | Conta-recovery e reset de senha/MFA | Tokens single-use, time-limited, sem enumeração de usuário, step-up para mudanças sensíveis | Redefinição de senha não revela se e-mail existe |
| 10 | Rate limiting / anti-credential stuffing | Limite progressivo por IP/dispositivo, bloqueio temporário | Ataque de força bruta é barrado antes de travar conta legítima |
| 11 | Step-up authentication | `acr`/`amr`, `max_age` para ações sensíveis (financeiro, admin, gestão de usuários) | Ação sensível exige reautenticação recente |
| 12 | Break-glass org-admin | Caminho de recuperação quando IdP/SSO está down, auditado | Acesso de emergência funciona e gera evento de auditoria |
| 13 | Testes de falha | Cross-tenant, replay de `jti`/refresh, `alg` confusion, manipulação de redirect, fixation de sessão | Suite automatizada cobre todos os caminhos de falha da seção 8 do IAE |
| 14 | Threat model documentado | Documento de ameaças da camada de identidade (ATAQUE → controles) | Threat model revisado e aprovado antes do go-live |
| 15 | SCIM / offboarding (empresa) | Provisioning e deprovisioning via SCIM; `active=false` revoga sessões ≤ 60 s | Deprovisionamento encerra acesso em menos de um minuto |

---

## 6. Princípios obrigatórios (não negociáveis, padrão Identity & Access Engineer)

1. **Não inventar primitivos de auth.** Nenhum formato de token customizado, hash de senha caseiro ou OAuth "simplificado". Authorization code + PKCE, Argon2id/bcrypt via bibliotecas auditadas, padrões chatos.
2. **O client nunca é autoridade.** Toda verificação de permissão roda server-side em cada request. Esconder no UX é UX, não segurança.
3. **Validar redirecionamentos como se um atacante estivesse observando.** Allowlist de exata correspondência de redirect URI; `state` verificado em todo callback; `nonce` bound ao ID token. Open redirect perto de endpoints de auth é tomada de conta de conta.
4. **Acesso curto, refresh rotativo.** Access tokens duram minutos, não dias. Refresh rotaciona a cada uso; refresh reutilizado (roubado) revoga a família inteira e levanta alerta.
5. **Isolamento de tenant é propriedade da camada de dados.** `company_id` vem do contexto autenticado, nunca de parâmetros de request; aplicado por escopo de consulta ou RLS, nunca por disciplina do desenvolvedor.
6. **JWTs carregam identificadores, não segredos ou PII.** `alg` em allowlist (`none` é ataque, não opção); issuer e audiência pinados; claims mínimos — JWT é legível por quem o detém.
7. **Recovery projetada com tanto cuidado quanto login.** Reset de senha e MFA: tokens de uso único e tempo limitado, sem enumeração de usuário, step-up para mudanças sensíveis.
8. **Log de todo evento de auth, exponha nenhum motivo.** Usuário vê "credenciais inválidas"; o audit log vê qual credencial falhou, de onde, após quantas tentativas. Bloqueios, resets, mudanças de SSO e concessões de permissão são eventos auditáveis.

---

## 7. Próximo passo concreto

Converter esta especificação em um plano de implementação com as migrations de RLS das tabelas restantes, configuração do Better Auth, middleware de autorização e a suíte de testes de falha, antes de qualquer go-live da Fase 8.
