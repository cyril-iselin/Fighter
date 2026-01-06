import type { MatchState, StepResult, Intent, Loadout, Fighter, GameEvent } from './types';
import { HEALTH_MAX, SPECIAL_METER_MAX, PRESSURE_METER_MAX, PHYSICS, HURT_TICKS, PRESSURE_STUN_TICKS, PARRY_WINDOW_TICKS } from './config';
import { resolveAttack } from '../adapters/attack-resolver';
import { getAttackData } from '../adapters/attack-resolver';
import * as Physics from './physics';
import * as StateMachine from './state-machine';
import * as Combat from './rules/attack-rules';
import type { BufferManager } from './buffer-manager';

// ============================================================================
// STEP (Haupt-Simulationsfunktion)
// ============================================================================

/**
 * Deterministischer Tick-Step
 * Input: aktueller State + 2 Intents + BufferManager
 * Output: neuer State + Events
 */
export function step(
  state: MatchState,
  intents: [Intent, Intent],
  bufferManager: BufferManager,
  bossInteractionEnabled: boolean = true
): StepResult {
  // Deep clone state (simple approach for now)
  const newState: MatchState = {
    tick: state.tick + 1,
    fighters: [
      deepCloneFighter(state.fighters[0]),
      deepCloneFighter(state.fighters[1]),
    ],
  };

  const events: GameEvent[] = [];
  const [f0, f1] = newState.fighters;
  const [intent0, intent1] = intents;

  // === PHASE 1: Apply Intents (State Transitions + Buffer) ===
  applyIntent(f0, intent0, events, newState.tick, bufferManager.getBuffer(0));
  applyIntent(f1, intent1, events, newState.tick, bufferManager.getBuffer(1));

  // === PHASE 2: Combat State Progression ===
  events.push(...Combat.progressAttackState(f0));
  events.push(...Combat.progressAttackState(f1));

  // === PHASE 3: Hit Detection ===
  // NOTE: Hit detection moved to game loop (bone-driven)
  // Game loop calls checkBoneHit() with sampled bone positions
  // Whiff detection happens in progressAttackState() when attack ends without hit

  // === PHASE 4: Physics Update (after intent processing) ===
  // Gravity AFTER input processing (so jump velocity isn't immediately cancelled)
  Physics.applyGravity(f0);
  Physics.applyGravity(f1);

  // Vertical movement
  Physics.applyVerticalVelocity(f0);
  Physics.applyVerticalVelocity(f1);

  // Landing detection
  if (Physics.checkLanding(f0)) {
    const event = StateMachine.transitionState(f0, 'idle');
    if (event) events.push(event);
    events.push({ type: 'land', fighter: 0 });
  }
  if (Physics.checkLanding(f1)) {
    const event = StateMachine.transitionState(f1, 'idle');
    if (event) events.push(event);
    events.push({ type: 'land', fighter: 1 });
  }

  // Ground clamping
  Physics.clampToGround(f0);
  Physics.clampToGround(f1);

  // Horizontal movement
  Physics.applyMovement(f0);
  Physics.applyMovement(f1);

  // Position constraints
  Physics.clampToArenaBounds(f0);
  Physics.clampToArenaBounds(f1);
  
  // Boss interaction (facing/collision) - disabled during boss events
  if (bossInteractionEnabled) {
    Physics.enforceMinDistance(f0, f1);
    Physics.updateFacing(f0, f1);
  }

  // === PHASE 5: Tick Counters ===
  tickCounters(f0, newState.tick);
  tickCounters(f1, newState.tick);

  // === PHASE 6: Auto-Transitions (Hurt -> Idle) ===
  autoTransitions(f0, events);
  autoTransitions(f1, events);

  return {
    state: newState,
    events,
  };
}

// ============================================================================
// INTENT APPLICATION
// ============================================================================

function applyIntent(
  fighter: Fighter,
  intent: Intent,
  events: GameEvent[],
  currentTick: number,
  buffer: import('./input-buffer').InputBuffer
): void {
  // === PRESSURE STUN CHECK ===
  // During pressure stun, no actions allowed at all (complete paralysis)
  if (fighter.pressureStunTicks > 0) {
    return;
  }
  
  // === PRIORITY ORDER: Block > Jump > Attack > Movement ===
  // Reason: Attacks should interrupt movement, but defense interrupts everything
  
  // === STEP 1: Block (highest priority - defense always available) ===
  if (intent.block !== null) {
    // Block has special priority - can be activated from ANY state (even hurt)
    // This allows defensive play during hitstun to reduce follow-up damage
    const canBlock = fighter.state !== 'dead';
    
    if (canBlock) {
      // Cancel any ongoing attack
      if (fighter.activeAttack) {
        Combat.executeCancelIntoMovement(fighter);
      }
      
      const wasHoldingBlock = fighter.blockZone !== null;  // Was block button held?
      const event = StateMachine.transitionState(fighter, 'block');
      if (event) events.push(event);

      // Track block press for parry window
      // Only set parry window on INITIAL block press (blockZone was null)
      // Not when returning from hurt state while holding block button
      if (!wasHoldingBlock) {
        fighter.lastBlockPressTick = currentTick;
        fighter.isParryWindowActive = true;  // Start parry window
      }

      fighter.blockZone = intent.block;
      fighter.moveVx = 0; // No sliding during block
      return;
    }
  } else {
    // Block was released - clear blockZone (regardless of current state)
    // This ensures blockZone is cleared even if released during hurt state
    if (fighter.blockZone !== null) {
      fighter.blockZone = null;
      
      // Return to idle only if currently in block state
      if (fighter.state === 'block') {
        const event = StateMachine.transitionState(fighter, 'idle');
        if (event) events.push(event);
      }
    }
    // Don't return - allow other inputs to be processed
  }

  // === STEP 2: Jump (high priority - mobility) ===
  if (intent.jump && Physics.isOnGround(fighter)) {
    // Check if can cancel current action into jump
    const canCancelJump = Combat.canCancelIntoJump(fighter);
    if (canCancelJump) {
      Combat.executeCancelIntoMovement(fighter);  // Clear attack state
    }
    
    // Execute jump if allowed (can act normally OR just canceled)
    if (StateMachine.canAct(fighter) || canCancelJump) {
      const event = StateMachine.transitionState(fighter, 'jump');
      if (event) {
        events.push(event);
        events.push({ type: 'jump', fighter: fighter.id });
        // Set negative jump velocity (up in screen coords)
        fighter.vy = -PHYSICS.jumpVelocity;
      }
      return;
    }
  }

  // === STEP 3: Attack (interrupts movement) ===
  
  // Check for buffered attack cancel
  if (Combat.canCancelIntoAttack(fighter)) {
    const bufferedCommand = buffer.consume(currentTick);
    if (bufferedCommand) {
      // Execute buffered attack cancel
      const attackId = resolveAttack(fighter.characterId, fighter.loadout, bufferedCommand, { state: fighter.state });
      if (attackId) {
        events.push(...Combat.executeCancelIntoAttack(fighter, attackId, currentTick));
        return;
      }
    }
  }
  
  // Handle new attack input
  if (intent.attack !== null) {
    // If fighter is busy, try to buffer
    if (!StateMachine.canAct(fighter)) {
      if (fighter.activeAttack) {
        // Simple approach: no attack canceling for now
        return;
      }
      return;
    }

    // Check cooldown
    if (fighter.cooldownTicks > 0) {
      return;
    }

    // Execute attack
    const attackId = resolveAttack(fighter.characterId, fighter.loadout, intent.attack, { state: fighter.state });
    if (attackId) {
      // Check if special attack requires full meter
      const attackConfig = getAttackData(fighter.characterId, attackId);
      if (attackConfig.command === 'special' && fighter.specialMeter < 100) {
        return; // Can't use special attack without full meter
      }
      
      // Consume special meter when using special attack
      if (attackConfig.command === 'special') {
        fighter.specialMeter = 0;
      }
      
      events.push(...Combat.startAttack(fighter, attackId, currentTick));
      return;
    }
  }

  // === STEP 4: Movement (lowest priority) ===
  const hasMovementIntent = intent.move !== 'none';
  if (hasMovementIntent) {
    // Check if can cancel current action into movement
    const canCancelMove = Combat.canCancelIntoMovement(fighter);
    if (canCancelMove) {
      Combat.executeCancelIntoMovement(fighter);  // Clear attack state
    }
    
    // Execute movement if allowed (can act normally OR just canceled)
    if (StateMachine.canAct(fighter) || canCancelMove) {
      const event = StateMachine.transitionState(fighter, 'move');
      if (event) events.push(event);

      const direction = intent.move === 'left' ? -1 : 1;
      const baseSpeed = intent.run ? PHYSICS.walkSpeed * 2.0 : PHYSICS.walkSpeed;
      const speed = baseSpeed * (fighter.speedMultiplier ?? 1.0);
      fighter.moveVx = direction * speed; // Set direct movement velocity (phase-modified)
      return;
    }
  }

  // === No Movement Intent - Clear moveVx ===
  if (!hasMovementIntent) {
    fighter.moveVx = 0; // Stop movement immediately
    
    if (StateMachine.shouldIdle(fighter, false)) {
      const event = StateMachine.transitionState(fighter, 'idle');
      if (event) events.push(event);
    }
  }
}

// ============================================================================
// COUNTER MANAGEMENT
// ============================================================================

function tickCounters(fighter: Fighter, currentTick: number): void {
  fighter.stateTicks++;

  if (fighter.cooldownTicks > 0) {
    fighter.cooldownTicks--;
  }
  
  // Pressure stun countdown (AI only)
  if (fighter.pressureStunTicks > 0) {
    fighter.pressureStunTicks--;
    
    // Reset pressure meter after stun ends
    if (fighter.pressureStunTicks === 0) {
      fighter.pressureMeter = 0;
    }
  }
  
  // Parry window expiration
  if (fighter.isParryWindowActive) {
    const ticksSinceBlockStart = currentTick - fighter.lastBlockPressTick;
    if (ticksSinceBlockStart > PARRY_WINDOW_TICKS) {
      fighter.isParryWindowActive = false;
    }
  }
}

// ============================================================================
// AUTO-TRANSITIONS
// ============================================================================

function autoTransitions(fighter: Fighter, events: GameEvent[]): void {
  // Hurt -> Idle (but not during pressure stun)
  if (fighter.state === 'hurt' && fighter.stateTicks >= HURT_TICKS && fighter.pressureStunTicks === 0) {
    const event = StateMachine.transitionState(fighter, 'idle');
    if (event) events.push(event);
  }
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Erstellt initialen MatchState mit zwei Fighters
 */
export function createInitialState(
  loadouts: [Loadout, Loadout],
  characterIds: [string, string] = ['stickman', 'stickman']
): MatchState {
  const fighter0: Fighter = createFighter(0, loadouts[0], 400, characterIds[0]);
  const fighter1: Fighter = createFighter(1, loadouts[1], 1520, characterIds[1]);

  return {
    tick: 0,
    fighters: [fighter0, fighter1],
  };
}

function createFighter(id: 0 | 1, loadout: Loadout, x: number, characterId: string = 'stickman'): Fighter {
  return {
    id,
    characterId,
    loadout,
    state: 'idle',
    x,
    y: PHYSICS.groundY,
    vx: 0,
    vy: 0,
    moveVx: 0,
    impulseVx: 0,
    externalImpulseX: 0,
    facingRight: id === 0,
    health: HEALTH_MAX,
    maxHealth: HEALTH_MAX,
    specialMeter: 0,
    maxSpecialMeter: SPECIAL_METER_MAX,
    pressureMeter: 0,
    maxPressureMeter: PRESSURE_METER_MAX,
    pressureStunTicks: 0,
    stateTicks: 0,
    cooldownTicks: 0,
    activeAttack: null,
    attackZone: null,
    blockZone: null,
    attackInstanceId: 0,
    lastHitByInstanceId: -1,
    lastBlockPressTick: -99999,  // Very negative to prevent accidental parry at match start
    isParryWindowActive: false,   // Set when block pressed, cleared after PARRY_WINDOW_TICKS
    attackLandedHit: false,       // Whiff detection
    lastHitTick: -1,             // Multi-hit interval tracking
    proximityTicks: 0,           // Rage burst proximity tracking
    rageBurstCooldownTick: 0,    // Rage burst cooldown
    speedMultiplier: 1.0,        // Phase system speed modifier
    superArmorActive: false,     // Phase-based super armor
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function deepCloneFighter(fighter: Fighter): Fighter {
  return {
    ...fighter,
  };
}
