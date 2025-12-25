// ============================================
// Fighter Controller - Slim State & Wiring
// ============================================

import {
  Loadout,
  HitZone,
  JumpVariant,
  DeathVariant,
  MoveDirection,
  FighterState,
  SpinePlayer,
  FighterControllerConfig
} from './types';
import { AttackId } from './attack-data';
import { AttackHitbox } from './hitbox-provider';
import { PhysicsConfig, PhysicsState, applyPhysics, applyFriction, calculateMoveVelocity } from './fighter-physics';
import { TimerBag, TIMER } from './timer-bag';
import { FighterAnimation } from './fighter-animation';
import { FighterCombat } from './fighter-combat';
import { FighterDamage } from './fighter-damage';
import { FighterInput, InputState } from './fighter-input';

export class FighterController {
  // Core references
  private spine: SpinePlayer;
  
  // Sub-systems (public for FighterControllerRef)
  timers: TimerBag;
  anim: FighterAnimation;
  combat: FighterCombat;
  damage: FighterDamage;
  private input: FighterInput;
  
  // State (public for FighterControllerRef)
  state: FighterState = FighterState.Idle;
  private previousState: FighterState = FighterState.Idle;
  loadout: Loadout = 'bare';
  inCombat: boolean = false;
  
  // Block state
  isBlocking: boolean = false;
  private currentBlockZone: HitZone | null = null;
  private blockStartFrame: number = 0;
  private blockEndFrame: number = 0; // When block was released (for grace period)
  private lastBlockZone: HitZone | null = null; // Zone at time of release
  
  // Movement state
  moveDirection: MoveDirection = 'none';
  isRunning: boolean = false;
  private isWalking: boolean = false;
  private walkFightPose: boolean = false;
  
  // Action sequence (prevents stale callbacks)
  actionSequenceId: number = 0;
  
  // Physics
  private physics: PhysicsState;
  private physicsConfig: PhysicsConfig;
  
  // Bonus multipliers (campaign mode)
  private speedMultiplier: number = 1.0;
  private jumpMultiplier: number = 1.0;
  
  // Callbacks
  public onStateChange?: (newState: FighterState, oldState: FighterState) => void;
  public onPositionChange?: (x: number, y: number) => void;
  
  constructor(config: FighterControllerConfig) {
    this.spine = config.spine;
    this.loadout = config.defaultLoadout || 'bare';
    
    // Initialize physics
    this.physicsConfig = {
      walkSpeed: 200,
      runSpeed: 450,
      jumpVelocity: 700,
      gravity: 1800,
      groundY: config.groundY ?? 250,
      minX: config.minX ?? 100,
      maxX: config.maxX ?? 1820
    };
    
    this.physics = {
      positionX: config.startX ?? 960,
      positionY: config.startY ?? 250,
      velocityX: 0,
      velocityY: 0,
      facingRight: config.facingRight ?? true
    };
    
    // Apply bonus multipliers
    this.speedMultiplier = config.speedMultiplier ?? 1.0;
    this.jumpMultiplier = config.jumpMultiplier ?? 1.0;
    
    // Initialize sub-systems - pass this as controller ref
    this.timers = new TimerBag();
    this.anim = new FighterAnimation(this.spine, this.timers, this.loadout);
    this.combat = new FighterCombat(this, config.canUseSpecial, config.onSpecialUsed);
    this.damage = new FighterDamage(this);
    this.input = new FighterInput(this);
    
    // Set initial state
    this.spine.setFacingRight(this.physics.facingRight);
    this.transitionToIdle();
  }
  
  // ============================================
  // Public API - Loadout & State
  // ============================================
  
  setLoadout(loadout: Loadout): void {
    if (this.state === FighterState.Dead) return;
    this.loadout = loadout;
    this.anim.setLoadout(loadout);
    if (this.state === FighterState.Idle) this.transitionToIdle();
  }
  
  getLoadout(): Loadout { return this.loadout; }
  getState(): FighterState { return this.state; }
  
  setSpecialCallbacks(canUse: () => boolean, onUsed: () => void): void {
    // Re-create combat with new callbacks
    this.combat = new FighterCombat(this, canUse, onUsed);
  }
  
  // ============================================
  // Public API - Physics Update
  // ============================================
  
  update(deltaTime: number): void {
    // Movement velocity
    if (this.state === FighterState.Move && this.moveDirection !== 'none') {
      const baseVelocity = calculateMoveVelocity(this.moveDirection, this.isRunning, this.physicsConfig);
      this.physics.velocityX = baseVelocity * this.speedMultiplier;
    } else if (this.state !== FighterState.Jump) {
      applyFriction(this.physics);
    }
    
    // Physics update
    const landed = applyPhysics(this.physics, this.physicsConfig, deltaTime);
    
    if (landed && this.state === FighterState.Jump) {
      this.onLand();
    }
    
    this.syncSpinePosition();
  }
  
  private syncSpinePosition(): void {
    (this.spine as any).setPosition?.(this.physics.positionX, this.physics.positionY);
    this.onPositionChange?.(this.physics.positionX, this.physics.positionY);
  }
  
  private onLand(): void {
    this.timers.clear(TIMER.JUMP);
    if (this.isBlocking) return;
    if (this.moveDirection !== 'none') {
      this.move(this.moveDirection);
    } else {
      this.transitionToIdle();
    }
  }
  
  // ============================================
  // Public API - Position
  // ============================================
  
  getPosition(): { x: number; y: number } {
    return { x: this.physics.positionX, y: this.physics.positionY };
  }
  
  setPosition(x: number, y: number): void {
    this.physics.positionX = Math.max(this.physicsConfig.minX, Math.min(this.physicsConfig.maxX, x));
    this.physics.positionY = y;
    this.syncSpinePosition();
  }
  
  getVelocity(): { x: number; y: number } {
    return { x: this.physics.velocityX, y: this.physics.velocityY };
  }
  
  isFacingRight(): boolean { return this.physics.facingRight; }
  isOnGround(): boolean { return this.physics.positionY <= this.physicsConfig.groundY; }
  
  updateFacingToOpponent(opponentX: number): void {
    // Don't auto-face during attacks, hurt, dead, or JUMP (allows crossup!)
    if (this.state === FighterState.Attack || this.state === FighterState.Hurt || 
        this.state === FighterState.Dead || this.state === FighterState.Jump) return;
    
    const shouldFaceRight = opponentX > this.physics.positionX;
    if (this.physics.facingRight !== shouldFaceRight) {
      this.physics.facingRight = shouldFaceRight;
      this.spine.setFacingRight(shouldFaceRight);
    }
  }
  
  // ============================================
  // Public API - Hitbox/Hurtbox
  // ============================================
  
  getAttackBonePositions() { return this.spine.getAttackBonePositions(); }
  getHurtboxPositions() { return this.spine.getHurtboxPositions(); }
  getActiveAttackId(): AttackId | null { return this.combat.activeAttackId; }
  isHitboxActive(): boolean { return this.combat.isHitboxActive(); }
  getActiveHitbox(): AttackHitbox | null { return this.combat.getActiveHitbox(this.getAttackBonePositions()); }
  
  // ============================================
  // Public API - Combat Mode
  // ============================================
  
  enterCombat(combat: boolean): void {
    if (this.state === FighterState.Dead) return;
    this.inCombat = combat;
    if (this.state === FighterState.Idle) this.transitionToIdle();
  }
  
  isInCombat(): boolean { return this.inCombat; }
  
  // ============================================
  // Public API - Blocking
  // ============================================
  
  block(zone: HitZone): void {
    if (!this.canBlock()) return;
    
    this.invalidatePendingActions();
    
    // Reset block timing when:
    // 1. Starting a new block (!isBlocking)
    // 2. Changing block zone (allows perfect block on zone switch)
    const wasBlocking = this.isBlocking;
    const oldZone = this.currentBlockZone;
    if (!this.isBlocking || this.currentBlockZone !== zone) {
      this.blockStartFrame = performance.now();
      console.log(`[Block Start] New block at ${this.blockStartFrame.toFixed(0)}, wasBlocking=${wasBlocking}, oldZone=${oldZone}, newZone=${zone}`);
    }
    
    this.isBlocking = true;
    this.currentBlockZone = zone;
    this.setState(FighterState.Block);
    this.anim.playBlock(zone);
  }
  
  unblock(): void {
    if (!this.isBlocking) return;
    // Store when block ended and what zone it was (for grace period)
    this.blockEndFrame = performance.now();
    this.lastBlockZone = this.currentBlockZone;
    this.isBlocking = false;
    this.currentBlockZone = null;
    this.transitionToIdle();
  }
  
  isCurrentlyBlocking(): boolean { return this.isBlocking; }
  getBlockZone(): HitZone | null { return this.currentBlockZone; }
  getBlockStartTime(): number { return this.blockStartFrame; }
  getBlockEndTime(): number { return this.blockEndFrame; }
  getLastBlockZone(): HitZone | null { return this.lastBlockZone; }
  
  // ============================================
  // Public API - Attacks (delegate to combat)
  // ============================================
  
  attackLight(): void { this.combat.attackLight(); }
  attackHeavy(): void { this.combat.attackHeavy(); }
  special(): void { this.combat.special(); }
  
  startAttackTelegraph(attackType: 'light' | 'heavy' | 'special', windupTime?: number): Promise<void> {
    return this.combat.startTelegraph(attackType, windupTime);
  }
  
  executeAttackFromTelegraph(): void { this.combat.executeTelegraph(); }
  cancelTelegraph(): void { this.combat.cancelTelegraph(); }
  
  // ============================================
  // Public API - Damage (delegate to damage)
  // ============================================
  
  takeHit(zone: HitZone): void {
    this.isBlocking = false;
    this.currentBlockZone = null;
    this.damage.takeHit(zone, this.inCombat);
  }
  
  die(variant: DeathVariant = 'A'): void { this.damage.die(variant); }
  isDead(): boolean { return this.damage.isDead(); }
  
  setStunned(stunned: boolean): void { this.damage.setStunned(stunned); }
  isStunned(): boolean { return this.damage.isStunned(); }
  setSuperArmor(enabled: boolean): void { this.damage.setSuperArmor(enabled); }
  hasSuperArmor(): boolean { return this.damage.hasSuperArmor(); }
  
  // ============================================
  // Public API - Movement
  // ============================================
  
  setFacing(direction: 'left' | 'right'): void {
    if (this.state === FighterState.Dead) return;
    this.physics.facingRight = direction === 'right';
    this.spine.setFacingRight(this.physics.facingRight);
  }
  
  move(direction: MoveDirection): void {
    if (!this.canMove()) return;
    
    if (this.state === FighterState.Jump) {
      this.timers.clear(TIMER.JUMP);
    }
    
    // Idempotent: Skip if already moving in this direction
    const alreadyMoving = this.moveDirection === direction && this.state === FighterState.Move;
    if (alreadyMoving && direction !== 'none') return;
    
    this.moveDirection = direction;
    
    if (direction === 'none') {
      this.stopMove();
      return;
    }
    
    this.physics.facingRight = direction === 'right';
    this.spine.setFacingRight(this.physics.facingRight);
    this.setState(FighterState.Move);
    
    if (this.isRunning) {
      this.anim.playRun();
    } else {
      this.anim.playWalk(this.inCombat, this.walkFightPose);
    }
  }
  
  stopMove(): void {
    // Idempotent: Skip if already stopped
    if (this.moveDirection === 'none' && this.state !== FighterState.Move) return;
    
    this.moveDirection = 'none';
    
    if (this.isRunning) {
      this.anim.playRunStop();
      this.queueIdleAfterAnimation();
    } else {
      this.transitionToIdle();
    }
    
    this.isRunning = false;
    this.isWalking = false;
  }
  
  getMoveDirection(): MoveDirection { return this.moveDirection; }
  
  walk(fightPose: boolean = false): void {
    if (!this.canMove()) return;
    
    this.isWalking = true;
    this.isRunning = false;
    this.walkFightPose = fightPose;
    
    if (this.moveDirection !== 'none') {
      this.setState(FighterState.Move);
      this.anim.playWalk(this.inCombat, fightPose);
    }
  }
  
  run(): void {
    if (!this.canMove()) return;
    
    // Idempotent: Skip if already running
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isWalking = false;
    
    if (this.moveDirection !== 'none') {
      this.setState(FighterState.Move);
      this.anim.playRun();
    }
  }
  
  runStop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.anim.playRunStop();
    this.queueIdleAfterAnimation();
  }
  
  // ============================================
  // Public API - Jumping
  // ============================================
  
  jump(variant: JumpVariant = 'A'): void {
    if (!this.canJump()) return;
    
    this.invalidatePendingActions();
    this.setState(FighterState.Jump);
    
    // Strong vertical jump for backflip, apply jump multiplier
    this.physics.velocityY = this.physicsConfig.jumpVelocity * 1.3 * this.jumpMultiplier;
    
    // High horizontal speed for jump kick distance, apply speed multiplier
    if (this.moveDirection !== 'none') {
      const direction = this.moveDirection === 'right' ? 1 : -1;
      const speed = this.isRunning ? this.physicsConfig.runSpeed : this.physicsConfig.walkSpeed;
      this.physics.velocityX = speed * direction * 1.5 * this.speedMultiplier; // 50% faster than run
    }
    
    this.anim.playJump(variant);
  }
  
  // ============================================
  // Public API - State Queries
  // ============================================
  
  canAttack(): boolean { return this.combat.canAttack(); }
  
  canBlock(): boolean {
    if (this.damage.isStunned()) return false;
    return this.state === FighterState.Idle || this.state === FighterState.Move || this.state === FighterState.Block;
  }
  
  canMove(): boolean {
    if (this.damage.isStunned()) return false;
    return this.state === FighterState.Idle || this.state === FighterState.Move || this.state === FighterState.Jump;
  }
  
  canJump(): boolean {
    if (this.damage.isStunned()) return false;
    return this.state === FighterState.Idle || this.state === FighterState.Move;
  }
  
  // ============================================
  // Public API - Remote Input
  // ============================================
  
  applyRemoteInput(input: InputState): void {
    this.input.applyInput(input);
  }
  
  // ============================================
  // Public API - Reset
  // ============================================
  
  reset(startX?: number, facingRight?: boolean): void {
    this.timers.clearAll();
    
    this.state = FighterState.Idle;
    this.previousState = FighterState.Idle;
    this.isBlocking = false;
    this.currentBlockZone = null;
    this.moveDirection = 'none';
    this.isRunning = false;
    this.isWalking = false;
    this.inCombat = false;
    
    this.combat.reset();
    this.damage.reset();
    
    if (startX !== undefined) {
      this.physics.positionX = startX;
    }
    this.physics.positionY = this.physicsConfig.groundY;
    this.physics.velocityX = 0;
    this.physics.velocityY = 0;
    
    if (facingRight !== undefined) {
      this.physics.facingRight = facingRight;
      this.spine.setFacingRight(facingRight);
    }
    
    this.syncSpinePosition();
    this.enterCombat(true);
    this.transitionToIdle();
  }
  
  // ============================================
  // Internal - State Machine (public for FighterControllerRef)
  // ============================================
  
  setState(newState: FighterState): void {
    if (this.state === newState) return;
    if (this.state === FighterState.Dead) return;
    
    // While stunned, only allow transitioning to Idle (when stun ends) or Dead
    if (this.damage.isStunned() && newState !== FighterState.Idle && newState !== FighterState.Dead) {
      return;
    }
    
    this.previousState = this.state;
    this.state = newState;
    this.onStateChange?.(newState, this.previousState);
  }
  
  transitionToIdle(): void {
    this.setState(FighterState.Idle);
    this.anim.playIdle(this.inCombat);
  }
  
  invalidatePendingActions(): void {
    this.actionSequenceId++;
    this.timers.clearAll();
  }
  
  private queueIdleAfterAnimation(): void {
    this.anim.queueIdleTransition(
      this.inCombat,
      this.actionSequenceId,
      () => this.actionSequenceId,
      () => this.state,
      () => this.setState(FighterState.Idle)
    );
  }
}
