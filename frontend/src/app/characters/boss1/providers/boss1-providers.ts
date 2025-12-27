// ============================================================================
// BOSS1 PROVIDERS
// ============================================================================
// Provider implementations for Boss1 character (Jester)
// ============================================================================

import type { Loadout, AttackCommand, FighterState, HitZone } from '../../../core/types';
import type { AttackResolver, AnimationProvider, AnimationKey } from '../../providers';
import { BOSS1_ATTACK_DATA } from '../combat/attack-data';
import { resolveBoss1ContextualAttack } from '../combat/contextual-overrides';
import {
  IDLE_ANIMATION,
  WALK_ANIMATION,
  RUN_ANIMATION,
  JUMP_ANIMATION,
  BLOCK_ANIMATION,
  HURT_ANIMATION,
  DEATH_ANIMATION,
  BOSS1_ATTACK_ANIMATIONS
} from '../spine/animation-map';

/**
 * Boss1 animation provider implementation
 * Boss1 has no loadout variants - always uses default animations
 */
export class Boss1AnimationProvider implements AnimationProvider {
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
    // Boss1 ignores loadout - always uses default animations
    
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
        // Boss1's "get hit" animation has root motion that doesn't return to origin
        // So we DON'T loop it - instead let it freeze on the last frame
        // The animation will hold until state changes
        return { name: HURT_ANIMATION, loop: false };
      }

      case 'dead':
        return { name: DEATH_ANIMATION, loop: false };

      case 'telegraph': {
        const attackId = context.activeAttack;
        if (!attackId) {
          return { name: IDLE_ANIMATION, loop: true };
        }

        const animName = BOSS1_ATTACK_ANIMATIONS[attackId];
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

        const animName = BOSS1_ATTACK_ANIMATIONS[attackId];
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
 * Boss1 attack resolver implementation
 */
export class Boss1AttackResolver implements AttackResolver {
  resolveContextualAttack(
    loadout: Loadout,
    command: AttackCommand,
    context?: { state?: string }
  ): string | null {
    return resolveBoss1ContextualAttack(loadout, command, context);
  }

  getAttackData(attackId: string): any | null {
    return (BOSS1_ATTACK_DATA as Record<string, any>)[attackId] || null;
  }

  getAttacksForLoadout(loadout: any): string[] {
    // Boss1 only has 'bare' loadout
    return Object.values(BOSS1_ATTACK_DATA)
      .filter((attack: any) => attack.loadout === 'bare')
      .map((attack: any) => attack.id);
  }
}