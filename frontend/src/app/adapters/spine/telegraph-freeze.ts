// ============================================================================
// Telegraph Freeze Manager - Handles attack telegraph visual freezes
// 
// PRESENTER-ONLY: Visual freeze behavior during telegraph phase
// 
// NEW ARCHITECTURE (Simplified):
// - Telegraph config lives in attack-data.ts: telegraph.freezeAtSpineFrame, telegraph.freezeDurationMs
// - Animation plays to freezeAtSpineFrame, then PAUSES for freezeDurationMs
// - Core tracks total time, presenter just needs to know when to freeze
// - Freeze threshold = freezeAtSpineFrame / 30 seconds (Spine runs at 30fps)
// - Unfreeze when core transitions to attack state
// ============================================================================

import type { AttackId } from '../../core/attack-types';
import { getAttackData } from '../attack-resolver';

interface TelegraphFreezeState {
  isActive: boolean;          // Currently in telegraph state
  attackId: AttackId;         // Which attack is charging
  accumulatedTime: number;    // Time elapsed since telegraph start (seconds)
  freezeThreshold: number;    // When to freeze (seconds) = freezeAtSpineFrame / 30
  isFrozen: boolean;          // Already frozen (idempotent)
}

/**
 * Telegraph Freeze Manager
 * 
 * Simplified architecture:
 * 1. startTelegraph() → get freezeAtSpineFrame from attack-data, calculate threshold
 * 2. update(delta) → increment accumulator, freeze when threshold reached
 * 3. isFrozen() → return freeze status (presenter uses this to stop animation)
 * 4. endTelegraph() → clear state (when core transitions to attack)
 */
export class TelegraphFreezeManager {
  private state: Map<number, TelegraphFreezeState> = new Map();
  
  /**
   * Start telegraph freeze tracking
   * Reads telegraph config directly from attack-data
   */
  startTelegraph(fighterId: number, attackId: AttackId, characterId: string = 'stickman'): void {
    // Get telegraph config from attack-data (new location)
    const attackConfig = getAttackData(characterId, attackId);
    
    if (!attackConfig?.telegraph) {
      // No telegraph config - no freeze
      this.state.delete(fighterId);
      return;
    }
    
    const { freezeAtSpineFrame, freezeDurationMs } = attackConfig.telegraph;
    
    // Only enable freeze if there's a duration
    if (!freezeDurationMs || freezeDurationMs <= 0) {
      this.state.delete(fighterId);
      return;
    }
    
    // Freeze threshold = time to reach Spine frame (Spine: 30fps → seconds)
    const freezeThreshold = freezeAtSpineFrame / 30;
    
    // Initialize freeze state
    this.state.set(fighterId, {
      isActive: true,
      attackId,
      accumulatedTime: 0,
      freezeThreshold,
      isFrozen: false,
    });
    
    console.log(
      `[TelegraphFreeze] ▶️ Fighter ${fighterId}: Started tracking`,
      `attack="${attackId}"`,
      `freezeAtSpineFrame=${freezeAtSpineFrame}`,
      `freezeDurationMs=${freezeDurationMs}`
    );
  }
  
  /**
   * Update telegraph freeze timer
   * Call every frame during telegraph (from render loop)
   */
  update(fighterId: number, delta: number): void {
    const freezeState = this.state.get(fighterId);
    if (!freezeState || !freezeState.isActive) return;
    
    // Already frozen? Nothing to update
    if (freezeState.isFrozen) return;
    
    // Accumulate time
    freezeState.accumulatedTime += delta;
    
    // Check if we reached freeze threshold
    if (freezeState.accumulatedTime >= freezeState.freezeThreshold) {
      freezeState.isFrozen = true;
      
      console.log(
        `[TelegraphFreeze] 🧊 Fighter ${fighterId}: FROZE`,
        `at frame ${Math.round(freezeState.accumulatedTime * 60)}`
      );
    }
  }
  
  /**
   * End telegraph freeze
   * Called when core transitions to attack state
   */
  endTelegraph(fighterId: number): void {
    const freezeState = this.state.get(fighterId);
    if (!freezeState) return;
    
    console.log(
      `[TelegraphFreeze] ⏹️ Fighter ${fighterId}: Released`,
      `wasFrozen=${freezeState.isFrozen}`
    );
    
    this.state.delete(fighterId);
  }
  
  /**
   * Check if fighter is currently frozen
   * Presenter checks this to pass delta=0 to animation
   */
  isFrozen(fighterId: number): boolean {
    return this.state.get(fighterId)?.isFrozen ?? false;
  }
  
  /**
   * Check if fighter is in active telegraph tracking
   */
  isActive(fighterId: number): boolean {
    return this.state.has(fighterId);
  }
  
  /**
   * Reset all state
   */
  resetAll(): void {
    this.state.clear();
  }
}
