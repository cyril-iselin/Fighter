import type { MatchState, Observation, FighterView } from '../core/types';

// ============================================================================
// OBSERVATION MAPPER (Pure Functions)
// ============================================================================

/**
 * Creates an Observation from MatchState for a specific fighter
 * Pure function - no side effects
 * @param state - Current match state
 * @param selfId - ID of the fighter observing (0 or 1)
 * @returns Observation for the AI brain
 */
export function createObservation(state: MatchState, selfId: 0 | 1): Observation {
  const opponentId = selfId === 0 ? 1 : 0;
  const self = state.fighters[selfId];
  const opponent = state.fighters[opponentId];

  return {
    self: mapToFighterView(self),
    opponent: mapToFighterView(opponent),
    distance: Math.abs(opponent.x - self.x),
  };
}

/**
 * Maps Fighter to FighterView (filtered data for AI)
 */
function mapToFighterView(fighter: any): FighterView {
  return {
    characterId: fighter.characterId,
    state: fighter.state,
    x: fighter.x,
    y: fighter.y,
    health: fighter.health,
    maxHealth: fighter.maxHealth,
    loadout: fighter.loadout,
    facingRight: fighter.facingRight,
    canAct: canAct(fighter),
    activeAttack: fighter.activeAttack,
    blockZone: fighter.blockZone,
  };
}

/**
 * Determines if fighter can accept new actions
 * Mirrors core/state-machine.ts logic (read-only)
 */
function canAct(fighter: any): boolean {
  return fighter.state === 'idle'
    || fighter.state === 'move'
    || fighter.state === 'jump'
    || fighter.state === 'block';
}
