#!/usr/bin/env bash
# ============================================================================
# Script de inicialização do Supabase para TokenizAi (Fase 1)
#
# Pré-requisitos:
#   - Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidas no ambiente
#   - Acesso ao Supabase com service_role key (para criar tabelas e RLS)
#
# Uso:
#   export SUPABASE_URL="https://seu-projeto.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
#   chmod +x scripts/init-supabase.sh
#   ./scripts/init-supabase.sh
# ============================================================================

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "ERRO: Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar."
  echo "Exemplo:"
  echo "  export SUPABASE_URL=https://seu-projeto.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=seu_service_role_key"
  exit 1
fi

echo "========================================"
echo "Inicializando Supabase para TokenizAi"
echo "========================================"
echo "URL: $SUPABASE_URL"
echo ""

# 1. Aplicar migration 0000 (schema inicial com RLS)
echo "[1/3] Aplicando migration 0000_initial_schema.sql..."
RESPONSE=$(curl -s --max-time 30 \
  "${SUPABASE_URL}/rest/v1/rpc/pg_exec" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat packages/db/migrations/0000_initial_schema.sql | tr '\n' ' ' | sed 's/"/\\"/g')\"}" 2>/dev/null || true)

# Nota: Supabase não expõe pg_exec via REST padrão. 
# Use o SQL Editor no dashboard do Supabase ou psql diretamente.
# Este script serve como documentação dos comandos a executar.

echo ""
echo "========================================"
echo "PRÓXIMOS PASSOS MANUAIS NO SUPABASE"
echo "========================================"
echo ""
echo "1. Acesse o dashboard do Supabase: https://app.supabase.com/project/$(echo $SUPABASE_URL | sed 's|https://||;s|\.supabase\.co.*||')"
echo "2. Vá em SQL Editor"
echo "3. Cole e execute o conteúdo de: packages/db/migrations/0000_initial_schema.sql"
echo "4. Cole e execute o conteúdo de: supabase/migrations/0001_seed_initial_data.sql"
echo "5. Crie o primeiro usuário admin via Auth > Users > Add user"
echo "6. Atualize o owner_id da empresa com o ID do usuário criado"
echo ""
echo "Ou use psql diretamente:"
echo ""
echo "  psql \"$SUPABASE_URL\" \\"
echo "    -f packages/db/migrations/0000_initial_schema.sql \\"
echo "    -f supabase/migrations/0001_seed_initial_data.sql"
echo ""
echo "========================================"
echo "Variáveis para o backend (.env):"
echo "========================================"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_ANON_KEY=sua_anon_key_aqui"
echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
echo "JWT_SECRET=sua_chave_secreta_de_32_chars"
echo "JWT_ISSUER=tokenizai.local"
echo "JWT_AUDIENCE=tokenizai-app"
echo "PAPERCLIP_API_URL=http://localhost:4000"
echo "PAPERCLIP_API_KEY=sua_chave_do_paperclip"
echo "PORT=3001"
echo "APP_URL=http://localhost:3001"
echo "ENVIRONMENT=development"
echo ""
echo "========================================"
echo "Após configurar, execute:"
echo "  cd backend && npx tsx src/index.ts"
echo "  (ou faça deploy em ambiente Node.js contínuo)"
echo "========================================"
