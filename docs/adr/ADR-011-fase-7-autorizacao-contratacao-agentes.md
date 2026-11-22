# ADR-011 — Fase 7: Camada de Autorização para Contratação de Agentes

**Status:** proposta (especificação técnica)  
**Autor:** Identity & Access Engineer  
**Aplica-se a:** fluxo de contratação de agentes (`hireAgent`)  
**Formato:** especificação, não código de implementação

---

## 1. Contexto

A Fase 7 introduz a contratação de agentes autônomos dentro de empresas (tenants) cadastradas na plataforma. A camada de autorização deve responder a três perguntas em cada requisição:

1. Quem está requisitando a contratação e com quais poderes (claims do JWT)?
2. Esse ator pode contratar o papel/nível de sigilo solicitado (RBAC)?
3. Os dados gravados/consultados pertencem ao tenant autenticado (isolamento multi-tenant via RLS)?

Padrão adotado: padrões chatos e verificáveis (OIDC, RLS do PostgreSQL, refresh-token rotativo). Nada de formatos de token proprietários, hash caseiro ou autorização apenas na UI.

---

## 2. Claims JWT do agente contratado

### 2.1 Claims estruturadas do access token

Todo access token emitido para um agente contratado deve conter as seguintes claims estruturadas:

| Claim | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `sub` | string (UUID) | Sim | Identificador do agente (subject). Nunca PII. |
| `company_id` | string (UUID) | Sim | Tenant — empresa contratante. Fonte da verdade para isolamento de dados. |
| `role` | string | Sim | Papel RBAC do agente (ex: `agent.researcher`, `agent.analyst`, `agent.reviewer`). |
| `department` | string[] | Sim | Departamento(s) a que o agente pertence. |
| `clearance` | enum | Sim | Nível de sigilo máximo do agente. Valores: `publico`, `interno`, `confidencial`, `secreto`, `top_secret` (ordem crescente). |
| `authority` | enum[] | Sim | Autoridades de decisão do agente. Valores: `none`, `read`, `write`, `approve`, `execute`, `admin`. |
| `knowledge_domains` | string[] | Sim | IDs de domínios de conhecimento (catálogo) aos quais o agente tem acesso. |
| `iat`, `exp`, `jti`, `iss`, `aud` | padrão OIDC | Sim | Emissão, expiração, ID único, emissor, audiência. |

### 2.2 Regras de emissão dos tokens

- `alg` fixo `RS256` via allowlist; `none` é rejeitado (não é opção).
- `iss` = emissor do tenant; `aud` = `client_id` do serviço de agentes.
- Access token: JWT de curta duração, `exp` ≤ 15 minutos.
- Refresh token: opaco, armazenado somente do lado do servidor (hash), não exposto ao cliente.
- JWT carrega identificadores, não segredos nem PII.
- `jti` único por token, usado para revogação pontual e detecção de replay.

### 2.3 Renovação de tokens

- Renovação só via refresh token rotativo.
- Rotação a cada uso: novo refresh token invalida o anterior.
- Reutilização (roubo) de refresh token ⇒ revogação de toda a família de tokens do agente + evento de auditoria `token_family_revoked` + alerta de segurança.
- TTL absoluto do refresh token: 7 dias. Sem sliding indefinido.
- Revogação imediata na desativação do agente (hire revogado ou provisionamento desativado): todos os refresh tokens e sessões do agente na `company_id` são revogados em ≤ 60 segundos.
- Logout/invalidação: denylist de `jti` com TTL igual ao tempo restante do access token.

---

## 3. RBAC para a ação hireAgent

### 3.1 Papéis de contratação (quem contrata)

| Papel | Solicitar contratação | Aprovar contratação | Provisionar (executar hire) | Limite de clearance | Escopo de department |
|-------|----------------------|---------------------|-----------------------------|---------------------|----------------------|
| `recruiter` | ✅ | ❌ | ❌ | ≤ `confidencial` | próprio department |
| `hiring_manager` | ✅ | ✅ (próprio dept) | ❌ | ≤ `secreto` | próprio department |
| `department_head` | ✅ | ✅ (próprio dept) | ❌ | ≤ `top_secret` | próprio department |
| `security_officer` | ❌ | ✅ (gate de clearance) | ❌ | qualquer | cross-department (apenas aprovação de clearance) |
| `company_admin` | ✅ | ✅ | ✅ | qualquer | qualquer department da `company_id` |
| `platform_admin` | ✅ | ✅ | ✅ | qualquer | cross-tenant (break-glass, auditado) |

### 3.2 Matriz de decisão de hireAgent

`hireAgent(agent_role, clearance, department, company_id)` é decidida da seguinte forma:

**Pré-condições do solicitante:**
- Possui papel com permissão `hire.request` ativo na `company_id` autenticada (o tenant vem do JWT, nunca de parâmetro de requisição).
- Se o departamento do agente alvo for diferente do do solicitante, exige aprovação do `department_head` do departamento alvo.

**Gate de clearance:**
- A `clearance` do agente contratado **não pode exceder** a `clearance` do aprovador da contratação.
- Exemplo: solicitante com clearance `interno` não contrata agente `secreto`, nem com aprovação de `hiring_manager` com clearance igual ou inferior.

**Separação de funções (SoD):**
- Quem solicita não aprova a mesma contratação.
- Quem aprova não provisiona (exceção: `company_admin` e `platform_admin` em modo break-glass, com evento de auditoria obrigatório).

**Isolamento de tenant:**
- A contratação só é gravada dentro da `company_id` do contexto autenticado. Nunca há parâmetro de request que aceite `company_id` do cliente.

### 3.3 Exemplos de decisão (especificação de comportamento)

| Cenário | Solicitante | Alvo | Decisão | Justificativa |
|---------|-------------|------|---------|---------------|
| A | `recruiter` (clearance `confidencial`, dept `Pesquisa`) | `agent.researcher`, `confidencial`, dept `Pesquisa` | ✅ Permitido | clearance compatível, mesmo department, papel com `hire.request`. |
| B | `recruiter` (clearance `interno`) | `agent.analyst`, `secreto`, dept `Pesquisa` | ❌ Negado | clearance do alvo excede a do solicitante. |
| C | `hiring_manager` (dept `Pesquisa`) | `agent.reviewer`, `interno`, dept `Jurídico` | ⚠️ Condicional | requer aprovação do `department_head` de `Jurídico`. |
| D | `security_officer` | qualquer role, clearance `top_secret`, qualquer dept | ✅ Aprovação de clearance | papel detém gate de clearance cross-department. |
| E | `company_admin` Empresa A | agente na Empresa B | ❌ Negado | isolamento de tenant (`company_id` do contexto ≠ alvo). |

---

## 4. Multi-tenancy: isolamento por company_id via RLS

### 4.1 Princípio

`company_id` é o identificador de tenant. O tenant ID provém **exclusivamente** do contexto autenticado (claim `company_id` do JWT). Nunca de query params, body ou headers da requisição. O isolamento é imposto pelo banco de dados (Row Level Security), não por disciplina do desenvolvedor.

### 4.2 Objetos protegidos

Tabelas que devem ter RLS habilitado e policies de tenant:
- `agents`
- `agent_hires`
- `hiring_approvals`
- `job_openings`
- `sessions`
- `refresh_tokens`
- `audit_events`
- Qualquer tabela que armazene dados pertencentes a uma empresa.

### 4.3 Especificação do mecanismo RLS (PostgreSQL)

1. Criar role de aplicação restrita, sem privilégios de superusuário e sem `BYPASSRLS`, usada apenas pelas conexões que atendem requisições.
2. Habilitar RLS em cada tabela protegida:
   - `ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;`
   - `ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;` (o owner da tabela também fica sujeito à RLS).
3. Criar policy de isolamento em cada tabela:

```sql
CREATE POLICY tenant_isolation ON <tabela>
  USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
```

4. Vincular o tenant ao início de cada transação de request:

```sql
BEGIN;
SELECT set_config('app.company_id', CAST(:authenticated_company_id AS text), true);
-- consultas/escritas da requisição aqui
COMMIT;
```

- O terceiro parâmetro `true` torna o contexto transacional-local: reuso de connection pool não carrega o tenant de uma request para a próxima.
- Contexto ausente ⇒ a política `USING` é falsa ⇒ acesso negado por padrão.

### 4.4 Regras de segurança do RLS

- Nenhuma conexão que atende requisições usa `BYPASSRLS` nem roles de manutenção privilegiada.
- Caminho de request sem funções `SECURITY DEFINER`; views usam `security_invoker` quando suportado.
- Break-glass: role `platform_admin` com `BYPASSRLS` restrito a conexões dedicadas, operações rastreáveis e auditadas. Nunca em conexões de request comuns.

---

## 5. Auditoria de eventos de identidade (obrigatório)

Cada evento de contratação e token deve gerar um evento de auditoria estruturado, gravado do lado do servidor. Eventos mínimos:

- `hire.requested`, `hire.approved`, `hire.provisioned`, `hire.revoked`
- `clearance_changed`, `role_changed`, `department_changed`
- `token_issued`, `token_refresh`, `token_family_revoked`, `token_revoked_on_deprovision`
- `cross_tenant_denied` (tentativa de acesso a dados de outra `company_id`)

Cada evento grava: ator (`sub`), `company_id`, alvo (`agent_id` quando aplicável), carimbo de data/hora, origem (IP), resultado (`permitido` / `negado`) e motivo interno do erro. O usuário final nunca recebe o motivo detalhado (mensagem genérica: "credenciais inválidas" / "não autorizado").

---

## 6. Critérios de aceitação (testáveis, não implementação)

1. **Zero acesso cross-tenant:** uma requisição autenticada na `company_id` A não consegue ler ou gravar linhas de agente/hire de qualquer outra `company_id` (verificado direto no banco via RLS).
2. **Validação de token:** 100% das emissões e renovações validam `iss`, `aud`, `alg` (allowlist, `none` rejeitado), `exp` e `jti`.
3. **RBAC de hireAgent:** `hireAgent` é bloqueado quando `clearance` do alvo > `clearance` do aprovador; bloqueado quando `department` alvo está fora do escopo sem aprovação do `department_head`.
4. **Separação de funções:** mesmo ator não pode solicitar e aprovar a mesma contratação (exceto break-glass auditado).
5. **Revogação em ≤ 60s:** desativação de agente (hire revogado) revoga todos os refresh tokens e sessões do agente na `company_id` em até 60 segundos, medido por tenant.
6. **Detecção de família:** reutilização de refresh token revoga toda a família com zero falsos negativos.
7. **Auditoria:** todos os eventos da seção 5 são gravados estruturadamente para 100% das contratações, aprovações, revogações e renovações de token.

---

## 7. Threat model (resumo)

| Ameaça | Controle nesta especificação |
|--------|------------------------------|
| Escalonamento de clearance via contratação | Gate: clearance do contratado ≤ clearance do aprovador. |
| Contratação cross-tenant | `company_id` só do contexto JWT; RLS nega qualquer linha fora do tenant. |
| UI-only authorization | Todas as verificações de permissão rodam server-side, em toda requisição. |
| Token de longa duração vazado | Access token ≤ 15 min; refresh token rotativo com revogação de família. |
| Reutilização de refresh token roubado | Detecção de replay ⇒ revogação de família + alerta. |
| Vazamento via connection pool | `set_config(..., true)` transacional; contexto ausente nega acesso. |
| Abuso de conta de serviço privilegiada | `BYPASSRLS` restrito a conexões dedicadas de break-glass, auditado. |

---

**Próximos passos (não escopo deste ADR):** implementar as migrações SQL de RLS, o serviço de emissão/validação de JWT com as claims acima, o endpoint `hireAgent` com a matriz RBAC, e os testes de segurança dos critérios da seção 6.