#!/usr/bin/env bash
# ============================================================================
# Script de validação rápida do backend TokenizAi (Fase 1)
#
# Testa se o backend está rodando e respondendo corretamente.
#
# Uso:
#   ./scripts/validate-backend.sh [URL_BACKEND]
#
# Padrão: http://localhost:3001
# ============================================================================

set -euo pipefail

BACKEND_URL="${1:-http://localhost:3001}"

echo "========================================"
echo "Validação do Backend TokenizAi (Fase 1)"
echo "========================================"
echo "URL: $BACKEND_URL"
echo ""

# 1. Health check
echo "[1/4] Health check..."
HEALTH=$(curl -s --max-time 10 "${BACKEND_URL}/api/health" 2>/dev/null || echo '{"error":"connection_failed"}')
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

SUPABASE_OK=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('integrations',{}).get('supabase',False))" 2>/dev/null || echo "false")

if [ "$SUPABASE_OK" = "True" ]; then
  echo "  ✓ Supabase conectado"
else
  echo "  ⚠ Supabase não conectado (esperado se credenciais não configuradas)"
fi

# 2. Rotas de autenticação (sem token devem retornar 401)
echo "[2/4] Rotas protegidas (sem token)..."
ME=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BACKEND_URL}/api/auth/me")
ADMIN=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BACKEND_URL}/api/admin/metrics")
echo "  GET /api/auth/me -> $ME (esperado: 401)"
echo "  GET /api/admin/metrics -> $ADMIN (esperado: 401)"

# 3. Login (deve falhar com 502 se Sem Supabase, ou 401 se credenciais inválidas)
echo "[3/4] Login (sem Supabase configurado)..."
LOGIN=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","password":"senha123"}')
echo "  POST /api/auth/login -> $LOGIN (esperado: 502 se sem Supabase, 401 se credenciais inválidas)"

# 4. Registro (mesmo que login)
echo "[4/4] Registro (sem Supabase configurado)..."
REGISTER=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "${BACKEND_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"novo@exemplo.com","password":"senha123","name":"Teste"}')
echo "  POST /api/auth/register -> $REGISTER (esperado: 502 se sem Supabase, 400 se erro de validação)"

echo ""
echo "========================================"
echo "Resultado da validação"
echo "========================================"
if [ "$ME" = "401" ] && [ "$ADMIN" = "401" ]; then
  echo "✓ Rotas protegidas funcionando (retornam 401 sem token)"
else
  echo "✗ Rotas protegidas não retornam 401 (ME=$ME, ADMIN=$ADMIN)"
fi

if [ "$LOGIN" = "502" ] || [ "$LOGIN" = "401" ]; then
  echo "✓ Login responde adequadamente (sem Supabase ou credenciais inválidas)"
else
  echo "⚠ Login retornou $LOGIN (verificar logs do backend)"
fi

if [ "$REGISTER" = "502" ] || [ "$REGISTER" = "400" ]; then
  echo "✓ Registro responde adequadamente (sem Supabase ou erro de validação)"
else
  echo "⚠ Registro retornou $REGISTER (verificar logs do backend)"
fi

echo ""
echo "Para testar com credenciais reais:"
echo "  1. Configure SUPABASE_URL e SUPABASE_ANON_KEY no backend/.env"
echo "  2. Execute scripts/init-supabase.sh para criar tabelas no Supabase"
echo "  3. Reinicie o backend e rode este script novamente"
