import type { MatchState, GameEvent, Fighter } from '../core/types';
import { resolveAnimation, type AnimationKey } from './animation-resolver';

// ============================================================================
// PRESENTER CONSTANTS
// ============================================================================

/**
 * Movement epsilon - velocities below this threshold are treated as zero
 * Prevents idle/move animation flickering in the presenter layer
 * Core/AI are unaware of this value
 */
const MOVEMENT_EPSILON = 0.01;

// ============================================================================
// SPINE ADAPTER (State -> Animation Presenter)
// ============================================================================

/**
 * Adapter für Spine Animation Rendering
 * Keine Game-Logik, nur Mapping von Core State -> Spine Calls
 * Idempotent: gleicher State triggert nicht erneut
 */
export class SpineAdapter {
  private lastAnimationKeys: Map<number, string> = new Map();
  private lastLoadouts: Map<number, string> = new Map();
  private currentTimeScale = 1.0;
  private skeletons: SpineSkeleton[] = [];

  /**
   * Sets time scale for all animations (slow-motion support)
   * Only applies when scale actually changes
   */
  setTimeScale(scale: number): void {
    if (this.currentTimeScale === scale) return; // Skip if no change
    
    this.currentTimeScale = scale;
    // Apply to all currently tracked skeletons
    this.skeletons.forEach(skeleton => {
      if (skeleton) {
        skeleton.setTimeScale(scale);
      }
    });
  }

  /**
   * Applies match state to Spine skeletons
   * Only triggers animation changes when state actually changes (idempotent)
   */
  applySnapshot(state: MatchState, skeletons: SpineSkeleton[]): void {
    // Update skeleton references (for timeScale changes)
    this.skeletons = skeletons;
    
    state.fighters.forEach((fighter, index) => {
      const skeleton = skeletons[index];
      if (!skeleton) return;

      this.applyFighterState(fighter, skeleton);
    });
  }

  /**
   * Handles one-shot events (like jump sound triggers, hit effects)
   */
  handleEvents(events: GameEvent[], skeletons: SpineSkeleton[]): void {
    // Events are processed but don't change animation state
    // (could be used for particle effects, camera shake, etc. in the future)
    
    // For now, we only log them for debugging
    if (events.length > 0 && typeof console !== 'undefined') {
      // console.log('[SpineAdapter] Events:', events);
    }
  }

  private applyFighterState(fighter: Fighter, skeleton: SpineSkeleton): void {
    // Apply movement epsilon for presenter layer
    const effectiveVx = Math.abs(fighter.vx) < MOVEMENT_EPSILON ? 0 : fighter.vx;

    // Check if loadout changed
    const lastLoadout = this.lastLoadouts.get(fighter.id);
    if (lastLoadout !== fighter.loadout) {
      skeleton.setLoadout(fighter.loadout);
      this.lastLoadouts.set(fighter.id, fighter.loadout);
    }

    // Resolve animation for current state
    const anim = resolveAnimation(fighter.state, fighter.characterId, fighter.loadout, {
      activeAttack: fighter.activeAttack as any,  // Type assertion: fighter.activeAttack is AttackId | null
      blockZone: fighter.blockZone,
      attackZone: fighter.attackZone,
      facingRight: fighter.facingRight,
      vx: effectiveVx,  // Use epsilon-filtered velocity
      pressureStunTicks: fighter.pressureStunTicks,  // Pass pressure stun info for hurt animation loop
    });

    // Create unique key for idempotency check
    const animKey = `${anim.name}:${anim.loop}`;
    const lastKey = this.lastAnimationKeys.get(fighter.id);

    // Only trigger if animation changed
    if (lastKey !== animKey) {
      skeleton.setAnimation(anim.name, anim.loop);
      this.lastAnimationKeys.set(fighter.id, animKey);
    }

    // Always update position and facing (these are continuous)
    skeleton.setPosition(fighter.x, fighter.y);
    skeleton.setFlip(fighter.facingRight);
  }
}

// ============================================================================
// SPINE SKELETON INTERFACE (for dependency injection)
// ============================================================================

/**
 * Interface for Spine Skeleton (to avoid direct Spine dependency in adapter)
 * Actual implementation will wrap Spine.Skeleton
 */
export interface SpineSkeleton {
  /**
   * Sets animation on track 0
   * @param name - Animation name (must match Spine JSON)
   * @param loop - Whether animation should loop
   */
  setAnimation(name: string, loop: boolean): void;

  /**
   * Sets skeleton position
   */
  setPosition(x: number, y: number): void;

  /**
   * Sets horizontal flip
   * @param facingRight - true = not flipped, false = flipped
   */
  setFlip(facingRight: boolean): void;
  
  /**
   * Sets animation time scale for slow-motion effects
   * @param scale - 1.0 = normal, 0.5 = half speed, 2.0 = double speed
   */
  setTimeScale(scale: number): void;
  
  /**
   * Sets loadout (controls character-specific attachments/slots)
   * @param loadout - Loadout identifier (e.g., 'bare', 'sword', etc.)
   */
  setLoadout(loadout: string): void;
}
