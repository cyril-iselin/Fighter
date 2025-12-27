// ============================================================================
// Spine Track Controls - Low-level Animation Track Helpers
// Pure functions for manipulating Spine TrackEntry
// 
// PRESENTER-ONLY: These functions control VISUAL BEHAVIOR, not gameplay logic!
// - Animation freezes/holds are presentation details
// - Core tick timings are the source of truth for gameplay
// - Spine animation durations are reference only, not enforced
// ============================================================================

import type * as spine from '@esotericsoftware/spine-webgl';

/**
 * Visual threshold for "animation near end" detection
 * Used by block freeze to hold pose smoothly
 * This is a PRESENTATION detail, not a gameplay parameter
 */
const ANIMATION_END_THRESHOLD = 0.02; // 2% tolerance for "at end" check

/**
 * Check if animation track is at the end
 */
export function isAtEnd(entry: spine.TrackEntry): boolean {
  if (!entry || entry.animationEnd <= 0) return false;
  
  const remaining = entry.animationEnd - entry.trackTime;
  return remaining <= ANIMATION_END_THRESHOLD;
}

/**
 * Freeze animation at current frame
 */
export function freeze(entry: spine.TrackEntry): void {
  if (entry) {
    entry.timeScale = 0;
  }
}

/**
 * Unfreeze animation (resume normal playback)
 */
export function unfreeze(entry: spine.TrackEntry): void {
  if (entry) {
    entry.timeScale = 1;
  }
}

/**
 * Check if animation is currently frozen
 */
export function isFrozen(entry: spine.TrackEntry): boolean {
  return entry && entry.timeScale === 0;
}
