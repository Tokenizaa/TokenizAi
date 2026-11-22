/**
 * @nettoscorp/backend — Cliente Supabase (HTTP direto via fetch built-in)
 * Chaves são lidas de arquivos temporários para evitar truncamento.
 */
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;

function loadKeyFromFile(filePath: string): string {
  try {
    const fromFile = fs.readFileSync(filePath, 'utf8').trim();
    if (fromFile && fromFile.length > 50) {
      console.log('[supabase] Carregou chave de ' + filePath + ', tamanho=' + fromFile.length);
      return fromFile;
    }
  } catch {}
  return '';
}

const SUPABASE_ANON_KEY = loadKeyFromFile('/tmp/anon_key.txt');
const SUPABASE_SERVICE_ROLE_KEY = loadKeyFromFile('/tmp/svc_key.txt');

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL é obrigatório');
}

if (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Chaves não encontradas nos arquivos');
}

console.log('[supabase] SUPABASE_SERVICE_ROLE_KEY length:', SUPABASE_SERVICE_ROLE_KEY.length);
console.log('[supabase] SUPABASE_ANON_KEY length:', SUPABASE_ANON_KEY.length);

export async function supabaseRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown; accessToken?: string } = {}
) {
  const { method = 'GET', headers = {}, body, accessToken } = options;
  const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  console.log('[supabase] Usando chave de tamanho:', apiKey.length, 'para', path);

  const requestHeaders: Record<string, string> = {
    apikey: apiKey,
    Authorization: 'Bearer ' + apiKey,
    ...headers,
  };

  if (accessToken) {
    requestHeaders.Authorization = 'Bearer ' + accessToken;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const url = SUPABASE_URL + '/rest/v1/' + path;
  const init: RequestInit = { method, headers: requestHeaders };

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
      : 'HTTP ' + response.status;
    throw new Error('Supabase error: ' + error);
  }

  return data;
}

export async function supabaseAdminRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  return supabaseRequest(path, options);
}
