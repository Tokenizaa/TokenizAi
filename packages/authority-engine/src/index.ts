/**
 * @nettoscorp/authority-engine — Fase 8 Governance Layer
 *
 * Authority Engine: JWT governance, refresh rotation, revocation,
 * authority/clearance checks and separation of duties (SoD).
 *
 * Fluxo:
 *   1. JWTGovernance.issueSession(authContext) — emite par access (RS256, ≤15 min)
 *      + refresh (opaco, rotativo, cookie HttpOnly)
 *   2. JWTGovernance.verifyAccessToken(token) — verifica alg RS256, issuer,
 *      audience, JTI no denylist (revogados), exp
 *   3. JWTGovernance.rotateRefreshToken(token) — rotação com detecção de reuso
 *      (revoga família + alerta)
 *   4. JWTGovernance.revokeSession(sessionId) — revogação instantânea (≤60s)
 *   5. checkAuthorityLevel / checkClearanceFloor — verificação hierárquica
 *   6. checkSeparationOfDuties / dutiesFromRoles — segregação de funções
 *
 * Observabilidade: cada operação emite logs estruturados com correlation id.
 */

export {
  JWTGovernance,
  AuthorityError,
  type AuthorityJWTClaims,
  type TokenPair,
  type AuthContext,
  type RefreshTokenRecord,
  type RevokedJti,
  type SessionStore,
  type Denylist,
  type JWTGovernanceOptions,
} from './jwt-governance';

export {
  checkAuthorityLevel,
  checkClearanceLevel,
  checkClearanceFloor,
  checkSeparationOfDuties,
  dutiesFromRoles,
  type Duty,
  type DutyPolicy,
  type SegregationResult,
  AUTHORITY_RANK,
  CLEARANCE_RANK,
  authorityRank,
  clearanceRank,
} from './authority-checks';
