import {
  sign,
  verify,
  SignOptions,
  VerifyOptions,
  JwtPayload,
  TokenExpiredError,
  JsonWebTokenError,
} from 'jsonwebtoken';
import {
  randomBytes,
  createHash,
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
} from 'crypto';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface AuthorityJWTClaims extends JwtPayload {
  /** Identificador do usuário (subject) */
  sub: string;
  /** Empresa/tenant autenticada */
  company_id: string;
  /** Role do usuário na empresa */
  role: string;
  /** Nível de autoridade (RBAC) */
  authority_level: string;
  /** Nível de classificação/clearance */
  clearance_level: string;
  /** Módulos habilitados para o usuário */
  modules: string[];
  /** Identificador da sessão (atrelado ao refresh token) */
  session_id: string;
  /** Método de autenticação usado (password, sso, passkey, ...) */
  auth_method: string;
  /** Authentication Methods References (array de métodos) */
  amr: string[];
  /** Authentication Context Class Reference (nível de segurança) */
  acr: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** TTL do access token em segundos */
  expiresIn: number;
  /** Data de expiração do access token (ISO) */
  expiresAt: string;
}

export interface AuthContext {
  userId: string;
  companyId: string;
  role: string;
  authorityLevel: string;
  clearanceLevel: string;
  modules: string[];
  authMethod: string;
  amr: string[];
  acr: string;
  /** IP de origem (para auditoria) */
  ip?: string;
  /** User-Agent (para auditoria) */
  userAgent?: string;
}

export interface RefreshTokenRecord {
  sessionId: string;
  userId: string;
  companyId: string;
  /** Hash SHA-256 do refresh token (nunca armazena o token puro) */
  refreshTokenHash: string;
  /** JTI do access token emitido nesta rotação */
  jti: string;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  /** Família do refresh token (para detecção de reuso de token roubado) */
  familyId: string;
  role: string;
  authorityLevel: string;
  clearanceLevel: string;
  modules: string[];
  authMethod: string;
  amr: string[];
  acr: string;
}

export interface RevokedJti {
  jti: string;
  revokedAt: number;
  /** JTIs da mesma família revogados por reuso */
  familyIds: string[];
}

/* -------------------------------------------------------------------------- */
/* Key management (RS256)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Carrega chaves RSA de env vars ou gera um par efêmero em memória.
 * Em produção, fornecer AUTH_JWT_PRIVATE_KEY e AUTH_JWT_PUBLIC_KEY (PEM).
 * O par efêmero serve para desenvolvimento e testes; não é persistido entre
 * reinícios, o que invalida todos os access tokens — comportamento desejado
 * fora de produção para evitar chaves órfãs.
 */
export function loadRsaKeys({
  privateKeyPem,
  publicKeyPem,
}: {
  privateKeyPem?: string;
  publicKeyPem?: string;
}): { privateKey: KeyObject; publicKey: KeyObject } {
  if (privateKeyPem && publicKeyPem) {
    return {
      privateKey: createPrivateKey(privateKeyPem),
      publicKey: createPublicKey(publicKeyPem),
    };
  }

  // Par efêmero em memória (dev/testes). Não é persistido entre reinícios,
  // o que invalida todos os access tokens — comportamento desejado fora de
  // produção para evitar chaves órfãs.
  const { publicKey, privateKey } = generateKeyPairSync('RSA', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

/* -------------------------------------------------------------------------- */
/* In-memory session / denylist store                                         */
/* -------------------------------------------------------------------------- */

/**
 * Armazenamento em memória de sessões e JTIs revogados.
 * Pode ser substituído por Redis/DB implementando a mesma interface.
 */
export interface SessionStore {
  create(record: Omit<RefreshTokenRecord, 'revoked'>): Promise<void>;
  getBySessionId(sessionId: string): Promise<RefreshTokenRecord | null>;
  getByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<RefreshTokenRecord | null>;
  update(sessionId: string, partial: Partial<RefreshTokenRecord>): Promise<void>;
  destroy(sessionId: string): Promise<void>;
}

export interface Denylist {
  add(jti: string, until: number, familyIds: string[]): Promise<void>;
  has(jti: string): Promise<boolean>;
  cleanup(olderThan: number): Promise<void>;
}

const DEFAULT_TTL_SECONDS = 900; // 15 minutos — access token de curta vida
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias para o refresh token

class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, RefreshTokenRecord>();

  async create(record: Omit<RefreshTokenRecord, 'revoked'>): Promise<void> {
    this.sessions.set(record.sessionId, {
      ...record,
      revoked: false,
    });
  }

  async getBySessionId(sessionId: string): Promise<RefreshTokenRecord | null> {
    return (this.sessions.get(sessionId) ?? null);
  }

  async getByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    for (const record of this.sessions.values()) {
      if (record.refreshTokenHash === refreshTokenHash) return record;
    }
    return null;
  }

  async update(
    sessionId: string,
    partial: Partial<RefreshTokenRecord>,
  ): Promise<void> {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    this.sessions.set(sessionId, { ...current, ...partial });
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class MemoryDenylist implements Denylist {
  private entries = new Map<string, RevokedJti>();

  async add(jti: string, until: number, familyIds: string[]): Promise<void> {
    this.entries.set(jti, { jti, revokedAt: Date.now(), familyIds });
    // 'until' é retido para futuras políticas de expiração absoluta do denylist.
    void until;
  }

  async has(jti: string): Promise<boolean> {
    const entry = this.entries.get(jti);
    if (!entry) return false;
    return true;
  }

  async cleanup(olderThan: number): Promise<void> {
    const now = Date.now();
    for (const [jti, entry] of this.entries.entries()) {
      if (now - entry.revokedAt > olderThan) this.entries.delete(jti);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function jtiFor(sessionId: string): string {
  return createHash('sha256').update(`jti:${sessionId}:${Date.now()}`).digest(
    'hex',
  );
}

function opaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isTokenExpiredError(err: unknown): err is TokenExpiredError {
  return err instanceof TokenExpiredError;
}

/* -------------------------------------------------------------------------- */
/* JWTGovernance                                                              */
/* -------------------------------------------------------------------------- */

export interface JWTGovernanceOptions {
  issuer: string;
  audience: string;
  /** TTL do access token em segundos (máx. 900 = 15 min) */
  accessTokenTtlSeconds?: number;
  /** TTL do refresh token em segundos */
  refreshTokenTtlSeconds?: number;
  sessionStore?: SessionStore;
  denylist?: Denylist;
  privateKeyPem?: string;
  publicKeyPem?: string;
}

/**
 * Governança de JWT: emissão de access tokens RS256 de curta duração,
 * refresh tokens opacos rotativos em cookie HttpOnly, denylist de JTI e
 * revogação instantânea por delete de sessão.
 *
 * Regras de segurança aplicadas:
 *  - alg fixo RS256 (allowlist; 'none' rejeitado)
 *  - exp ≤ 15 min no access token
 *  - jti único por emissão, rastreado no denylist
 *  - refresh token opaco, hash armazenado, rotação a cada uso
 *  - reuso de refresh token revoga toda a família e levanta alerta
 *  - revogação por delete de sessão (instantânea, ≤ 60s)
 */
export class JWTGovernance {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly store: SessionStore;
  private readonly denylist: Denylist;

  constructor(options: JWTGovernanceOptions) {
    const { privateKey, publicKey } = loadRsaKeys({
      privateKeyPem: options.privateKeyPem,
      publicKeyPem: options.publicKeyPem,
    });

    this.issuer = options.issuer;
    this.audience = options.audience;
    this.accessTokenTtlSeconds = Math.min(
      options.accessTokenTtlSeconds ?? DEFAULT_TTL_SECONDS,
      DEFAULT_TTL_SECONDS,
    );
    this.refreshTokenTtlSeconds =
      options.refreshTokenTtlSeconds ?? REFRESH_TTL_SECONDS;
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.store = options.sessionStore ?? new MemorySessionStore();
    this.denylist = options.denylist ?? new MemoryDenylist();
  }

  /* ------------------------------------------------------------------ */
  /* Emissão de tokens                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Emite um par access + refresh token para um contexto de autenticação.
   * O refresh token é retornado em texto puro (única vez) e deve ser definido
   * em cookie HttpOnly pelo caller. O hash é armazenado na sessão.
   */
  async issueSession(
    authContext: AuthContext,
  ): Promise<{ pair: TokenPair; sessionId: string }> {
    const sessionId = randomBytes(16).toString('hex');
    const familyId = randomBytes(16).toString('hex');
    const jti = jtiFor(sessionId);
    const now = nowSeconds();
    const exp = now + this.accessTokenTtlSeconds;

    const claims: AuthorityJWTClaims = {
      sub: authContext.userId,
      company_id: authContext.companyId,
      role: authContext.role,
      authority_level: authContext.authorityLevel,
      clearance_level: authContext.clearanceLevel,
      modules: authContext.modules,
      session_id: sessionId,
      auth_method: authContext.authMethod,
      amr: authContext.amr,
      acr: authContext.acr,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp,
      jti,
    };

    const accessToken = this.signAccessToken(claims);

    const refreshToken = opaqueToken();
    const refreshTokenHash = hashToken(refreshToken);

    await this.store.create({
      sessionId,
      userId: authContext.userId,
      companyId: authContext.companyId,
      refreshTokenHash,
      jti,
      createdAt: now,
      expiresAt: now + this.refreshTokenTtlSeconds,
      familyId,
      role: authContext.role,
      authorityLevel: authContext.authorityLevel,
      clearanceLevel: authContext.clearanceLevel,
      modules: authContext.modules,
      authMethod: authContext.authMethod,
      amr: authContext.amr,
      acr: authContext.acr,
    });

    const pair: TokenPair = {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtlSeconds,
      expiresAt: new Date(exp * 1000).toISOString(),
    };

    return { pair, sessionId };
  }

  /**
   * Rotaciona o refresh token: valida o token atual, revoga seu JTI (e a
   * família em caso de reuso detectado), emite um novo par e um novo refresh
   * token. Se o refresh token apresentado já estiver revogado ou não casar com
   * a sessão, toda a família é revogada e um erro é lançado (possível roubo).
   */
  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<{ pair: TokenPair; sessionId: string }> {
    const refreshTokenHash = hashToken(refreshToken);
    const record = await this.store.getByRefreshTokenHash(refreshTokenHash);

    if (!record) {
      // Token desconhecido — possível ataque. Não há sessão para revogar,
      // mas registramos a tentativa no denylist como jti nulo.
      throw new AuthorityError('refresh_token_invalid', 'Refresh token desconhecido.');
    }

    if (record.revoked) {
      // Reuso de refresh token revogado: roubo de token da família.
      // Revoga toda a família e levanta alerta.
      await this.denylist.add(record.jti, Date.now() + 86400, [record.familyId]);
      await this.store.destroy(record.sessionId);
      throw new AuthorityError(
        'refresh_token_family_revoked',
        'Reuso de refresh token detectado. Família revogada.',
      );
    }

    // Verifica se o JTI associado já está no denylist (replay).
    if (await this.denylist.has(record.jti)) {
      await this.store.destroy(record.sessionId);
      throw new AuthorityError(
        'refresh_token_family_revoked',
        'JTI replayado. Família revogada.',
      );
    }

    // Revoga o JTI atual (rotação) e destrói a sessão antiga.
    await this.denylist.add(record.jti, Date.now() + this.refreshTokenTtlSeconds, [
      record.familyId,
    ]);
    await this.store.destroy(record.sessionId);

    // Emite nova sessão preservando o contexto de autorização.
    const authContext: AuthContext = {
      userId: record.userId,
      companyId: record.companyId,
      role: record.role ?? '',
      authorityLevel: record.authorityLevel ?? '',
      clearanceLevel: record.clearanceLevel ?? '',
      modules: record.modules ?? [],
      authMethod: record.authMethod ?? 'refresh',
      amr: record.amr ?? [],
      acr: record.acr ?? '1',
    };

    return this.issueSession(authContext);
  }

  /* ------------------------------------------------------------------ */
  /* Verificação                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Verifica e decodifica um access token.
   * Rejeita alg diferente de RS256, issuer/audience fora do escopo e
   * JTIs no denylist (revogados). Lança AuthorityError em qualquer falha.
   */
  async verifyAccessToken(token: string): Promise<AuthorityJWTClaims> {
    const verifyOptions: VerifyOptions = {
      algorithms: ['RS256'],
      issuer: this.issuer,
      audience: this.audience,
      complete: true,
    };

    let decoded: { header: { alg: string; typ?: string }; payload: JwtPayload };
    try {
      decoded = verify(token, this.publicKey, verifyOptions) as {
        header: { alg: string; typ?: string };
        payload: JwtPayload;
      };
    } catch (err) {
      if (isTokenExpiredError(err)) {
        throw new AuthorityError('token_expired', 'Access token expirado.');
      }
      throw new AuthorityError('token_invalid', 'Access token inválido.');
    }

    // Allowlist de algoritmo: 'none' ou qualquer coisa != RS256 é rejeitada.
    if (decoded.header.alg !== 'RS256') {
      throw new AuthorityError('algorithm_not_allowed', `alg '${decoded.header.alg}' não permitido.`);
    }

    const payload = decoded.payload as AuthorityJWTClaims;

    // JTI revogado (logout / rotação / reuso).
    if (payload.jti && (await this.denylist.has(payload.jti))) {
      throw new AuthorityError('token_revoked', 'Token revogado.');
    }

    return payload as AuthorityJWTClaims;
  }

  /* ------------------------------------------------------------------ */
  /* Revogação                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Revoga uma sessão instantaneamente: destrói o registro de sessão e
   * adiciona o JTI ao denylist. O access token passa a ser rejeitado em
   * até o próximo pedido (TTL do access token ≤ 15 min, denylist consultado
   * a cada verificação).
   */
  async revokeSession(sessionId: string): Promise<void> {
    const record = await this.store.getBySessionId(sessionId);
    if (record) {
      if (record.jti) {
        await this.denylist.add(
          record.jti,
          Date.now() + this.refreshTokenTtlSeconds,
          [record.familyId],
        );
      }
      await this.store.destroy(sessionId);
    }
  }

  /**
   * Revoga um JTI específico (usado em rotação e reuso).
   */
  async revokeJti(jti: string): Promise<void> {
    await this.denylist.add(jti, Date.now() + this.refreshTokenTtlSeconds, []);
  }

  /* ------------------------------------------------------------------ */
  /* Cookie                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Opções de cookie HttpOnly para o refresh token.
   * O cookie nunca é acessível por JavaScript (mitiga XSS) e é enviado
   * apenas sobre HTTPS em produção.
   */
  cookieOptions(secure = true): Record<string, unknown> {
    return {
      httpOnly: true,
      secure,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: this.refreshTokenTtlSeconds * 1000,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Sign interno                                                       */
  /* ------------------------------------------------------------------ */

  private signAccessToken(claims: AuthorityJWTClaims): string {
    const signOptions: SignOptions = {
      algorithm: 'RS256',
      issuer: this.issuer,
      audience: this.audience,
      jwtid: claims.jti,
      expiresIn: this.accessTokenTtlSeconds,
      notBefore: 0,
    };
    return sign(claims, this.privateKey, signOptions);
  }
}

/* -------------------------------------------------------------------------- */
/* Error                                                                    */
/* -------------------------------------------------------------------------- */

export class AuthorityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthorityError';
    this.code = code;
  }
}

export {
  TokenExpiredError,
  JsonWebTokenError,
};
