// ============================================================================
// STICKMAN ANIMATION MAPPING (Single Source of Truth for Spine Animation Names)
// ============================================================================
// Maps Core State + Context -> Spine Animation Name
// All animation names must match exactly what's in the Spine JSON
// ============================================================================

import type { Loadout, HitZone } from '../../../core/types';

// Base idle animations
export const IDLE_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/idle active',
  sword: '2_Sword/idle active',
};

// Movement animations (using walk fight pose as default walk)
export const MOVE_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/walk fight pose',
  sword: '2_Sword/walk fight pose',
};

// Run animations (sprint with SHIFT)
export const RUN_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/run',
  sword: '2_Sword/run',
};

// Jump animations (using variant A as default for MVP)
export const JUMP_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/jump A',
  sword: '2_Sword/jump A',
};

// Block animations by zone
export const BLOCK_ANIMATIONS: Record<Loadout, Record<HitZone, string>> = {
  bare: {
    top: '1_/block top',
    center: '1_/block center',
  },
  sword: {
    top: '2_Sword/block top',
    center: '2_Sword/block center',
  },
};

// Hurt animations by zone
export const HURT_ANIMATIONS: Record<Loadout, Record<HitZone, string>> = {
  bare: {
    top: '1_/hurt top',
    center: '1_/hurt center',
  },
  sword: {
    top: '2_Sword/hurt top',
    center: '2_Sword/hurt center',
  },
};

// Death animations (using variant A as default)
export const DEATH_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/die A',
  sword: '2_Sword/die A',
};

// Attack animations (Bare-handed)
export const BARE_ATTACK_ANIMATIONS: Record<string, string> = {
  jab_single: '1_/jab single',
  jab_double: '1_/jab double',
  jab_high_single: '1_/jab high single',
  jab_high_double: '1_/jab high double',
  kick_high: '1_/kick high',
  kick_low: '1_/kick low',
  kick_straight: '1_/kick straight',
  flying_kick: '1_/flying kick',
  salto_kick: '1_/salto kick',
  thousand_fists: '1_/thousand fists',
  reverse_kick: '1_/reverse kick',
};

// Attack animations (Sword)
export const SWORD_ATTACK_ANIMATIONS: Record<string, string> = {
  slash: '2_Sword/slash',
  slash_heavy: '2_Sword/slash',
};

// ============================================================================
// LEGACY REGISTRY EXPORT (for compatibility with Character Registry)
// ============================================================================

export const STICKMAN_ANIMATIONS = {
  idle: IDLE_ANIMATIONS.bare,
  walk: MOVE_ANIMATIONS.bare,
  run: RUN_ANIMATIONS.bare,
  jump: JUMP_ANIMATIONS.bare,
  block: BLOCK_ANIMATIONS.bare.center,
  hurt: HURT_ANIMATIONS.bare.center,
  attacks: BARE_ATTACK_ANIMATIONS
} as const;