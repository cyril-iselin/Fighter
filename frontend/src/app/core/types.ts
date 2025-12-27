// ============================================================================
// PRIMITIVES
// ============================================================================

export type Loadout = 'bare' | 'sword';
export type HitZone = 'top' | 'center';
export type FighterState = 
  | 'idle' 
  | 'move' 
  | 'jump' 
  | 'attack' 
  | 'telegraph'
  | 'block' 
  | 'hurt' 
  | 'dead';

export type AttackCommand = 'light' | 'heavy' | 'special';

// AttackId will be imported from attack-types (Generic type for all characters)
export type { AttackId } from './attack-types';

// ============================================================================
// INTENT (Input → Core)
// ============================================================================

export interface Intent {
  move: 'left' | 'right' | 'none';
  attack: AttackCommand | null;
  block: HitZone | null;
  jump: boolean;
  run: boolean;  // SHIFT modifier for faster movement
}

// ============================================================================
// OBSERVATION (Core → AI)
// ============================================================================

export interface Observation {
  self: FighterView;
  opponent: FighterView;
  distance: number;
}

export interface FighterView {
  characterId: string;  // Character definition ID
  state: FighterState;
  x: number;
  y: number;
  health: number;
  maxHealth: number;    // For phase calculations
  loadout: Loadout;
  facingRight: boolean;
  canAct: boolean;
  activeAttack: string | null;  // AttackId
  blockZone: HitZone | null;
}

// ============================================================================
// CORE STATE
// ============================================================================

export interface Fighter {
  id: 0 | 1;
  characterId: string;  // Character definition ID (e.g. 'stickman', 'knight')
  loadout: Loadout;
  state: FighterState;
  x: number;
  y: number;
  vx: number;        // Combined velocity (moveVx + impulseVx)
  vy: number;
  moveVx: number;    // Direct movement velocity (snappy, from intent)
  impulseVx: number; // Knockback velocity (physics damped)
  externalImpulseX: number;  // Knockback impulse, applied in physics step
  facingRight: boolean;
  health: number;
  maxHealth: number;           // Maximum health for this fighter
  specialMeter: number;
  maxSpecialMeter: number;     // Maximum special meter
  pressureMeter: number;  // AI only: increases when getting hit (0-100)
  maxPressureMeter: number;    // Maximum pressure meter
  pressureStunTicks: number;  // Remaining ticks in pressure stun state
  
  // Tick-Counter
  stateTicks: number;
  cooldownTicks: number;
  
  // Aktive Aktion
  activeAttack: string | null;  // AttackId
  attackZone: HitZone | null;
  blockZone: HitZone | null;
  
  // Combat Tracking
  attackInstanceId: number;        // Unique ID for each attack instance
  lastHitByInstanceId: number;     // Last attack instance that hit this fighter
  lastBlockPressTick: number;      // Tick when block was pressed (for parry window)
  isParryWindowActive: boolean;    // Is parry window currently active? (calculated in step)
  attackLandedHit: boolean;        // Did current attack land a hit? (for whiff detection)
  lastHitTick: number;             // Tick when this fighter last hit (for multi-hit interval)
  
  // Rage Burst Tracking (proximity-based boss mechanic)
  proximityTicks: number;          // Ticks player has been in proximity
  rageBurstCooldownTick: number;   // Tick until next rage burst allowed
  
  // Phase System (boss mechanic)
  speedMultiplier: number;         // Movement speed modifier (1.0 = normal)
  superArmorActive: boolean;       // Phase-based super armor (all attacks have super armor)
  telegraphOverrides?: Record<string, number>;  // Phase-based telegraph duration overrides (attackId → ms)
}

export interface MatchState {
  tick: number;
  fighters: [Fighter, Fighter];
}

// ============================================================================
// SNAPSHOT (= MatchState, für Net/Replay)
// ============================================================================

export type Snapshot = MatchState;

// ============================================================================
// STEP RESULT (State + Events getrennt)
// ============================================================================

export interface StepResult {
  state: MatchState;
  events: GameEvent[];
}

// ============================================================================
// EVENTS (transient, pro Tick)
// ============================================================================

export type GameEvent =
  // Combat
  | { type: 'hit'; attacker: 0 | 1; defender: 0 | 1; attack: string; zone: HitZone; damage: number }
  | { type: 'block'; defender: 0 | 1; attacker: 0 | 1; attack: string; zone: HitZone; damage: number; perfect: boolean }
  | { type: 'parry'; defender: 0 | 1; attacker: 0 | 1; attack: string; zone: HitZone; damage: number }
  | { type: 'stun'; fighter: 0 | 1; cause: 'pressure' }  // Pressure stun triggered
  | { type: 'rageBurst'; fighter: 0 | 1; target: 0 | 1 }  // Rage burst knockback
  | { type: 'phaseChange'; fighter: 0 | 1; phaseName: string; hpPercent: number }  // Boss phase change
  | { type: 'whiff'; attacker: 0 | 1; attack: string }
  // Attack Flow
  | { type: 'telegraph'; fighter: 0 | 1; attack: string }
  | { type: 'attackStart'; fighter: 0 | 1; attack: string }  // Telegraph → Attack transition
  // State
  | { type: 'stateChange'; fighter: 0 | 1; from: FighterState; to: FighterState }
  | { type: 'death'; fighter: 0 | 1 }
  // Movement (für Sound)
  | { type: 'jump'; fighter: 0 | 1 }
  | { type: 'land'; fighter: 0 | 1 }
  // Match Flow (für Sound/UI)
  | { type: 'fightStart' }
  | { type: 'fightWon'; winner: 0 | 1 }
  | { type: 'gameOver'; loser: 0 | 1 };
