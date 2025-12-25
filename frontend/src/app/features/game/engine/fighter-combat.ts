// ============================================
// Fighter Combat - Attacks, Telegraph, Hitbox
// ============================================

import { FighterState, HitZone } from './types';
import type { FighterController } from './fighter-controller';
import { AttackId, getAttackConfig } from './attack-data';
import { HitboxProvider, AttackHitbox } from './hitbox-provider';
import { TIMER } from './timer-bag';

export class FighterCombat {
  activeAttackId: AttackId | null = null;
  pendingAttackId: AttackId | null = null;
  
  private get anim() { return this.ctrl.anim; }
  private get timers() { return this.ctrl.timers; }
  
  constructor(
    private ctrl: FighterController,
    private canUseSpecial?: () => boolean,
    private onSpecialUsed?: () => void
  ) {}
  
  // ============================================
  // State Queries
  // ============================================
  
  canAttack(): boolean {
    if (this.ctrl.damage.isStunned()) return false;
    return this.ctrl.state === FighterState.Idle || this.ctrl.state === FighterState.Move;
  }
  
  isHitboxActive(): boolean {
    return this.activeAttackId !== null;
  }
  
  getActiveHitbox(bonePositions: any): AttackHitbox | null {
    if (!this.activeAttackId) return null;
    return HitboxProvider.getAttackHitbox(this.activeAttackId, bonePositions, this.ctrl.loadout);
  }
  
  // ============================================
  // Attack Execution
  // ============================================
  
  attackLight(): void {
    if (!this.canAttack()) return;
    
    this.ctrl.setState(FighterState.Attack);
    
    const attackId: AttackId = this.ctrl.loadout === 'sword' ? 'slash_light' : 'kick_straight';
    this.performAttack(attackId);
  }
  
  attackHeavy(): void {
    if (!this.canAttack()) return;
    
    this.ctrl.setState(FighterState.Attack);
    
    const attackId: AttackId = this.ctrl.loadout === 'sword' ? 'slash_heavy' : 'uppercut';
    this.performAttack(attackId);
  }
  
  special(): void {
    if (!this.canAttack()) return;
    if (this.ctrl.loadout === 'sword') return;
    if (this.canUseSpecial && !this.canUseSpecial()) return;
    
    this.ctrl.setState(FighterState.Attack);
    this.onSpecialUsed?.();
    
    const attackId: AttackId = 'thousand_fists';
    this.activeAttackId = attackId;
    
    const animName = this.anim.anims.attacks[attackId];
    if (animName) {
      this.anim.playAttack(animName, true);
      this.timers.set(TIMER.SPECIAL_DURATION, () => {
        if (this.ctrl.state === FighterState.Attack) {
          this.ctrl.transitionToIdle();
          this.activeAttackId = null;
        }
      }, 600);
    }
  }
  
  private performAttack(attackId: AttackId): void {
    this.ctrl.invalidatePendingActions();
    const currentSequence = this.ctrl.actionSequenceId;
    
    const config = getAttackConfig(attackId);
    const chargeUpMs = config?.chargeUpMs ?? 0;
    
    if (chargeUpMs > 0) {
      this.performChargedAttack(attackId, chargeUpMs, currentSequence);
      return;
    }
    
    this.activeAttackId = attackId;
    const animName = this.anim.anims.attacks[attackId];
    
    if (animName) {
      this.anim.playAttack(animName);
      
      const duration = config?.attackDurationMs ?? 250;
      this.timers.set(TIMER.ATTACK_HITBOX, () => {
        if (this.ctrl.actionSequenceId === currentSequence && this.activeAttackId === attackId) {
          this.activeAttackId = null;
        }
      }, duration);
      
      this.queueIdleAfterAttack(currentSequence);
    }
  }
  
  private performChargedAttack(attackId: AttackId, chargeUpMs: number, sequenceId: number): void {
    this.pendingAttackId = attackId;
    
    const config = getAttackConfig(attackId);
    const chargeAnimId = config?.chargeAnimation;
    const chargeAnimName = chargeAnimId ? this.anim.anims.attacks[chargeAnimId as AttackId] : null;
    const attackAnimName = this.anim.anims.attacks[attackId];
    
    if (!attackAnimName) {
      this.pendingAttackId = null;
      return;
    }
    
    const windupTime = chargeAnimName ? 100 : 150;
    
    if (chargeAnimName) {
      this.anim.playAttack(chargeAnimName);
    } else {
      this.anim.playAttack(attackAnimName);
    }
    
    this.timers.set(TIMER.CHARGE_WINDUP, () => {
      if (this.ctrl.actionSequenceId !== sequenceId || this.ctrl.state !== FighterState.Attack) return;
      
      this.anim.pause();
      
      this.timers.set(TIMER.CHARGE_EXECUTE, () => {
        if (this.ctrl.actionSequenceId !== sequenceId || this.ctrl.state !== FighterState.Attack) {
          this.anim.resume();
          this.pendingAttackId = null;
          return;
        }
        
        if (this.pendingAttackId) {
          this.activeAttackId = this.pendingAttackId;
          this.pendingAttackId = null;
        }
        
        this.anim.resume();
        
        if (chargeAnimName) {
          this.anim.playAttack(attackAnimName);
        }
        
        const duration = config?.attackDurationMs ?? 250;
        this.timers.set(TIMER.ATTACK_HITBOX, () => {
          if (this.ctrl.actionSequenceId === sequenceId && this.activeAttackId === attackId) {
            this.activeAttackId = null;
          }
        }, duration);
        
        this.queueIdleAfterAttack(sequenceId);
      }, chargeUpMs);
    }, windupTime);
  }
  
  private queueIdleAfterAttack(sequenceId: number): void {
    this.anim.queueIdleTransition(
      this.ctrl.inCombat,
      sequenceId,
      () => this.ctrl.actionSequenceId,
      () => this.ctrl.state,
      () => this.ctrl.setState(FighterState.Idle)
    );
  }
  
  // ============================================
  // Telegraph (AI)
  // ============================================
  
  startTelegraph(attackType: 'light' | 'heavy' | 'special', windupTime: number = 150): Promise<void> {
    if (!this.canAttack()) return Promise.reject('Cannot attack');
    
    if (this.ctrl.loadout === 'sword' && attackType === 'special') return Promise.reject('Sword has no special');
    
    this.ctrl.setState(FighterState.Attack);
    
    let attackId: AttackId;
    switch (attackType) {
      case 'light':
        // Bare: kick_straight (same as player attackLight)
        attackId = this.ctrl.loadout === 'sword' ? 'slash_light' : 'kick_straight';
        break;
      case 'heavy':
        // Bare: uppercut (same as player attackHeavy)
        attackId = this.ctrl.loadout === 'sword' ? 'slash_heavy' : 'uppercut';
        break;
      case 'special':
        attackId = 'thousand_fists';
        break;
    }
    
    this.pendingAttackId = attackId;
    const animName = this.anim.anims.attacks[attackId];
    
    if (!animName) {
      this.pendingAttackId = null;
      return Promise.reject('No animation');
    }
    
    this.anim.playAttack(animName);
    
    return new Promise((resolve, reject) => {
      this.timers.set(TIMER.TELEGRAPH, () => {
        if (this.ctrl.state !== FighterState.Attack || this.pendingAttackId !== attackId) {
          reject('Telegraph interrupted');
          return;
        }
        this.anim.pause();
        resolve();
      }, windupTime);
    });
  }
  
  executeTelegraph(): void {
    const attackToExecute = this.pendingAttackId;
    this.pendingAttackId = null;
    
    if (!attackToExecute) {
      if (this.ctrl.state === FighterState.Attack) this.ctrl.transitionToIdle();
      return;
    }
    
    this.ctrl.invalidatePendingActions();
    const currentSequence = this.ctrl.actionSequenceId;
    
    this.ctrl.setState(FighterState.Attack);
    this.activeAttackId = attackToExecute;
    this.anim.resume();
    
    const config = getAttackConfig(attackToExecute);
    const duration = config?.attackDurationMs ?? 250;
    
    this.timers.set(TIMER.ATTACK_HITBOX, () => {
      if (this.ctrl.actionSequenceId === currentSequence && this.activeAttackId === attackToExecute) {
        this.activeAttackId = null;
      }
    }, duration);
    
    this.queueIdleAfterAttack(currentSequence);
  }
  
  cancelTelegraph(): void {
    this.ctrl.invalidatePendingActions();
    this.pendingAttackId = null;
    this.activeAttackId = null;
    // Hard reset to prevent stuck poses (paused animation, etc.)
    this.anim.hardReset(this.ctrl.isInCombat());
    this.ctrl.setState(FighterState.Idle);
  }
  
  // ============================================
  // Reset
  // ============================================
  
  reset(): void {
    this.activeAttackId = null;
    this.pendingAttackId = null;
  }
}
