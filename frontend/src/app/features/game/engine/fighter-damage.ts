// ============================================
// Fighter Damage - Hit, Stun, Death, Armor
// ============================================

import { FighterState, HitZone, DeathVariant } from './types';
import type { FighterController } from './fighter-controller';

export class FighterDamage {
  stunned: boolean = false;
  superArmor: boolean = false;
  
  private get anim() { return this.ctrl.anim; }
  
  constructor(private ctrl: FighterController) {}
  
  // ============================================
  // Take Hit
  // ============================================
  
  takeHit(zone: HitZone, inCombat: boolean): boolean {
    if (this.ctrl.state === FighterState.Dead) return false;
    if (this.superArmor) return false;
    
    // Don't interrupt stun animation with regular hurt
    if (this.stunned) return false;
    
    this.ctrl.invalidatePendingActions();
    this.ctrl.combat.pendingAttackId = null;
    this.superArmor = false;
    
    this.ctrl.setState(FighterState.Hurt);
    this.anim.playHurt(zone);
    
    // Queue idle transition
    const sequenceId = this.ctrl.actionSequenceId;
    this.anim.queueIdleTransition(
      inCombat,
      sequenceId,
      () => this.ctrl.actionSequenceId,
      () => this.ctrl.state,
      () => this.ctrl.setState(FighterState.Idle)
    );
    
    return true;
  }
  
  // ============================================
  // Death
  // ============================================
  
  die(variant: DeathVariant = 'A'): void {
    if (this.ctrl.state === FighterState.Dead) return;
    
    this.ctrl.invalidatePendingActions();
    this.ctrl.setState(FighterState.Dead);
    this.anim.playDeath(variant);
  }
  
  isDead(): boolean {
    return this.ctrl.state === FighterState.Dead;
  }
  
  // ============================================
  // Stun / Armor
  // ============================================
  
  setStunned(stunned: boolean): void {
    this.stunned = stunned;
    
    if (stunned) {
      // Enter stunned state with special animation
      this.ctrl.invalidatePendingActions();
      this.ctrl.setState(FighterState.Hurt);
      this.anim.playStunned();
    } else {
      // Exit stunned state
      this.anim.endStunned();
      this.ctrl.setState(FighterState.Idle);
      this.anim.playIdle(this.ctrl.inCombat);
    }
  }
  
  isStunned(): boolean {
    return this.stunned;
  }
  
  setSuperArmor(enabled: boolean): void {
    this.superArmor = enabled;
  }
  
  hasSuperArmor(): boolean {
    return this.superArmor;
  }
  
  // ============================================
  // Reset
  // ============================================
  
  reset(): void {
    this.stunned = false;
    this.superArmor = false;
  }
}
