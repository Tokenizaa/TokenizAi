/**
 * @nettoscorp/backend — Cliente Supabase (HTTP direto via fetch built-in)
 *
 * Fonte de verdade para identidade, persistência, RLS e arquivos.
 * Usa fetch nativo do Node.js (sem dependência do @supabase/supabase-js).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios');
}

/**
 * Faz uma requisição autenticada ao Supabase com o token JWT do usuário.
 * Aplica RLS baseado na identidade autenticada.
 */
export async function supabaseRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    accessToken?: string;
  } = {}
) {
  const { method = 'GET', headers = {}, body, accessToken } = options;

  const requestHeaders: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...headers,
  };

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  let data: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = data instanceof Object && data !== null && 'message' in data
      ? (data as { message: string }).message
      : `HTTP ${response.status}`;
    throw new Error(`Supabase error: ${error}`);
  }

  return data;
}

/**
 * Cliente admin com Service Role — uso exclusivo do backend.
 */
export async function supabaseAdminRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }

  const { method = 'GET', headers = {}, body } = options;

  const requestHeaders: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  let data: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = data instanceof Object && data !== null && 'message' in data
      ? (data as { message: string }).message
      : `HTTP ${response.status}`;
    throw new Error(`Supabase admin error: ${error}`);
  }

  return data;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY };
