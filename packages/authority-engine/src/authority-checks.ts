/**
 * @nettoscorp/authority-engine — Authority checks
 *
 * Verificação de authority_level por ação, piso de clearance e
 * separação de funções (solicitante ≠ aprovador ≠ provisionador).
 * Toda falha lança AuthorityError com código de erro estruturado.
 */

import { AuthorityError } from './jwt-governance';

/* -------------------------------------------------------------------------- */
/* Hierarquias                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Hierarquia de autoridade (maior = mais autoridade).
 * executiva_humana > estrategica_delegada > gerencial > operacional > tecnica
 */
export const AUTHORITY_RANK: Record<string, number> = {
  executiva_humana: 5,
  estrategica_delegada: 4,
  gerencial: 3,
  operacional: 2,
  tecnica: 1,
};

/**
 * Hierarquia de clearance (maior = mais sensível).
 * confidencial > estrategica > gerencial > restrito > publico
 */
export const CLEARANCE_RANK: Record<string, number> = {
  confidencial: 5,
  estrategica: 4,
  gerencial: 3,
  restrito: 2,
  publico: 1,
};

/**
 * Retorna o rank numérico de um authority_level. Níveis desconhecidos = 0.
 */
export function authorityRank(level: string): number {
  return AUTHORITY_RANK[level] ?? 0;
}

/**
 * Retorna o rank numérico de um clearance_level. Níveis desconhecidos = 0.
 */
export function clearanceRank(level: string): number {
  return CLEARANCE_RANK[level] ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Verificações individuais                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Verifica se o nível de autoridade do usuário atende ao exigido pela ação.
 * Lança AuthorityError('authority_insufficient', ...) quando insuficiente.
 */
export function checkAuthorityLevel(
  userLevel: string,
  requiredLevel: string,
  action?: string,
): void {
  const userRank = authorityRank(userLevel);
  const requiredRank = authorityRank(requiredLevel);

  if (userRank < requiredRank) {
    throw new AuthorityError(
      'authority_insufficient',
      `Autoridade insuficiente para ${action ?? 'ação'}: ` +
        `${userLevel} (rank ${userRank}) < ${requiredLevel} (rank ${requiredRank}).`,
    );
  }
}

/**
 * Verifica se o clearance do usuário atinge o piso exigido pelo recurso.
 * Lança AuthorityError('clearance_below_floor', ...) quando abaixo do piso.
 */
export function checkClearanceFloor(
  userClearance: string,
  requiredClearance: string,
  resource?: string,
): void {
  const userRank = clearanceRank(userClearance);
  const requiredRank = clearanceRank(requiredClearance);

  if (userRank < requiredRank) {
    throw new AuthorityError(
      'clearance_below_floor',
      `Clearance abaixo do piso para ${resource ?? 'recurso'}: ` +
        `${userClearance} (rank ${userRank}) < ${requiredClearance} (rank ${requiredRank}).`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Separação de funções                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Funções no modelo de segregação de deveres (SoD).
 * Uma mesma pessoa não pode acumular funções incompatíveis numa única
 * transação: quem solicita não aprova, quem aprova não provisiona,
 * quem provisiona não solicita nem aprova.
 */
export type Duty = 'solicitante' | 'aprovador' | 'provisionador';

/**
 * Mapeia cada ação às funções que ela exige e às que são incompatíveis com
 * o autor da ação (para evitar auto-aprovação e auto-provisão).
 */
export interface DutyPolicy {
  /** Ação sendo executada (ex.: 'criar_solicitacao', 'aprovar_solicitacao') */
  action: string;
  /** Funções necessárias para executar a ação (pelo menos uma) */
  required: Duty[];
  /** Funções incompatíveis com o ator nesta transação */
  incompatible: Duty[];
  /** ID da entidade sob análise (ex.: ID da solicitação), quando aplicável */
  entityId?: string;
}

/**
 * Resultado da verificação de segregação de funções.
 */
export interface SegregationResult {
  allowed: boolean;
  actorDuties: Duty[];
  conflicts: Duty[];
}

/**
 * Verifica separação de funções para um ator.
 *
 * Regras de negócio aplicadas:
 *  - solicitante: só pode criar solicitações. Não pode aprovar nem provisionar
 *    uma solicitação que ele próprio solicitou.
 *  - aprovador: só pode aprovar solicitações de OUTROS usuários. Não pode
 *    aprovar a própria solicitação nem provisionar.
 *  - provisionador: só pode executar provisão de solicitações já aprovadas.
 *    Não pode solicitar nem aprovar a mesma solicitação.
 *
 * Lança AuthorityError('separation_of_duties', ...) em caso de conflito.
 */
export function checkSeparationOfDuties({
  actorDuties,
  policy,
}: {
  /** Funções que o ator detém no contexto da organização */
  actorDuties: Duty[];
  policy: DutyPolicy;
}): SegregationResult {
  const conflicts: Duty[] = [];

  // O ator detém alguma função incompatível com a ação?
  for (const duty of actorDuties) {
    if (policy.incompatible.includes(duty)) {
      conflicts.push(duty);
    }
  }

  // O ator detém pelo menos uma função exigida?
  const hasRequired = policy.required.some((d) => actorDuties.includes(d));
  if (!hasRequired) {
    conflicts.push(...policy.required.filter((d) => !actorDuties.includes(d)));
  }

  if (conflicts.length > 0) {
    throw new AuthorityError(
      'separation_of_duties',
      `Separação de funções violada para '${policy.action}: ` +
        `conflito em ${conflicts.join(', ')}.`,
    );
  }

  return { allowed: true, actorDuties, conflicts: [] };
}

/**
 * Helper: constrói as funções do ator com base em seus papéis organizacionais.
 * Mapeia papéis conhecidos do NettosCorp para duties de SoD.
 */
export function dutiesFromRoles(roles: string[]): Duty[] {
  const duties: Duty[] = [];
  const roleSet = new Set(roles);

  // Direção e gestão podem aprovar; não devem solicitar operações próprias.
  if (
    roleSet.has('direcao_executiva') ||
    roleSet.has('gestor') ||
    roleSet.has('financeiro')
  ) {
    duties.push('aprovador');
  }

  // RH, operações, desenvolvimento e TI provisionam recursos.
  if (
    roleSet.has('rh') ||
    roleSet.has('operacoes') ||
    roleSet.has('desenvolvimento') ||
    roleSet.has('ia')
  ) {
    duties.push('provisionador');
  }

  // Qualquer usuário autenticado pode solicitar.
  duties.push('solicitante');

  return duties;
}
