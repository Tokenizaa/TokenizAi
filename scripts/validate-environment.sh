#!/usr/bin/env bash
# ============================================================================
# Script de diagnóstico completo do ambiente TokenizAi (Fase 1)
#
# Verifica: backend, Supabase, credenciais, variáveis de ambiente.
#
# Uso:
#   ./scripts/validate-environment.sh [URL_BACKEND]
#
# Padrão: http://localhost:3001
# ============================================================================

set -euo pipefail

BACKEND_URL="${1:-http://localhost:3001}"
SUPABASE_URL="${SUPABASE_URL:-https://udeglcdloehagljrrukj.supabase.co}"

echo "========================================"
echo "  DIAGNÓSTICO COMPLETO — TokenizAi Fase 1"
echo "========================================"
echo ""

# --------------------------------------------------------------------------
# 1. Variáveis de ambiente do backend
# --------------------------------------------------------------------------
echo "[1/6] Variáveis de ambiente do backend..."
if [ -f backend/.env ]; then
  echo "  ✓ backend/.env existe"
  if grep -q "SUPABASE_URL=" backend/.env && ! grep -q "placeholder" backend/.env; then
    echo "  ✓ SUPABASE_URL configurada"
  else
    echo "  ✗ SUPABASE_URL não configurada ou é placeholder"
  fi
  if grep -q "SUPABASE_ANON_KEY=" backend/.env && ! grep -q "placeholder" backend/.env; then
    echo "  ✓ SUPABASE_ANON_KEY configurada"
  else
    echo "  ✗ SUPABASE_ANON_KEY não configurada ou é placeholder"
  fi
  if grep -q "SUPABASE_SERVICE_ROLE_KEY=" backend/.env && ! grep -q "placeholder" backend/.env; then
    echo "  ✓ SUPABASE_SERVICE_ROLE_KEY configurada"
  else
    echo "  ✗ SUPABASE_SERVICE_ROLE_KEY não configurada ou é placeholder"
  fi
  if grep -q "JWT_SECRET=" backend/.env && ! grep -q "placeholder\|minha_chave" backend/.env; then
    echo "  ✓ JWT_SECRET configurada"
  else
    echo "  ✗ JWT_SECRET não configurada ou é placeholder"
  fi
else
  echo "  ✗ backend/.env não encontrado"
fi
echo ""

# --------------------------------------------------------------------------
# 2. Supabase conectividade
# --------------------------------------------------------------------------
echo "[2/6] Conectividade com Supabase ($SUPABASE_URL)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SUPABASE_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "  ✗ DNS não resolve ou servidor inacessível"
elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "  ✓ Servidor responde (código $HTTP_CODE — projeto existe)"
else
  echo "  ? Servidor respondeu com código $HTTP_CODE"
fi

# Testar anon key
ANON_RESPONSE=$(curl -s --max-time 10 "$SUPABASE_URL/rest/v1/" \
  -H "apikey: ${SUPABASE_ANON_KEY:-placeholder}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY:-placeholder}" 2>/dev/null || echo "{}")
if echo "$ANON_RESPONSE" | grep -q "Invalid API key"; then
  echo "  ✗ SUPABASE_ANON_KEY inválida (rejeitada pelo Supabase)"
elif echo "$ANON_RESPONSE" | grep -q "{" ; then
  echo "  ? SUPABASE_ANON_KEY: resposta não-vazia (verificar manualmente)"
else
  echo "  ? SUPABASE_ANON_KEY: resposta inesperada"
fi
echo ""

# --------------------------------------------------------------------------
# 3. Backend rodando
# --------------------------------------------------------------------------
echo "[3/6] Backend rodando em $BACKEND_URL..."
BACKEND_HEALTH=$(curl -s --max-time 10 "$BACKEND_URL/api/health" 2>/dev/null || echo '{"error":"connection_failed"}')
if echo "$BACKEND_HEALTH" | grep -q '"status"'; then
  STATUS=$(echo "$BACKEND_HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  SUPABASE_IN_BACKEND=$(echo "$BACKEND_HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('integrations',{}).get('supabase',False))" 2>/dev/null || echo "false")
  echo "  ✓ Backend respondendo (status: $STATUS)"
  echo "  ? Supabase no backend: $SUPABASE_IN_BACKEND"
else
  echo "  ✗ Backend não respondeu (verificar se está rodando)"
fi
echo ""

# --------------------------------------------------------------------------
# 4. Rotas de autenticação
# --------------------------------------------------------------------------
echo "[4/6] Rotas de autenticação..."
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","password":"senha123"}' 2>/dev/null || echo "000")
ME_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "$BACKEND_URL/api/auth/me" 2>/dev/null || echo "000")
echo "  POST /api/auth/login -> $LOGIN_CODE (esperado: 502 se sem Supabase, 401 se sem credenciais)"
echo "  GET /api/auth/me -> $ME_CODE (esperado: 401 sem token)"
echo ""

# --------------------------------------------------------------------------
# 5. Typecheck do backend
# --------------------------------------------------------------------------
echo "[5/6] Typecheck do backend..."
if cd backend 2>/dev/null && npx tsc --noEmit 2>&1 | head -5; then
  echo "  ✓ Typecheck passou"
else
  echo "  ✗ Typecheck falhou (verificar erros acima)"
fi
cd .. 2>/dev/null || true
echo ""

# --------------------------------------------------------------------------
# 6. Resumo
# --------------------------------------------------------------------------
echo "========================================"
echo "  RESUMO DO DIAGNÓSTICO"
echo "========================================"
echo ""
echo "Para colocar o TokenizAi em uso real:"
echo ""
echo "  1. Configurar credenciais reais no backend/.env"
echo "     (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET)"
echo ""
echo "  2. Aplicar migrations no Supabase:"
echo "     - packages/db/migrations/0000_initial_schema.sql"
echo "     - supabase/migrations/0001_seed_initial_data.sql"
echo ""
echo "  3. Fazer deploy do backend em ambiente Node.js contínuo:"
echo "     cd backend && npx tsx src/index.ts"
echo ""
echo "  4. Conectar o frontend Cloudflare Pages à URL do backend"
echo ""
echo "  5. Validar:"
echo "     ./scripts/validate-backend.sh https://seu-backend.example.com"
echo ""
echo "========================================"
