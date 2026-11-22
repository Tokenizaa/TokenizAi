/**
 * @nettoscorp/backend — Autenticação e autorização
 *
 * Login, registro, logout, emissão de JWT (HS256 com crypto built-in),
 * verificação de token, RBAC e integração com Supabase Auth via HTTP direto.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { supabaseRequest, supabaseAdminRequest } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER ?? 'tokenizai.nettoscorp.example.br';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'tokenizai-app';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET é obrigatório no ambiente de backend');
}

const JWT_SECRET_BUFFER: Buffer = Buffer.from(JWT_SECRET, 'utf8');

/**
 * Tipo de claims do JWT.
 */
export interface JWTClaims {
  sub: string;
  email: string;
  role: string;
  authorityLevel: string;
  clearanceLevel: string;
  companyId?: string;
  modules: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Validação simples de e-mail.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Emite um JWT HS256 assinado com a chave secreta.
 */
export function signToken(claims: Omit<JWTClaims, 'iat' | 'exp' | 'iss' | 'aud'>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');

  const payload = Buffer.from(
    JSON.stringify({
      ...claims,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutos
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    })
  ).toString('base64url');

  const signature = createHmac('sha256', JWT_SECRET_BUFFER)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifica e decodifica um JWT HS256. Lança erro se inválido ou expirado.
 */
export function verifyToken(token: string): JWTClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token malformado');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSignature = createHmac('sha256', JWT_SECRET_BUFFER)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (!timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSignature))) {
    throw new Error('Assinatura inválida');
  }

  let payload: JWTClaims;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as JWTClaims;
  } catch {
    throw new Error('Payload inválido');
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado');
  }

  if (payload.iss !== JWT_ISSUER) {
    throw new Error('Issuer inválido');
  }

  if (payload.aud !== JWT_AUDIENCE) {
    throw new Error('Audience inválido');
  }

  return payload;
}

/**
 * Middleware de autenticação. Extrai o Bearer token, verifica e anexa
 * `req.user` com os claims decodificados.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'unauthorized', message: 'Token de autenticação não fornecido' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const claims = verifyToken(token);
    req.user = claims;
    next();
  } catch (err) {
    res.status(401).json({
      code: 'token_invalid',
      message: err instanceof Error ? err.message : 'Token inválido',
    });
  }
}

/**
 * Middleware de autorização por nível de autoridade.
 */
export function requireAuthority(minLevel: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'unauthorized', message: 'Usuário não autenticado' });
      return;
    }
    const levels: Record<string, number> = {
      executiva_humana: 5,
      estrategica_delegada: 4,
      gerencial: 3,
      operacional: 2,
      tecnica: 1,
    };
    const userLevel = levels[req.user.authorityLevel] ?? 0;
    const requiredLevel = levels[minLevel] ?? 0;
    if (userLevel < requiredLevel) {
      res.status(403).json({
        code: 'authority_insufficient',
        message: `Autoridade insuficiente: ${req.user.authorityLevel} < ${minLevel}`,
      });
      return;
    }
    next();
  };
}

/**
 * Middleware de autorização por role.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'unauthorized', message: 'Usuário não autenticado' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        code: 'forbidden',
        message: `Papel '${req.user.role}' não autorizado para esta ação`,
      });
      return;
    }
    next();
  };
}

/**
 * Validação simples do corpo de login.
 */
function parseLoginBody(body: unknown): { email: string; password: string } | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.email !== 'string' || !isValidEmail(obj.email)) return null;
  if (typeof obj.password !== 'string' || obj.password.length < 6) return null;
  return { email: obj.email, password: obj.password };
}

/**
 * Validação simples do corpo de registro.
 */
function parseRegisterBody(body: unknown): {
  email: string;
  password: string;
  name: string;
  companyId?: string;
} | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.email !== 'string' || !isValidEmail(obj.email)) return null;
  if (typeof obj.password !== 'string' || obj.password.length < 6) return null;
  if (typeof obj.name !== 'string' || obj.name.length < 2) return null;
  return {
    email: obj.email,
    password: obj.password,
    name: obj.name,
    companyId: typeof obj.companyId === 'string' ? obj.companyId : undefined,
  };
}

/**
 * Login: autentica via Supabase Auth e emite JWT interno.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const parsed = parseLoginBody(req.body);
  if (!parsed) {
    res.status(400).json({
      code: 'validation_error',
      message: 'Dados de login inválidos: email e password são obrigatórios',
    });
    return;
  }

  const { email, password } = parsed;

  try {
    const result = (await supabaseRequest(
      'auth/token?grant_type=password',
      {
        method: 'POST',
        body: { email, password },
      }
    )) as { data?: unknown; error?: { message?: string } };

    if (result.error || !result.data) {
      res.status(401).json({
        code: 'invalid_credentials',
        message: 'E-mail ou senha inválidos',
      });
      return;
    }

    const user = result.data as { id: string; email: string; user_metadata?: Record<string, unknown> };
    const userMetadata = user.user_metadata ?? {};

    const claims: Omit<JWTClaims, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: user.id,
      email: user.email ?? email,
      role: (userMetadata.role as string) ?? 'operacional',
      authorityLevel: (userMetadata.authority_level as string) ?? 'operacional',
      clearanceLevel: (userMetadata.clearance_level as string) ?? 'publico',
      companyId: (userMetadata.company_id as string) ?? undefined,
      modules: Array.isArray(userMetadata.modules)
        ? (userMetadata.modules as string[])
        : ['executive', 'chat'],
    };

    const token = signToken(claims);

    res.json({
      code: 'ok',
      message: 'Autenticado com sucesso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: claims.role,
        authorityLevel: claims.authorityLevel,
        clearanceLevel: claims.clearanceLevel,
        companyId: claims.companyId,
        modules: claims.modules,
      },
    });
  } catch (err) {
    res.status(502).json({
      code: 'supabase_unavailable',
      message: err instanceof Error ? err.message : 'Serviço de autenticação indisponível',
    });
  }
}

/**
 * Registro: cria usuário no Supabase Auth e emite JWT.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const parsed = parseRegisterBody(req.body);
  if (!parsed) {
    res.status(400).json({
      code: 'validation_error',
      message: 'Dados de registro inválidos: email, password e name são obrigatórios',
    });
    return;
  }

  const { email, password, name, companyId } = parsed;

  try {
    const result = (await supabaseRequest('auth/signup', {
      method: 'POST',
      body: {
        email,
        password,
        options: {
          data: {
            name,
            role: 'operacional',
            authority_level: 'operacional',
            clearance_level: 'publico',
            company_id: companyId,
            modules: ['executive', 'chat'],
          },
        },
      },
    })) as { data?: unknown; error?: { message?: string } };

    if (result.error || !result.data) {
      res.status(400).json({
        code: 'registration_failed',
        message: (result.error as { message?: string })?.message ?? 'Falha ao registrar usuário',
      });
      return;
    }

    const user = result.data as { id: string; email: string };

    const claims: Omit<JWTClaims, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: user.id,
      email: user.email ?? email,
      role: 'operacional',
      authorityLevel: 'operacional',
      clearanceLevel: 'publico',
      companyId,
      modules: ['executive', 'chat'],
    };

    const token = signToken(claims);

    res.status(201).json({
      code: 'ok',
      message: 'Usuário registrado com sucesso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: 'operacional',
        authorityLevel: 'operacional',
        clearanceLevel: 'publico',
        companyId,
        modules: claims.modules,
      },
    });
  } catch (err) {
    res.status(502).json({
      code: 'supabase_unavailable',
      message: err instanceof Error ? err.message : 'Serviço de autenticação indisponível',
    });
  }
}

/**
 * Logout: invalida a sessão no Supabase e retorna sucesso.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      await supabaseRequest('auth/logout', {
        method: 'POST',
        accessToken: authHeader.slice(7),
      });
    }
  } catch {
    // Ignora erro — o cliente deve descartar o token localmente
  }
  res.json({ code: 'ok', message: 'Sessão encerrada' });
}

/**
 * Retorna o perfil do usuário autenticado.
 */
export function me(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ code: 'unauthorized', message: 'Usuário não autenticado' });
    return;
  }
  res.json({
    code: 'ok',
    user: {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
      authorityLevel: req.user.authorityLevel,
      clearanceLevel: req.user.clearanceLevel,
      companyId: req.user.companyId,
      modules: req.user.modules,
    },
  });
}

/* Extensão de Request para incluir o usuário autenticado */
declare global {
  namespace Express {
    interface Request {
      user?: JWTClaims;
    }
  }
}
