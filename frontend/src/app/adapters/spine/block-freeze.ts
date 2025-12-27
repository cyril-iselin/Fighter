// ============================================================================
// Block Freeze Controller - Presenter-only Block Hold Behavior
// Handles "play once -> freeze pose -> release continues" pattern
// 
// PRESENTER-ONLY: Visual behavior for block animations
// - Core determines WHEN to block (state machine logic)
// - Presenter determines HOW to show block (animation freeze)
// - No gameplay logic here - only visual polish!
// ============================================================================

import type * as spine from '@esotericsoftware/spine-webgl';
import type { FighterState } from '../../core/types';
import { freeze, unfreeze, isAtEnd, isFrozen } from './track-controls';

/**
 * Per-fighter block freeze state
 */
interface BlockFreezeState {
  isApplied: boolean;  // Whether freeze has been applied this block cycle
}

/**
 * Block Freeze Manager
 * Tracks block freeze state per fighter and applies freeze logic
 */
export class BlockFreezeManager {
  private state: Map<number, BlockFreezeState> = new Map();

  /**
   * Apply block freeze logic for a fighter
   * Call this every frame in updateAnimation
   */
  applyBlockFreeze(
    fighterId: number,
    coreState: FighterState,
    animationState: spine.AnimationState
  ): void {
    const trackEntry = animationState.getCurrent(0);
    if (!trackEntry) return;

    // Get or create freeze state for this fighter
    let freezeState = this.state.get(fighterId);
    if (!freezeState) {
      freezeState = { isApplied: false };
      this.state.set(fighterId, freezeState);
    }

    if (coreState === 'block') {
      // Block active: Apply freeze when animation reaches end
      if (!freezeState.isApplied && isAtEnd(trackEntry)) {
        freeze(trackEntry);
        freezeState.isApplied = true;
      }
    } else {
      // Not blocking: Ensure animation is unfrozen
      if (isFrozen(trackEntry)) {
        unfreeze(trackEntry);
      }
      freezeState.isApplied = false;
    }
  }

  /**
   * Reset freeze state for a fighter (e.g., on loadout change)
   */
  reset(fighterId: number): void {
    this.state.delete(fighterId);
  }

  /**
   * Reset all freeze states
   */
  resetAll(): void {
    this.state.clear();
  }
}
