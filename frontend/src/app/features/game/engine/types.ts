// ============================================
// Engine Types - Spine & Fighter Type Definitions
// ============================================

export type Loadout = 'bare' | 'sword';

// Where an attack lands (used by combat detection)
export type HitRegion = 'head' | 'body';

// Where to block/react (used by block input and hurt animations)
export type BlockZone = 'top' | 'center' | 'bottom';

// Legacy alias - prefer BlockZone for new code
export type HitZone = BlockZone;

export type JumpVariant = 'A' | 'B' | 'C' | 'D';

export type DeathVariant = 'A' | 'B';

export type MoveDirection = 'left' | 'right' | 'none';

export enum FighterState {
  Idle = 'idle',
  Move = 'move',
  Block = 'block',
  Attack = 'attack',
  Hurt = 'hurt',
  Dead = 'dead',
  Jump = 'jump'
}

export type BareAttack = 
  | 'jab_single' | 'jab_double' | 'jab_high_single' | 'jab_high_double'
  | 'kick_high' | 'kick_low' | 'kick_straight'
  | 'uppercut' | 'flying_kick' | 'salto_kick' 
  | 'thousand_fists' | 'reverse_kick';

export type SwordAttack = 'slash_light' | 'slash_heavy';

export interface AnimationEntry {
  name: string;
  loop: boolean;
  mixDuration?: number;
}

export interface LoadoutAnimations {
  // Idle states
  idle: string;
  idleActive: string;
  idleFightPose: string;
  
  // Movement
  walkNormal: string;
  walkFightPose: string;
  run: string;
  runStop: string;
  
  // Jumps - takeoff (short absprung animations)
  jumpTakeoffA: string;
  jumpTakeoffB: string;
  jumpTakeoffC: string;
  jumpTakeoffD: string;
  // Jumps - main air animations
  jumpA: string;
  jumpB: string;
  jumpC: string;
  jumpD: string;
  
  // Block (by zone)
  blockTop: string;
  blockCenter: string;
  
  // Hurt (by zone)
  hurtTop: string;
  hurtCenter: string;
  
  // Death
  dieA: string;
  dieB: string;
  
  // Attacks (loadout-specific)
  attacks: Record<string, string>;
}

export interface SpinePlayer {
  setAnimation(trackIndex: number, animationName: string, loop: boolean): SpineTrackEntry;
  addAnimation(trackIndex: number, animationName: string, loop: boolean, delay: number): SpineTrackEntry;
  setEmptyAnimation(trackIndex: number, mixDuration: number): void;
  clearTrack(trackIndex: number): void;
  clearTracks(): void;
  getCurrent(trackIndex: number): SpineTrackEntry | null;
  setFacingRight(facingRight: boolean): void;
  setTimeScale(trackIndex: number, scale: number): void;
  getCurrentAnimation(trackIndex: number): SpineTrackEntry | null;
  getAttackBonePositions(): { 
    rightHand: { x: number; y: number } | null;
    leftHand: { x: number; y: number } | null;
    rightFoot: { x: number; y: number } | null;
    leftFoot: { x: number; y: number } | null;
    weapon: { x: number; y: number } | null;
    weaponLine: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  };
  getHurtboxPositions(): {
    head: { x: number; y: number; radius: number } | null;
    body: { x: number; y: number; width: number; height: number } | null;
  };
}

export interface SpineTrackEntry {
  animationEnd: number;
  trackTime: number;
  animation: { name: string };
  listener?: {
    complete?: () => void;
    end?: () => void;
  };
  // Set to true to hold the animation at the last frame
  holdPrevious: boolean;
}

export interface FighterControllerConfig {
  spine: SpinePlayer;
  playerId: number;
  defaultLoadout?: Loadout;
  defaultMixDuration?: number;
  
  // Initial position
  startX?: number;
  startY?: number;
  
  // World boundaries
  minX?: number;
  maxX?: number;
  groundY?: number;
  
  // Initial facing direction
  facingRight?: boolean;
  
  // Bonus multipliers (campaign mode)
  speedMultiplier?: number;  // 1.0 = normal
  jumpMultiplier?: number;   // 1.0 = normal
  
  // Special meter check callback (player only)
  canUseSpecial?: () => boolean;
  onSpecialUsed?: () => void;
}
