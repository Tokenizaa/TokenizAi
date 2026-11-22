/**
 * @nettoscorp/backend — Servidor Express
 *
 * Backend central da NettosCorp Enterprise: autenticação, RBAC, API empresarial,
 * chat, orquestração de agentes, tarefas e governança. Conectado ao Supabase
 * como fonte de verdade de dados e RLS.
 *
 * Zero dependências externas além do Express (já disponível no workspace).
 * JWT via crypto built-in. Supabase via fetch built-in. CORS manual.
 */

import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import {
  authenticate,
  login,
  logout,
  me,
  register,
  requireAuthority,
  requireRole,
} from './auth';
import { supabaseRequest } from './supabase';

const PORT = Number(process.env.PORT ?? 3000);
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const app = express();

/* -------------------------------------------------------------------------- */
/* Middleware                                                                 */
/* -------------------------------------------------------------------------- */

app.use(express.json());

// CORS manual (sem dependência do pacote cors)
app.use((_req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', APP_URL);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

/* -------------------------------------------------------------------------- */
/* Health check real — verifica conexão com o Supabase                        */
/* -------------------------------------------------------------------------- */

app.get('/api/health', async (_req: Request, res: Response) => {
  let supabaseOk = false;
  let supabaseError: string | null = null;

  try {
    await supabaseRequest('companies?select=count', {
      method: 'GET',
    });
    supabaseOk = true;
  } catch (err) {
    supabaseError = err instanceof Error ? err.message : String(err);
  }

  res.json({
    status: supabaseOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT ?? 'development',
    integrations: {
      supabase: supabaseOk,
      supabaseError,
      paperclip: Boolean(process.env.PAPERCLIP_API_URL),
    },
    version: '1.0.0',
  });
});

/* -------------------------------------------------------------------------- */
/* Autenticação                                                               */
/* -------------------------------------------------------------------------- */

app.post('/api/auth/login', login);
app.post('/api/auth/register', register);
app.post('/api/auth/logout', authenticate, logout);
app.get('/api/auth/me', authenticate, me);

/* -------------------------------------------------------------------------- */
/* Rotas empresariais protegidas                                              */
/* -------------------------------------------------------------------------- */

app.get(
  '/api/user/profile',
  authenticate,
  (_req: Request, res: Response) => {
    if (!_req.user) {
      res.status(401).json({ code: 'unauthorized', message: 'Usuário não autenticado' });
      return;
    }
    res.json({
      code: 'ok',
      user: {
        id: _req.user.sub,
        email: _req.user.email,
        role: _req.user.role,
        authorityLevel: _req.user.authorityLevel,
        clearanceLevel: _req.user.clearanceLevel,
        companyId: _req.user.companyId,
        modules: _req.user.modules,
      },
    });
  }
);

/* Exemplo de rota administrativa (somente direção executiva) */
app.get(
  '/api/admin/metrics',
  authenticate,
  requireAuthority('executiva_humana'),
  async (_req: Request, res: Response) => {
    try {
      const data = await supabaseRequest('companies?select=*', {
        method: 'GET',
        accessToken: _req.headers.authorization?.slice(7) ?? '',
      });
      res.json({ code: 'ok', companies: data ?? [] });
    } catch (err) {
      res.status(500).json({
        code: 'internal_error',
        message: err instanceof Error ? err.message : 'Erro interno',
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* 404                                                                        */
/* -------------------------------------------------------------------------- */

app.use((_req: Request, res: Response) => {
  res.status(404).json({ code: 'not_found', message: 'Rota não encontrada' });
});

/* -------------------------------------------------------------------------- */
/* Inicialização                                                              */
/* -------------------------------------------------------------------------- */

async function main() {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length > 0) {
    console.error(
      `[backend] Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`
    );
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[backend] TokenizAi backend rodando na porta ${PORT}`);
    console.log(`[backend] APP_URL: ${APP_URL}`);
    console.log(`[backend] Supabase: ${process.env.SUPABASE_URL}`);
    console.log(`[backend] Ambiente: ${process.env.ENVIRONMENT ?? 'development'}`);
  });
}

main().catch((err) => {
  console.error('[backend] Falha ao iniciar:', err);
  process.exit(1);
});
