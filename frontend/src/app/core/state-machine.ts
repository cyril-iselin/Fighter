import type { Fighter, FighterState, GameEvent } from './types';

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

/**
 * Allowed state transitions map
 * Key: current state, Value: array of allowed next states
 */
const ALLOWED_TRANSITIONS: Record<FighterState, FighterState[]> = {
  idle: ['move', 'jump', 'block', 'telegraph', 'hurt', 'dead'],
  move: ['idle', 'jump', 'block', 'telegraph', 'hurt', 'dead'],
  jump: ['idle', 'telegraph', 'hurt', 'dead'],  // Can attack while jumping (aerial attacks)
  block: ['idle', 'hurt', 'dead'],
  telegraph: ['attack', 'hurt', 'dead'],  // telegraph -> attack (after charge)
  attack: ['hurt', 'dead'],
  hurt: ['idle', 'block', 'dead'],  // Can block during hurt to reduce follow-up damage
  dead: [],  // Terminal state
};

/**
 * Checks if transition is allowed
 */
export function canTransition(from: FighterState, to: FighterState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Attempts to transition fighter to new state
 * Returns event if successful, null otherwise
 */
export function transitionState(
  fighter: Fighter, 
  newState: FighterState
): GameEvent | null {
  if (fighter.state === newState) {
    return null;  // Already in this state
  }
  
  if (!canTransition(fighter.state, newState)) {
    return null;  // Transition not allowed
  }
  
  const oldState = fighter.state;
  fighter.state = newState;
  fighter.stateTicks = 0;  // Reset state timer
  
  return {
    type: 'stateChange',
    fighter: fighter.id,
    from: oldState,
    to: newState,
  };
}

/**
 * Force transition (used for interrupts like hurt/death)
 */
export function forceTransition(
  fighter: Fighter,
  newState: FighterState
): GameEvent {
  const oldState = fighter.state;
  fighter.state = newState;
  fighter.stateTicks = 0;
  
  // Clear active actions
  if (newState === 'hurt' || newState === 'dead') {
    fighter.activeAttack = null;
    fighter.attackZone = null;
  }
  
  // Only clear block on death
  if (newState === 'dead') {
    fighter.blockZone = null;
  }
  
  return {
    type: 'stateChange',
    fighter: fighter.id,
    from: oldState,
    to: newState,
  };
}

/**
 * Checks if fighter can act (accept new intents)
 */
export function canAct(fighter: Fighter): boolean {
  return fighter.state === 'idle' 
    || fighter.state === 'move' 
    || fighter.state === 'jump'
    || fighter.state === 'block';
}

/**
 * Determines if movement intent should set move state
 */
export function shouldMove(fighter: Fighter, hasMovementIntent: boolean): boolean {
  // Must be able to act and have movement intent
  if (!canAct(fighter) || !hasMovementIntent) {
    return false;
  }
  
  // Already moving or can transition to move
  return fighter.state === 'move' || fighter.state === 'idle' || fighter.state === 'jump';
}

/**
 * Determines if fighter should return to idle
 */
export function shouldIdle(fighter: Fighter, hasAnyIntent: boolean): boolean {
  // No intent and in a state that can idle
  if (hasAnyIntent) {
    return false;
  }
  
  return fighter.state === 'move' || fighter.state === 'block';
}
