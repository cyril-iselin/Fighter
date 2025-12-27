import type { IFighterBrain } from './brain.interface';
import type { Observation, Intent } from '../core/types';

// ============================================================================
// DEBUG BRAIN (Wrapper with Logging)
// ============================================================================

/**
 * DebugBrain - Wraps another brain and logs decisions
 * Useful for debugging AI behavior without modifying core
 */
export class DebugBrain implements IFighterBrain {
  private tickCounter = 0;
  private readonly logInterval: number;

  constructor(
    private innerBrain: IFighterBrain,
    options?: {
      logInterval?: number;  // Log every N ticks (default: 60 = 1 second @ 60Hz)
      prefix?: string;       // Log prefix (default: "[AI]")
    }
  ) {
    this.logInterval = options?.logInterval ?? 60;
  }

  decide(obs: Observation, tick: number): Intent {
    // Call inner brain
    const intent = this.innerBrain.decide(obs, tick);

    // Log periodically
    if (tick % this.logInterval === 0) {
      this.logDecision(obs, intent, tick);
    }

    this.tickCounter++;
    return intent;
  }

  private logDecision(obs: Observation, intent: Intent, tick: number): void {
    const { self, opponent, distance } = obs;

    // Compact observation summary
    const obsSummary = {
      tick,
      distance: Math.round(distance),
      self: {
        state: self.state,
        x: Math.round(self.x),
        health: self.health,
        canAct: self.canAct,
      },
      opponent: {
        state: opponent.state,
        x: Math.round(opponent.x),
        health: opponent.health,
        activeAttack: opponent.activeAttack,
      },
    };

    // Intent summary with reason tags
    const intentSummary = {
      move: intent.move,
      attack: intent.attack,
      block: intent.block,
      jump: intent.jump,
      reason: this.inferReason(obs, intent),
    };

    console.log('[AI Debug]', {
      observation: obsSummary,
      intent: intentSummary,
    });
  }

  /**
   * Infers reason tag from observation + intent
   */
  private inferReason(obs: Observation, intent: Intent): string {
    if (intent.block !== null) {
      return obs.opponent.state === 'telegraph' 
        ? 'block:parryWindow' 
        : 'block:defending';
    }

    if (intent.attack !== null) {
      return obs.distance < 150 
        ? 'attack:inRange' 
        : 'attack:forced';
    }

    if (intent.move !== 'none') {
      return obs.distance > 200 
        ? 'move:approach' 
        : 'move:reposition';
    }

    if (intent.jump) {
      return 'jump';
    }

    return 'idle';
  }
  
  /**
   * Forward getSpeedMultiplier to inner brain (for phase system)
   */
  getSpeedMultiplier(): number {
    if (this.innerBrain.getSpeedMultiplier) {
      return this.innerBrain.getSpeedMultiplier();
    }
    return 1.0;
  }
  
  /**
   * Forward hasSuperArmor to inner brain (for phase system)
   */
  hasSuperArmor(): boolean {
    if (this.innerBrain.hasSuperArmor) {
      return this.innerBrain.hasSuperArmor();
    }
    return false;
  }
  
  /**
   * Forward getTelegraphOverrides to inner brain (for phase system)
   */
  getTelegraphOverrides(): Record<string, number> | undefined {
    if (this.innerBrain.getTelegraphOverrides) {
      return this.innerBrain.getTelegraphOverrides();
    }
    return undefined;
  }
  
  /**
   * Forward getRageBurstConfig to inner brain (for phase system)
   */
  getRageBurstConfig(): { proximityThreshold?: number; durationTicks?: number; cooldownTicks?: number; knockbackStrength?: number } | undefined {
    if (this.innerBrain.getRageBurstConfig) {
      return this.innerBrain.getRageBurstConfig();
    }
    return undefined;
  }
  
  /**
   * Forward consumePhaseChange to inner brain (for phase system)
   */
  consumePhaseChange(): { phaseName: string; hpPercent: number } | null {
    if (this.innerBrain.consumePhaseChange) {
      return this.innerBrain.consumePhaseChange();
    }
    return null;
  }
}
