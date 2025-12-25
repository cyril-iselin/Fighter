// ============================================
// Animation Catalog - Spine Name Mappings
// ============================================

import { LoadoutAnimations, Loadout } from './types';

// Prefixes used in Spine JSON
const PREFIX_BARE = '1_/';
const PREFIX_SWORD = '2_Sword/';

const BARE_ANIMATIONS: LoadoutAnimations = {
  // Idle
  idle: `${PREFIX_BARE}idle`,
  idleActive: `${PREFIX_BARE}idle active`,
  idleFightPose: `${PREFIX_BARE}idle fight pose`,
  
  // Movement
  walkNormal: `${PREFIX_BARE}walk normal`,
  walkFightPose: `${PREFIX_BARE}walk fight pose`,
  run: `${PREFIX_BARE}run`,
  runStop: `${PREFIX_BARE}run stop`,
  
  // Jumps - takeoff animations (short) that chain into main jump
  jumpTakeoffA: `${PREFIX_BARE}jump A`,
  jumpTakeoffB: `${PREFIX_BARE}jump B`,
  jumpTakeoffC: `${PREFIX_BARE}jump C`,
  jumpTakeoffD: `${PREFIX_BARE}jump A`,
  // Main jump animations
  jumpA: `${PREFIX_BARE}salto kick`,
  jumpB: `${PREFIX_BARE}salto kick`,
  jumpC: `${PREFIX_BARE}salto kick`,
  jumpD: `${PREFIX_BARE}__jump attack`,
  
  // Block
  blockTop: `${PREFIX_BARE}block top`,
  blockCenter: `${PREFIX_BARE}block center`,
  
  // Hurt
  hurtTop: `${PREFIX_BARE}hurt top`,
  hurtCenter: `${PREFIX_BARE}hurt center`,
  
  // Death
  dieA: `${PREFIX_BARE}die A`,
  dieB: `${PREFIX_BARE}die B`,
  
  // Attacks
  attacks: {
    jab_single: `${PREFIX_BARE}jab single`,
    jab_double: `${PREFIX_BARE}jab double`,
    jab_high_single: `${PREFIX_BARE}jab high single`,
    jab_high_double: `${PREFIX_BARE}jab high double`,
    kick_high: `${PREFIX_BARE}kick high`,
    kick_low: `${PREFIX_BARE}kick low`,
    kick_straight: `${PREFIX_BARE}kick straight`,
    uppercut: `${PREFIX_BARE}uppercut`,
    flying_kick: `${PREFIX_BARE}flying kick`,
    salto_kick: `${PREFIX_BARE}salto kick`,
    thousand_fists: `${PREFIX_BARE}thousand fists`,
  }
};

const SWORD_ANIMATIONS: LoadoutAnimations = {
  // Idle
  idle: `${PREFIX_SWORD}idle`,
  idleActive: `${PREFIX_SWORD}idle active`,
  idleFightPose: `${PREFIX_SWORD}idle fight pose`,
  
  // Movement
  walkNormal: `${PREFIX_SWORD}walk normal`,
  walkFightPose: `${PREFIX_SWORD}walk fight pose`,
  run: `${PREFIX_SWORD}run`,
  runStop: `${PREFIX_SWORD}run stop`,
  
  // Jumps - takeoff animations
  jumpTakeoffA: `${PREFIX_SWORD}jump A`,
  jumpTakeoffB: `${PREFIX_SWORD}jump B`,
  jumpTakeoffC: `${PREFIX_SWORD}jump C`,
  jumpTakeoffD: `${PREFIX_SWORD}jump A`,
  // Main jump (use bare salto kick - sword has no salto animation)
  jumpA: `${PREFIX_BARE}salto kick`,
  jumpB: `${PREFIX_BARE}salto kick`,
  jumpC: `${PREFIX_BARE}salto kick`,
  jumpD: `${PREFIX_BARE}__jump attack`,
  
  // Block
  blockTop: `${PREFIX_SWORD}block top`,
  blockCenter: `${PREFIX_SWORD}block center`,
  
  // Hurt
  hurtTop: `${PREFIX_SWORD}hurt top`,
  hurtCenter: `${PREFIX_SWORD}hurt center`,
  
  // Death
  dieA: `${PREFIX_SWORD}die A`,
  dieB: `${PREFIX_SWORD}die B`,
  
  // Attacks
  // Both slash_light and slash_heavy use the same animation
  // The difference is in damage and charge-up timing (attack-data.ts)
  attacks: {
    slash_light: `${PREFIX_SWORD}slash`,
    slash_heavy: `${PREFIX_SWORD}slash`
  }
};

export const ANIMATION_CATALOG: Record<Loadout, LoadoutAnimations> = {
  bare: BARE_ANIMATIONS,
  sword: SWORD_ANIMATIONS
};

// Default mix durations for smooth transitions
export const MIX_DURATIONS: Record<string, number> = {
  // Fast transitions
  'idle->attack': 0.1,
  'attack->idle': 0.15,
  'idle->block': 0.1,
  'block->idle': 0.15,
  'idle->hurt': 0.05,
  'hurt->idle': 0.2,
  
  // Movement transitions
  'idle->walk': 0.15,
  'walk->idle': 0.15,
  'idle->run': 0.1,
  'run->idle': 0.2,
  'run->runStop': 0.1,
  'runStop->idle': 0.15,
  
  // Jump transitions
  'idle->jump': 0.1,
  'jump->idle': 0.15,
  
  // Death (no return)
  'any->die': 0.1,
  
  // Default
  default: 0.2
};
