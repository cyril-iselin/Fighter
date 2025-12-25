// ============================================
// Fighter Animation - Spine Track Handling
// ============================================

import { LoadoutAnimations, SpinePlayer, SpineTrackEntry, FighterState, HitZone, JumpVariant, DeathVariant } from './types';
import { ANIMATION_CATALOG } from './animation-catalog';
import { Loadout } from './types';
import { getBlockAnimation, getHurtAnimation, getIdleAnimation } from './animation-helpers';
import { TimerBag, TIMER } from './timer-bag';

const TRACK_MAIN = 0;

export class FighterAnimation {
  anims: LoadoutAnimations;
  
  constructor(
    private spine: SpinePlayer,
    private timers: TimerBag,
    loadout: Loadout
  ) {
    this.anims = ANIMATION_CATALOG[loadout];
  }
  
  setLoadout(loadout: Loadout): void {
    this.anims = ANIMATION_CATALOG[loadout];
  }
  
  // ============================================
  // Core Animation
  // ============================================
  
  play(name: string, loop: boolean): SpineTrackEntry {
    this.spine.setTimeScale(TRACK_MAIN, 1);
    return this.spine.setAnimation(TRACK_MAIN, name, loop);
  }
  
  queue(name: string, loop: boolean, delay: number = 0): void {
    this.spine.addAnimation(TRACK_MAIN, name, loop, delay);
  }
  
  setTimeScale(scale: number): void {
    this.spine.setTimeScale(TRACK_MAIN, scale);
  }
  
  pause(): void {
    this.spine.setTimeScale(TRACK_MAIN, 0);
  }
  
  resume(): void {
    this.spine.setTimeScale(TRACK_MAIN, 1);
  }
  
  /**
   * Hard reset: clear all tracks and force idle
   * Use when animation might be stuck (paused telegraph, etc.)
   */
  hardReset(inCombat: boolean): void {
    this.spine.clearTracks();
    this.spine.setTimeScale(TRACK_MAIN, 1);
    this.playIdle(inCombat);
  }
  
  // ============================================
  // State Animations
  // ============================================
  
  playIdle(inCombat: boolean): void {
    const anim = getIdleAnimation(this.anims, inCombat);
    this.play(anim, true);
  }
  
  playBlock(zone: HitZone): SpineTrackEntry {
    const anim = getBlockAnimation(this.anims, zone);
    const entry = this.play(anim, false);
    entry.holdPrevious = true;
    return entry;
  }
  
  playHurt(zone: HitZone): void {
    const anim = getHurtAnimation(this.anims, zone);
    this.play(anim, false);
  }
  
  playStunned(): void {
    // Play hurt animation looping with slower time scale for dazed effect
    const anim = getHurtAnimation(this.anims, 'center');
    this.play(anim, true);
    this.setTimeScale(0.3); // Slow motion dazed look
  }
  
  endStunned(): void {
    // Resume normal animation
    this.setTimeScale(1);
  }

  playDeath(variant: DeathVariant): void {
    const anim = variant === 'A' ? this.anims.dieA : this.anims.dieB;
    this.play(anim, false);
  }
  
  playWalk(inCombat: boolean, fightPose: boolean): void {
    const anim = fightPose ? this.anims.walkFightPose : 
                 (inCombat ? this.anims.walkFightPose : this.anims.walkNormal);
    this.play(anim, true);
  }
  
  playRun(): void {
    this.play(this.anims.run, true);
  }
  
  playRunStop(): void {
    this.play(this.anims.runStop, false);
  }
  
  playJump(variant: JumpVariant): void {
    const takeoff = this.anims[`jumpTakeoff${variant}` as keyof LoadoutAnimations] as string;
    const main = this.anims[`jump${variant}` as keyof LoadoutAnimations] as string;
    
    this.play(takeoff, false);
    this.queue(main, true, 0);
  }
  
  playAttack(animName: string, loop: boolean = false): void {
    this.play(animName, loop);
  }
  
  // ============================================
  // Idle Transition Queue
  // ============================================
  
  queueIdleTransition(
    inCombat: boolean, 
    expectedSequence: number,
    getSequence: () => number,
    getState: () => FighterState,
    onIdle: () => void
  ): void {
    const idleAnim = getIdleAnimation(this.anims, inCombat);
    this.queue(idleAnim, true, 0);
    
    this.timers.set(TIMER.IDLE_TRANSITION, () => {
      const state = getState();
      if (getSequence() === expectedSequence && 
          (state === FighterState.Attack || state === FighterState.Hurt || state === FighterState.Move)) {
        onIdle();
      }
    }, 500);
  }
}
