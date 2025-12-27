// ============================================================================
// BOSS2 PROVIDERS
// ============================================================================
// Provider implementations for Boss2 character (Orc Warrior)
// ============================================================================

import type { Loadout, AttackCommand, FighterState, HitZone } from '../../../core/types';
import type { AttackResolver, AnimationProvider, AnimationKey } from '../../providers';
import { BOSS2_ATTACK_DATA } from '../combat/attack-data';
import { resolveBoss2ContextualAttack } from '../combat/contextual-overrides';
import {
  IDLE_ANIMATION,
  WALK_ANIMATION,
  RUN_ANIMATION,
  JUMP_ANIMATION,
  BLOCK_ANIMATION,
  HURT_ANIMATION,
  DEATH_ANIMATION,
  BOSS2_ATTACK_ANIMATIONS
} from '../spine/animation-map';

/**
 * Boss2 animation provider implementation
 * Boss2 has no loadout variants - always uses default animations
 */
export class Boss2AnimationProvider implements AnimationProvider {
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
    // Boss2 ignores loadout - always uses default animations
    
    switch (state) {
      case 'idle':
        return { name: IDLE_ANIMATION, loop: true };

      case 'move': {
        const isRunning = context.run === true;
        return {
          name: isRunning ? RUN_ANIMATION : WALK_ANIMATION,
          loop: true,
        };
      }

      case 'jump':
        return { name: JUMP_ANIMATION, loop: false };

      case 'block': {
        // Boss doesn't block - use idle
        return { name: BLOCK_ANIMATION, loop: false };
      }

      case 'hurt': {
        // Boss2's "get hit" animation has root motion that doesn't return to origin
        // So we DON'T loop it - instead let it freeze on the last frame
        return { name: HURT_ANIMATION, loop: false };
      }

      case 'dead':
        return { name: DEATH_ANIMATION, loop: false };

      case 'telegraph': {
        const attackId = context.activeAttack;
        if (!attackId) {
          return { name: IDLE_ANIMATION, loop: true };
        }

        const animName = BOSS2_ATTACK_ANIMATIONS[attackId];
        return {
          name: animName ?? IDLE_ANIMATION,
          loop: false,
        };
      }

      case 'attack': {
        const attackId = context.activeAttack;
        if (!attackId) {
          return { name: IDLE_ANIMATION, loop: true };
        }

        const animName = BOSS2_ATTACK_ANIMATIONS[attackId];
        return {
          name: animName ?? IDLE_ANIMATION,
          loop: false,
        };
      }

      default:
        return { name: IDLE_ANIMATION, loop: true };
    }
  }

  getRunStopAnimation(loadout: string): string {
    return WALK_ANIMATION;
  }
}

/**
 * Boss2 attack resolver implementation
 */
export class Boss2AttackResolver implements AttackResolver {
  resolveContextualAttack(
    loadout: Loadout,
    command: AttackCommand,
    context?: { state?: string }
  ): string | null {
    return resolveBoss2ContextualAttack(loadout, command, context);
  }

  getAttackData(attackId: string): any | null {
    return (BOSS2_ATTACK_DATA as Record<string, any>)[attackId] || null;
  }

  getAttacksForLoadout(loadout: any): string[] {
    // Boss2 only has 'bare' loadout
    return Object.values(BOSS2_ATTACK_DATA)
      .filter((attack: any) => attack.loadout === 'bare')
      .map((attack: any) => attack.id);
  }
}