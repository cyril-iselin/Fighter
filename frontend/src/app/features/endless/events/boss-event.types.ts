// ============================================================================
// BOSS EVENT TYPES
// ============================================================================
// Type definitions for the boss fight event system
// Events interrupt combat and present mini-challenges to the player
// ============================================================================

/**
 * Base interface for all boss events
 */
export interface BossEventBase {
  /** Unique identifier for this event instance */
  id: string;
  
  /** HP percentage threshold that triggers this event (0-100) */
  hpTrigger: number;
  
  /** Duration of the event in ticks (60 = 1 second) */
  durationTicks: number;
  
  /** Reward for completing the event successfully */
  successReward: EventReward;
  
  /** Penalty for failing the event */
  failPenalty: EventPenalty;
  
  /** Number of times player must succeed before getting reward (default: 1) */
  requiredSuccesses?: number;
  
  /** Announcement text shown when event starts (optional) */
  announcement?: string;
}

/**
 * Ground Circle Event
 * A circle appears on the ground - player must stand inside before time runs out
 * Spawns randomly in arena, alternating sides for multiple successes
 */
export interface GroundCircleEvent extends BossEventBase {
  type: 'ground-circle';
  
  /** Circle radius in game units */
  radius: number;
}

/**
 * Quick Dash Event
 * A marker appears - player must reach it before time runs out
 * Spawns randomly in arena
 */
export interface QuickDashEvent extends BossEventBase {
  type: 'quick-dash';
  
  /** Radius around marker that counts as "reached" */
  targetRadius: number;
  
  /** Height above ground (0 = ground, negative = in air, requires jump) */
  spawnHeight?: number;
}

/**
 * Dummy Wave Event
 * Sequential waves of dummy enemies spawn - player must defeat them all before time runs out
 * Dummies are defeated by attacking them
 */
export interface DummyWaveEvent extends BossEventBase {
  type: 'dummy-wave';
  
  /** IDs of dummy types to spawn (selected randomly from this pool) */
  dummyIds: string[];
  
  /** Total number of dummies to spawn in sequence */
  totalDummies: number;
  
  /** Ticks to wait after dummy death before spawning next one */
  spawnDelayTicks: number;
}

/**
 * Union type of all boss events
 */
export type BossEventDefinition = GroundCircleEvent | QuickDashEvent | DummyWaveEvent;

/**
 * Reward given when player successfully completes an event
 */
export interface EventReward {
  /** Stun boss for N ticks (allows free hits) */
  bossStunTicks?: number;
  
  /** Grant special meter (0-100) */
  specialMeter?: number;
  
  /** Heal player HP */
  healPlayer?: number;
  
  /** Deal damage to boss */
  bossDamage?: number;
}

/**
 * Penalty applied when player fails an event
 */
export interface EventPenalty {
  /** Damage dealt to player */
  playerDamage?: number;
  
  /** Stun player for N ticks */
  playerStunTicks?: number;
  
  /** Boss heals HP */
  bossHeal?: number;
  
  /** Boss gains temporary buff (speed multiplier) for N ticks */
  bossSpeedBuff?: { multiplier: number; durationTicks: number };
}

/**
 * Active event state during execution
 */
export interface ActiveBossEvent {
  /** The event definition being executed */
  definition: BossEventDefinition;
  
  /** Tick when the event started */
  startTick: number;
  
  /** Current tick progress */
  currentTick: number;
  
  /** World position of the event target (circle center, dash marker) */
  targetPosition: { x: number; y: number };
  
  /** Has player satisfied the success condition at any point? */
  conditionMet: boolean;
  
  /** Number of successful completions so far */
  successCount: number;
  
  /** Current phase of the event */
  phase: 'intro' | 'active' | 'resolving';
  
  /** Dummy wave specific state (only for dummy-wave events) */
  currentDummy?: DummyEventState;
  
  /** Number of dummies killed (only for dummy-wave events) */
  dummyKilledCount?: number;
  
  /** Ticks remaining before spawning next dummy (only for dummy-wave events) */
  spawnDelayCounter?: number;
}

/**
 * State for a single dummy in a dummy wave event
 */
export interface DummyEventState {
  /** Dummy ID for rendering */
  dummyId: string;
  
  /** World X position */
  x: number;
  
  /** World Y position (relative to ground) */
  y: number;
  
  /** Facing direction (1 = right, -1 = left) */
  facing: number;
  
  /** Current HP */
  hp: number;
  
  /** Maximum HP */
  maxHp: number;
  
  /** Is dummy still alive? */
  alive: boolean;
  
  /** Death animation ticks remaining (0 = animation complete) */
  deathAnimationTicks: number;
}

/**
 * Result of an event after resolution
 */
export interface BossEventResult {
  eventId: string;
  success: boolean;
  reward?: EventReward;
  penalty?: EventPenalty;
}

/**
 * Callback signatures for event system
 */
export interface BossEventCallbacks {
  /** Called when an event starts */
  onEventStart?: (event: ActiveBossEvent) => void;
  
  /** Called every tick during an active event */
  onEventTick?: (event: ActiveBossEvent) => void;
  
  /** Called when an event ends (success or fail) */
  onEventEnd?: (result: BossEventResult) => void;
  
  /** Called when a dummy needs to be spawned (dummy-wave only) */
  onDummySpawnRequest?: (dummyId: string, x: number, y: number, facing: number) => void;
  
  /** Called when a dummy dies (dummy-wave only) */
  onDummyDeath?: (dummyId: string, x: number, y: number) => void;
  
  /** Called when dummy death animation completes (dummy-wave only) */
  onDummyAnimationComplete?: () => void;
}
