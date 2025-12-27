// ============================================================================
// STICKMAN PROVIDERS
// ============================================================================
// Provider implementations for Stickman character
// ============================================================================

import type { Loadout, AttackCommand, FighterState, HitZone } from '../../../core/types';
import type { AttackResolver, AnimationProvider, AnimationKey } from '../../providers';
import { STICKMAN_ATTACK_DATA } from '../combat/attack-data';
import { resolveStickmanContextualAttack } from '../combat/contextual-overrides';
import {
  IDLE_ANIMATIONS,
  MOVE_ANIMATIONS,
  RUN_ANIMATIONS,
  JUMP_ANIMATIONS,
  BLOCK_ANIMATIONS,
  HURT_ANIMATIONS,
  DEATH_ANIMATIONS,
  BARE_ATTACK_ANIMATIONS,
  SWORD_ATTACK_ANIMATIONS
} from '../spine/animation-map';

/**
 * Stickman animation provider implementation
 */
export class StickmanAnimationProvider implements AnimationProvider {
  resolveAnimation(
    state: FighterState,
    loadout: string,
    context: {
      activeAttack?: string | null;
      blockZone?: HitZone | null;
      attackZone?: HitZone | null;
      facingRight?: boolean;
      vx?: number;
      run?: boolean;
      pressureStunTicks?: number;
    }
  ): AnimationKey {
    const loadoutKey = loadout as 'bare' | 'sword';  // Cast for type safety
    
    switch (state) {
      case 'idle':
        return { name: IDLE_ANIMATIONS[loadoutKey], loop: true };

      case 'move': {
        const isRunning = context.run === true;
        return {
          name: isRunning ? RUN_ANIMATIONS[loadoutKey] : MOVE_ANIMATIONS[loadoutKey],
          loop: true,
        };
      }

      case 'jump':
        return { name: JUMP_ANIMATIONS[loadoutKey], loop: false };

      case 'block': {
        const zone = context.blockZone ?? 'center';
        return { name: BLOCK_ANIMATIONS[loadoutKey][zone], loop: false };
      }

      case 'hurt': {
        const zone = context.attackZone ?? 'center';
        const shouldLoop = (context.pressureStunTicks ?? 0) > 0;
        return { name: HURT_ANIMATIONS[loadoutKey][zone], loop: shouldLoop };
      }

      case 'dead':
        return { name: DEATH_ANIMATIONS[loadoutKey], loop: false };

      case 'telegraph': {
        const attackId = context.activeAttack;
        if (!attackId) {
          return { name: IDLE_ANIMATIONS[loadoutKey], loop: true };
        }

        const animMap = loadout === 'bare' ? BARE_ATTACK_ANIMATIONS : SWORD_ATTACK_ANIMATIONS;
        const animName = animMap[attackId];

        return {
          name: animName ?? IDLE_ANIMATIONS[loadoutKey],
          loop: false,
        };
      }

      case 'attack':{
        const attackId = context.activeAttack;
        if (!attackId) {
          return { name: IDLE_ANIMATIONS[loadoutKey], loop: true };
        }

        const animMap = loadout === 'bare' ? BARE_ATTACK_ANIMATIONS : SWORD_ATTACK_ANIMATIONS;
        const animName = animMap[attackId];

        const shouldLoop = attackId === 'thousand_fists';

        return {
          name: animName ?? IDLE_ANIMATIONS[loadoutKey],
          loop: shouldLoop,
        };
      }

      default:
        return { name: IDLE_ANIMATIONS[loadoutKey], loop: true };
    }
  }

  getRunStopAnimation(loadout: string): string {
    const loadoutKey = loadout as 'bare' | 'sword';
    return MOVE_ANIMATIONS[loadoutKey];
  }
}

/**
 * Stickman attack resolver implementation
 */
export class StickmanAttackResolver implements AttackResolver {
  resolveContextualAttack(
    loadout: Loadout,
    command: AttackCommand,
    context?: { state?: string }
  ): string | null {
    return resolveStickmanContextualAttack(loadout, command, context);
  }

  getAttackData(attackId: string): any | null {
    return (STICKMAN_ATTACK_DATA as Record<string, any>)[attackId] || null;
  }

  getAttacksForLoadout(loadout: any): string[] {
    return Object.values(STICKMAN_ATTACK_DATA)
      .filter((attack: any) => attack.loadout === loadout)
      .map((attack: any) => attack.id);
  }
}