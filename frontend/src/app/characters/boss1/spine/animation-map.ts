// ============================================================================
// BOSS1 ANIMATION MAPPING
// ============================================================================
// Maps Core State + Context -> Spine Animation Name
// Available animations: attack, attack2, dead, get hit, happy, idle, walk
// Note: Boss1 has no loadout variants - single loadout only
// ============================================================================

// Single loadout for boss (no bare/sword distinction)
export type Boss1Loadout = 'default';

// Base idle animation
export const IDLE_ANIMATION = 'idle';

// Movement animation  
export const WALK_ANIMATION = 'walk';

// No run animation - use walk
export const RUN_ANIMATION = 'walk';

// No jump animation - use idle as fallback
export const JUMP_ANIMATION = 'idle';

// Block - boss doesn't block, use idle
export const BLOCK_ANIMATION = 'idle';

// Hurt animation (note: has space in name)
export const HURT_ANIMATION = 'get hit';

// Death animation
export const DEATH_ANIMATION = 'dead';

// Attack animations
export const BOSS1_ATTACK_ANIMATIONS: Record<string, string> = {
  // Heavy attack (main attack animation)
  boss1_heavy: 'attack',
  // Light attack (quick poke)
  boss1_light: 'attack2',
};

// ============================================================================
// LEGACY REGISTRY EXPORT (for compatibility with Character Registry)
// ============================================================================

export const BOSS1_ANIMATIONS = {
  idle: IDLE_ANIMATION,
  walk: WALK_ANIMATION,
  run: RUN_ANIMATION,
  jump: JUMP_ANIMATION,
  block: BLOCK_ANIMATION,
  hurt: HURT_ANIMATION,
  attacks: BOSS1_ATTACK_ANIMATIONS
} as const;
