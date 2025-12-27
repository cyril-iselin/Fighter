import type { FighterState, Loadout, HitZone } from '../core/types';
import type { AttackId } from '../core/attack-types';

// ============================================================================
// ANIMATION MAPPING (Single Source of Truth for Spine Animation Names)
// ============================================================================

/**
 * Maps Core State + Context -> Spine Animation Name
 * All animation names must match exactly what's in the Spine JSON
 */

// Base idle animations
const IDLE_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/idle active',
  sword: '2_Sword/idle active',
};

// Movement animations (using walk fight pose as default walk)
const MOVE_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/walk fight pose',
  sword: '2_Sword/walk fight pose',
};

// Run animations (sprint with SHIFT)
const RUN_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/run',
  sword: '2_Sword/run',
};

// Jump animations (using variant A as default for MVP)
const JUMP_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/jump A',
  sword: '2_Sword/jump A',
};

// Land animation (using run stop as landing transition)
const LAND_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/run stop',
  sword: '2_Sword/run stop',
};

// Run stop transition (deceleration from run to idle/walk)
export const RUN_STOP_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/run stop',
  sword: '2_Sword/run stop',
};

// Block animations by zone
const BLOCK_ANIMATIONS: Record<Loadout, Record<HitZone, string>> = {
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
const HURT_ANIMATIONS: Record<Loadout, Record<HitZone, string>> = {
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
const DEATH_ANIMATIONS: Record<Loadout, string> = {
  bare: '1_/die A',
  sword: '2_Sword/die A',
};

// Attack animations (Bare-handed)
const BARE_ATTACK_ANIMATIONS: Record<string, string> = {
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
const SWORD_ATTACK_ANIMATIONS: Record<string, string> = {
  slash: '2_Sword/slash',
  slash_heavy: '2_Sword/slash',
};

// ============================================================================
// ANIMATION RESOLVER
// ============================================================================

export interface AnimationKey {
  name: string;
  loop: boolean;
}

/**
 * Resolves animation name for a fighter state
 * Returns animation name + loop flag
 */
export function resolveAnimation(
  state: FighterState,
  loadout: Loadout,
  context: {
    activeAttack?: AttackId | null;
    blockZone?: HitZone | null;
    attackZone?: HitZone | null;  // For hurt animation
    facingRight?: boolean;
    vx?: number;
    run?: boolean;  // SHIFT modifier for sprint
    pressureStunTicks?: number;  // For pressure stun loop animation
  }
): AnimationKey {
  switch (state) {
    case 'idle':
      return { name: IDLE_ANIMATIONS[loadout], loop: true };

    case 'move': {
      // Use run animation if running flag is set
      const isRunning = context.run === true;

      return {
        name: isRunning ? RUN_ANIMATIONS[loadout] : MOVE_ANIMATIONS[loadout],
        loop: true,
      };
    }

    case 'jump':
      return { name: JUMP_ANIMATIONS[loadout], loop: false };

    case 'block': {
      const zone = context.blockZone ?? 'center';
      return { name: BLOCK_ANIMATIONS[loadout][zone], loop: false };  // One-shot for freeze at end
    }

    case 'hurt': {
      const zone = context.attackZone ?? 'center';
      // During pressure stun, hurt animation should loop
      const shouldLoop = (context.pressureStunTicks ?? 0) > 0;
      return { name: HURT_ANIMATIONS[loadout][zone], loop: shouldLoop };
    }

    case 'dead':
      return { name: DEATH_ANIMATIONS[loadout], loop: false };

    case 'telegraph': {
      // Telegraph uses the attack animation itself (freeze system will handle the visual freeze)
      const attackId = context.activeAttack;
      if (!attackId) {
        return { name: IDLE_ANIMATIONS[loadout], loop: true };
      }

      const animMap = loadout === 'bare' ? BARE_ATTACK_ANIMATIONS : SWORD_ATTACK_ANIMATIONS;
      const animName = animMap[attackId];

      return {
        name: animName ?? IDLE_ANIMATIONS[loadout],
        loop: false,  // Attack animation, will be frozen by freeze system
      };
    }

    case 'attack': {
      // Attack and recovery use the attack animation
      const attackId = context.activeAttack;
      if (!attackId) {
        return { name: IDLE_ANIMATIONS[loadout], loop: true };
      }

      const animMap = loadout === 'bare' ? BARE_ATTACK_ANIMATIONS : SWORD_ATTACK_ANIMATIONS;
      const animName = animMap[attackId];

      // thousand_fists is a special case that should loop during its 60-tick duration
      const shouldLoop = attackId === 'thousand_fists';

      return {
        name: animName ?? IDLE_ANIMATIONS[loadout],
        loop: shouldLoop,  // thousand_fists loops, other attacks don't
      };
    }

    default:
      return { name: IDLE_ANIMATIONS[loadout], loop: true };
  }
}
