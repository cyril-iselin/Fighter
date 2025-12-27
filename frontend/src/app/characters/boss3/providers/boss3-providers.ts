// ============================================================================
// BOSS3 PROVIDERS
// ============================================================================
// Provider implementations for Boss3 character (The Bear)
// ============================================================================

import type { Loadout, AttackCommand, FighterState, HitZone } from '../../../core/types';
import type { AttackResolver, AnimationProvider, AnimationKey } from '../../providers';
import { BOSS3_ATTACK_DATA } from '../combat/attack-data';
import { resolveBoss3ContextualAttack } from '../combat/contextual-overrides';
import {
  IDLE_ANIMATION,
  WALK_ANIMATION,
  RUN_ANIMATION,
  JUMP_ANIMATION,
  BLOCK_ANIMATION,
  HURT_ANIMATION,
  DEATH_ANIMATION,
  BOSS3_ATTACK_ANIMATIONS
} from '../spine/animation-map';

/**
 * Boss3 animation provider implementation
 * Boss3 has no loadout variants - always uses default animations
 */
export class Boss3AnimationProvider implements AnimationProvider {
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
    // Boss3 ignores loadout - always uses default animations
    
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
        return { name: BLOCK_ANIMATION, loop: false };
      }

      case 'hurt': {
        return { name: HURT_ANIMATION, loop: false };
      }

      case 'dead':
        return { name: DEATH_ANIMATION, loop: false };

      case 'telegraph': {
        const attackId = context.activeAttack;
        if (!attackId) {
          return { name: IDLE_ANIMATION, loop: true };
        }

        const animName = BOSS3_ATTACK_ANIMATIONS[attackId];
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

        const animName = BOSS3_ATTACK_ANIMATIONS[attackId];
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
 * Boss3 attack resolver implementation
 */
export class Boss3AttackResolver implements AttackResolver {
  resolveContextualAttack(
    loadout: Loadout,
    command: AttackCommand,
    context?: { state?: string }
  ): string | null {
    return resolveBoss3ContextualAttack(loadout, command, context);
  }

  getAttackData(attackId: string): any | null {
    return (BOSS3_ATTACK_DATA as Record<string, any>)[attackId] || null;
  }

  getAttacksForLoadout(loadout: any): string[] {
    return Object.values(BOSS3_ATTACK_DATA)
      .filter((attack: any) => attack.loadout === 'bare')
      .map((attack: any) => attack.id);
  }
}