// ============================================
// Combat System - Health, Damage & Collision
// ============================================

import { signal, computed, Signal, WritableSignal } from '@angular/core';
import { FighterController } from './fighter-controller';
import { FighterState, HitZone } from './types';
import { HitboxProvider } from './hitbox-provider';
import { getAttackConfig } from './attack-data';
import {
  SPECIAL_METER_MAX,
  PERFECT_BLOCK_STUN_BONUS,
  StunState,
  MeterState,
  createStunMeter,
  createSpecialMeter,
  addToMeter,
  fillMeter,
  consumeMeter,
  resetMeter,
  getStunIncrease,
  triggerStun,
  updateStun,
  endStun
} from './meter-system';
import { CombatLog, CombatEventType, WeaponType, getGlobalCombatLog } from './combat-log';

// Re-export meter constants for backwards compatibility
export {
  STUN_METER_MAX,
  STUN_METER_HEAD_HIT,
  STUN_METER_BODY_HIT,
  STUN_DURATION_MS,
  SPECIAL_METER_MAX
} from './meter-system';

// ============================================
// Combat Configuration
// ============================================

// Block damage configuration
export const PERFECT_BLOCK_WINDOW_MS = 300; // 300ms window for perfect block (0 damage)
export const NORMAL_BLOCK_REDUCTION = 0.6;  // 60% damage when blocking correct zone
export const WRONG_ZONE_BLOCK_REDUCTION = 0.4; // 40% damage reduction for wrong zone

// Jump stomp damage (uses actual foot bone positions)
export const JUMP_STOMP_DAMAGE = 5; // Small damage when landing on opponent
export const JUMP_STOMP_FOOT_RADIUS = 120; // Large hitbox for backflip kick animation

// ============================================
// Fighter Stats (uses meter-system types)
// ============================================

export interface FighterStats {
  maxHealth: number;
  currentHealth: WritableSignal<number>;
  isAlive: Signal<boolean>;
  stun: StunState;      // AI only - stun meter and state
  special: MeterState;  // Player only - special meter
}

export function createFighterStats(maxHealth: number = 100, startingHealth?: number): FighterStats {
  const currentHealth = signal(startingHealth ?? maxHealth);
  const isAlive = computed(() => currentHealth() > 0);
  
  return {
    maxHealth,
    currentHealth,
    isAlive,
    stun: createStunMeter(),
    special: createSpecialMeter()
  };
}

// ============================================
// Combat Constants
// ============================================

/**
 * Headshot damage multiplier - hits to the head deal extra damage
 */
export const HEADSHOT_DAMAGE_MULTIPLIER = 1.5;

// ============================================
// Combat System
// ============================================

export interface CombatConfig {
  player1: FighterController;
  player2: FighterController;
  player1MaxHealth?: number;
  player1StartingHealth?: number; // Starting health (for carry-over between levels)
  player2MaxHealth?: number;
  // Bonus effects for player 1 (campaign mode)
  player1DamageMultiplier?: number;
  player1BlockReduction?: number;
  player1Vampirism?: number;
  player1StunMultiplier?: number;
  player1SpecialChargeMultiplier?: number;
  player1PerfectBlockWindowBonus?: number;
  onHealthChange?: (player: 1 | 2, health: number, maxHealth: number) => void;
  onStunMeterChange?: (player: 1 | 2, stunMeter: number) => void;
  onSpecialMeterChange?: (specialMeter: number) => void; // Player 1 special meter
  onStunStart?: (player: 1 | 2) => void;
  onStunEnd?: (player: 1 | 2) => void;
  onHit?: (attacker: 1 | 2, defender: 1 | 2, damage: number, blocked: boolean, hitZone: 'head' | 'body' | 'stomp' | null, perfectBlock?: boolean) => void;
  onKO?: (loser: 1 | 2) => void;
}

export class CombatSystem {
  private player1: FighterController;
  private player2: FighterController;
  
  // Health stats (signal-based for reactivity)
  readonly player1Stats: FighterStats;
  readonly player2Stats: FighterStats;
  
  // Bonus effects (campaign mode)
  private player1DamageMultiplier: number = 1.0;
  private player1BlockReduction: number = NORMAL_BLOCK_REDUCTION;
  private player1Vampirism: number = 0;
  private player1StunMultiplier: number = 1.0;
  private player1SpecialChargeMultiplier: number = 1.0;
  private player1PerfectBlockWindowBonus: number = 0;
  
  // Attack tracking
  private player1AttackHit: boolean = false;
  private player2AttackHit: boolean = false;
  private player1LastHitTime: number = 0;
  private player2LastHitTime: number = 0;
  
  // Jump stomp tracking (prevent multiple hits per jump)
  private player1JumpStompHit: boolean = false;
  private player2JumpStompHit: boolean = false;
  
  // Game clock (accumulated time for consistent timing)
  private gameTime: number = 0;
  
  // Frame time (performance.now() at start of update - consistent within frame)
  private frameTime: number = 0;
  
  // Callbacks
  private onHealthChange?: CombatConfig['onHealthChange'];
  private onStunMeterChange?: CombatConfig['onStunMeterChange'];
  private onSpecialMeterChange?: CombatConfig['onSpecialMeterChange'];
  private onStunStart?: CombatConfig['onStunStart'];
  private onStunEnd?: CombatConfig['onStunEnd'];
  private onHit?: CombatConfig['onHit'];
  private onKO?: CombatConfig['onKO'];
  
  // Combat log for tracking fight events
  private combatLog: CombatLog;
  
  // Match state
  private matchActive: boolean = true;
  private frameCount: number = 0;
  
  constructor(config: CombatConfig) {
    this.player1 = config.player1;
    this.player2 = config.player2;
    this.combatLog = getGlobalCombatLog();
    this.combatLog.clear(); // Start fresh for each match
    this.onHealthChange = config.onHealthChange;
    this.onStunMeterChange = config.onStunMeterChange;
    this.onSpecialMeterChange = config.onSpecialMeterChange;
    this.onStunStart = config.onStunStart;
    this.onStunEnd = config.onStunEnd;
    this.onHit = config.onHit;
    this.onKO = config.onKO;
    
    // Apply bonus effects
    if (config.player1DamageMultiplier) this.player1DamageMultiplier = config.player1DamageMultiplier;
    if (config.player1BlockReduction) this.player1BlockReduction = config.player1BlockReduction;
    if (config.player1Vampirism) this.player1Vampirism = config.player1Vampirism;
    if (config.player1StunMultiplier) this.player1StunMultiplier = config.player1StunMultiplier;
    if (config.player1SpecialChargeMultiplier) this.player1SpecialChargeMultiplier = config.player1SpecialChargeMultiplier;
    if (config.player1PerfectBlockWindowBonus) this.player1PerfectBlockWindowBonus = config.player1PerfectBlockWindowBonus;
    
    // Initialize health with custom values or defaults
    // Player 1 can have a different starting health (for level carry-over in campaign)
    this.player1Stats = createFighterStats(
      config.player1MaxHealth ?? 100, 
      config.player1StartingHealth
    );
    this.player2Stats = createFighterStats(config.player2MaxHealth ?? 100);
  }
  
  /**
   * Update combat system (call every frame with deltaTime in ms)
   * @param deltaTime Time since last frame in milliseconds
   */
  update(deltaTime: number = 16.67): void {
    if (!this.matchActive) return;
    
    this.frameCount++;
    this.gameTime += deltaTime;
    this.frameTime = performance.now(); // Consistent time reference for this frame
    
    // Update stun states (tick-based)
    this.updateStunStates(deltaTime);
    
    // Update facing direction - both fighters should face each other
    this.updateFacing();
    
    // Prevent fighters from overlapping (pushback)
    this.applyPushback();
    
    // Check for jump stomp damage
    this.checkJumpStomps();
    
    // Check for attacks and collisions
    this.checkAttackCollisions();
    
    // Check for KO
    this.checkKO();
  }
  
  /**
   * Update facing direction for both fighters to face each other
   */
  private updateFacing(): void {
    const pos1 = this.player1.getPosition();
    const pos2 = this.player2.getPosition();
    
    this.player1.updateFacingToOpponent(pos2.x);
    this.player2.updateFacingToOpponent(pos1.x);
  }
  
  /**
   * Minimum distance between fighters - they push each other apart if too close
   * Must be LESS than bare-hands attack range (~180px) or melee fighters can't connect!
   */
  private readonly MIN_FIGHTER_DISTANCE = 120;
  
  /**
   * Apply pushback when fighters overlap - prevents them from standing inside each other
   * SKIP during jumps to allow crossup!
   */
  private applyPushback(): void {
    // Skip pushback if either fighter is jumping - allows crossup
    if (this.player1.getState() === FighterState.Jump || 
        this.player2.getState() === FighterState.Jump) {
      return;
    }
    
    const pos1 = this.player1.getPosition();
    const pos2 = this.player2.getPosition();
    
    const distance = Math.abs(pos1.x - pos2.x);
    
    if (distance < this.MIN_FIGHTER_DISTANCE) {
      // Fighters are too close - push them apart
      const overlap = this.MIN_FIGHTER_DISTANCE - distance;
      
      // Determine who pushes who based on state priority:
      // 1. Attacking fighters don't get pushed (they push through)
      // 2. Blocking fighters resist being pushed (but still get pushed a bit)
      // 3. Everyone else gets pushed equally
      const p1State = this.player1.getState();
      const p2State = this.player2.getState();
      
      const p1Attacking = p1State === FighterState.Attack;
      const p2Attacking = p2State === FighterState.Attack;
      const p1Blocking = p1State === FighterState.Block;
      const p2Blocking = p2State === FighterState.Block;
      
      // Calculate push ratio: who gets pushed more
      // Attacker: 0, Blocker: 0.3, Normal: 1.0
      let p1PushRatio = p1Attacking ? 0 : (p1Blocking ? 0.3 : 1.0);
      let p2PushRatio = p2Attacking ? 0 : (p2Blocking ? 0.3 : 1.0);
      
      // Normalize so total = 1 (if both are 0, split equally)
      const totalRatio = p1PushRatio + p2PushRatio;
      if (totalRatio > 0) {
        p1PushRatio /= totalRatio;
        p2PushRatio /= totalRatio;
      } else {
        // Both attacking - neither gets pushed much, slight separation
        p1PushRatio = 0.5;
        p2PushRatio = 0.5;
      }
      
      const p1Push = overlap * p1PushRatio + 1;
      const p2Push = overlap * p2PushRatio + 1;
      
      if (pos1.x < pos2.x) {
        // Player 1 is on the left
        this.player1.setPosition(pos1.x - p1Push, pos1.y);
        this.player2.setPosition(pos2.x + p2Push, pos2.y);
      } else {
        // Player 1 is on the right
        this.player1.setPosition(pos1.x + p1Push, pos1.y);
        this.player2.setPosition(pos2.x - p2Push, pos2.y);
      }
    }
  }
  
  /**
   * Check for jump stomp damage - when jumping fighter's feet hit opponent
   * Uses actual foot bone positions from animation
   */
  private checkJumpStomps(): void {
    const p1State = this.player1.getState();
    const p2State = this.player2.getState();
    
    // Player 1 jump kick on Player 2 (active during entire jump)
    if (p1State === FighterState.Jump && !this.player1JumpStompHit) {
      if (this.checkFootHit(this.player1, this.player2)) {
        console.log('[Jump Kick] P1 HIT!');
        this.applyJumpStompDamage(1, 2);
        this.player1JumpStompHit = true;
      }
    } else if (p1State !== FighterState.Jump) {
      this.player1JumpStompHit = false;
    }
    
    // Player 2 jump kick on Player 1 (active during entire jump)
    if (p2State === FighterState.Jump && !this.player2JumpStompHit) {
      if (this.checkFootHit(this.player2, this.player1)) {
        console.log('[Jump Kick] P2 HIT!');
        this.applyJumpStompDamage(2, 1);
        this.player2JumpStompHit = true;
      }
    } else if (p2State !== FighterState.Jump) {
      this.player2JumpStompHit = false;
    }
  }
  
  /**
   * Check if attacker's feet hit defender's hurtbox
   */
  private checkFootHit(attacker: FighterController, defender: FighterController): boolean {
    const attackerBones = attacker.getAttackBonePositions();
    const defenderHurtbox = defender.getHurtboxPositions();
    
    if (!defenderHurtbox.body && !defenderHurtbox.head) return false;
    
    // Check both feet
    const feet = [attackerBones.rightFoot, attackerBones.leftFoot];
    
    for (const foot of feet) {
      if (!foot) continue;
      
      // Check against body hurtbox
      if (defenderHurtbox.body) {
        const body = defenderHurtbox.body;
        const hitboxLeft = body.x - body.width / 2 - JUMP_STOMP_FOOT_RADIUS;
        const hitboxRight = body.x + body.width / 2 + JUMP_STOMP_FOOT_RADIUS;
        const hitboxBottom = body.y - body.height / 2 - JUMP_STOMP_FOOT_RADIUS;
        const hitboxTop = body.y + body.height / 2 + JUMP_STOMP_FOOT_RADIUS;
        
        if (foot.x >= hitboxLeft && foot.x <= hitboxRight &&
            foot.y >= hitboxBottom && foot.y <= hitboxTop) {
          return true;
        }
      }
      
      // Check against head hurtbox
      if (defenderHurtbox.head) {
        const head = defenderHurtbox.head;
        const dx = foot.x - head.x;
        const dy = foot.y - head.y;
        const combinedRadius = head.radius + JUMP_STOMP_FOOT_RADIUS;
        if (dx * dx + dy * dy <= combinedRadius * combinedRadius) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Apply jump stomp damage (unblockable, small damage)
   */
  private applyJumpStompDamage(attacker: 1 | 2, defender: 1 | 2): void {
    const defenderStats = defender === 1 ? this.player1Stats : this.player2Stats;
    const attackerController = attacker === 1 ? this.player1 : this.player2;
    
    const newHealth = Math.max(0, defenderStats.currentHealth() - JUMP_STOMP_DAMAGE);
    defenderStats.currentHealth.set(newHealth);
    
    // Log to combat log
    const weapon: WeaponType = attackerController.getLoadout() === 'sword' ? 'sword' : 'bare';
    this.combatLog.add({
      type: 'stomp',
      attacker,
      defender,
      damage: JUMP_STOMP_DAMAGE,
      weapon,
      attackName: 'jump_stomp'
    });
    
    this.onHealthChange?.(defender, newHealth, defenderStats.maxHealth);
    this.onHit?.(attacker, defender, JUMP_STOMP_DAMAGE, false, 'stomp', false);
  }
  
  /**
   * Update stun states using meter-system
   * Note: Only Player 2 (AI) can be stunned
   */
  private updateStunStates(deltaTime: number): void {
    // Player 1 cannot be stunned - skip
    
    // Check player 2 stun (AI only) using meter-system
    if (updateStun(this.player2Stats.stun, deltaTime)) {
      // Stun just ended
      this.player2.setStunned(false);
      this.onStunMeterChange?.(2, 0);
      this.onStunEnd?.(2);
    }
  }
  
  /**
   * Check if a player is currently stunned
   */
  isPlayerStunned(playerNum: 1 | 2): boolean {
    const stats = playerNum === 1 ? this.player1Stats : this.player2Stats;
    return stats.stun.isStunned();
  }
  
  private checkAttackCollisions(): void {
    // Use internal game time for consistent timing
    const now = this.gameTime;
    
    // ========== PLAYER 1 ATTACK ==========
    const p1Attacking = this.player1.getState() === FighterState.Attack;
    const p1AttackId = this.player1.getActiveAttackId();
    
    if (p1Attacking && p1AttackId) {
      const attackConfig = getAttackConfig(p1AttackId);
      const isMultiHit = attackConfig?.multiHit ?? false;
      const hitInterval = attackConfig?.hitIntervalMs ?? 0;
      
      const canHit = !this.player1AttackHit || 
        (isMultiHit && (now - this.player1LastHitTime) >= hitInterval);
      
      if (canHit && this.checkHit(this.player1, this.player2)) {
        this.processHit(1, 2);
        this.player1AttackHit = true;
        this.player1LastHitTime = now;
      }
    } else {
      this.player1AttackHit = false;
    }
    
    // ========== PLAYER 2 (AI) ATTACK ==========
    const p2Attacking = this.player2.getState() === FighterState.Attack;
    const p2AttackId = this.player2.getActiveAttackId();
    
    if (p2Attacking && p2AttackId) {
      const attackConfig = getAttackConfig(p2AttackId);
      const isMultiHit = attackConfig?.multiHit ?? false;
      const hitInterval = attackConfig?.hitIntervalMs ?? 0;
      
      const canHit = !this.player2AttackHit || 
        (isMultiHit && (now - this.player2LastHitTime) >= hitInterval);
      
      if (canHit && this.checkHit(this.player2, this.player1)) {
        this.processHit(2, 1);
        this.player2AttackHit = true;
        this.player2LastHitTime = now;
      }
    } else {
      this.player2AttackHit = false;
    }
  }
  
  private checkHit(attacker: FighterController, defender: FighterController): boolean {
    return this.checkHitDetailed(attacker, defender) !== null;
  }
  
  /**
   * Detailed hit check using HitboxProvider
   * Returns 'head', 'body', or null if no hit
   */
  private checkHitDetailed(attacker: FighterController, defender: FighterController): 'head' | 'body' | null {
    // First, check if attacker is facing the defender
    // This prevents hitting with the back of the weapon or during wind-up
    if (!this.isFacingOpponent(attacker, defender)) {
      return null;
    }
    
    // Get attack hitbox from HitboxProvider (handles both point and line hitboxes)
    const hitbox = attacker.getActiveHitbox();
    if (!hitbox) return null;
    
    // Get defender's hurtboxes
    const hurtboxes = defender.getHurtboxPositions();
    
    // Use HitboxProvider for collision detection
    return HitboxProvider.checkHurtboxCollision(hitbox, hurtboxes);
  }
  
  /**
   * Check if attacker is facing the defender
   * Prevents hitting opponents behind you
   */
  private isFacingOpponent(attacker: FighterController, defender: FighterController): boolean {
    const attackerPos = attacker.getPosition();
    const defenderPos = defender.getPosition();
    const attackerFacingRight = attacker.isFacingRight();
    
    // Small tolerance to handle fighters at nearly the same X position
    // This ensures hits register even when fighters are very close
    const tolerance = 10;
    
    // If attacker faces right, defender must be to the right (or within tolerance)
    // If attacker faces left, defender must be to the left (or within tolerance)
    if (attackerFacingRight) {
      return defenderPos.x >= attackerPos.x - tolerance;
    } else {
      return defenderPos.x <= attackerPos.x + tolerance;
    }
  }
  
  private processHit(attackerNum: 1 | 2, defenderNum: 1 | 2): void {
    const attacker = attackerNum === 1 ? this.player1 : this.player2;
    const defender = defenderNum === 1 ? this.player1 : this.player2;
    const defenderStats = defenderNum === 1 ? this.player1Stats : this.player2Stats;
    const attackerStats = attackerNum === 1 ? this.player1Stats : this.player2Stats;
    
    // Get attack config from attack-data.ts
    const attackId = attacker.getActiveAttackId();
    const attackConfig = attackId ? getAttackConfig(attackId) : null;
    if (!attackConfig) return;
    
    // Determine what body part was hit
    const hitZone = this.checkHitDetailed(attacker, defender);
    const isHeadshot = hitZone === 'head';
    
    // Check if defender is blocking
    const isBlocking = defender.isCurrentlyBlocking();
    const blockZone = defender.getBlockZone();
    
    // Grace period: If player released block very recently, ONLY perfect block is possible
    // This allows quick-tap perfect blocks but doesn't give free damage reduction
    const BLOCK_GRACE_PERIOD_MS = 150; // 150ms grace period after releasing block
    const blockEndTime = defender.getBlockEndTime();
    const now = this.frameTime; // Use consistent frame time
    const timeSinceBlockEnd = now - blockEndTime;
    const isInGracePeriod = !isBlocking && timeSinceBlockEnd <= BLOCK_GRACE_PERIOD_MS && blockEndTime > 0;
    
    // DEBUG: Log every hit
    console.log(`[HIT] P${attackerNum} -> P${defenderNum} with ${attackId}, isBlocking=${isBlocking}, gracePeriod=${isInGracePeriod}`);
    
    let damage = attackConfig.baseDamage;
    let blocked = false;
    let isPerfectBlock = false;
    
    // Apply damage multiplier (player 1 bonus)
    if (attackerNum === 1 && this.player1DamageMultiplier !== 1.0) {
      damage = Math.floor(damage * this.player1DamageMultiplier);
    }
    
    // Apply headshot multiplier
    if (isHeadshot && attackConfig.headshotMultiplier) {
      damage = Math.floor(damage * attackConfig.headshotMultiplier);
    } else if (isHeadshot) {
      damage = Math.floor(damage * HEADSHOT_DAMAGE_MULTIPLIER);
    }
    
    // Calculate effective perfect block window (base + bonus for player 1)
    const perfectBlockWindow = defenderNum === 1 
      ? PERFECT_BLOCK_WINDOW_MS + this.player1PerfectBlockWindowBonus 
      : PERFECT_BLOCK_WINDOW_MS;
    
    // Check for active blocking
    if (isBlocking) {
      blocked = true;
      // Block zone based on WHERE the hit lands, not the attack type
      const requiredBlockZone: HitZone = isHeadshot ? 'top' : 'center';
      const blockStartTime = defender.getBlockStartTime();
      const timeSinceBlock = now - blockStartTime;
    
      // Check for perfect block (within timing window - zone doesn't matter!)
      if (timeSinceBlock <= perfectBlockWindow) {
        // Perfect block - no damage! (any zone counts)
        damage = 0;
        isPerfectBlock = true;
        console.log(`✅ PERFECT BLOCK! Blocked after ${timeSinceBlock.toFixed(0)}ms (window: ${perfectBlockWindow}ms)`);
      
      } else if (blockZone === requiredBlockZone) {
        // Normal block with correct zone - use player's block reduction bonus if defending
        const blockReduction = defenderNum === 1 ? this.player1BlockReduction : NORMAL_BLOCK_REDUCTION;
        damage = Math.floor(damage * (1 - blockReduction));
        const tooLateBy = timeSinceBlock - perfectBlockWindow;
        console.log(`❌ PERFECT BLOCK FAILED! Du warst ${tooLateBy.toFixed(0)}ms zu SPÄT! (brauchtest ≤${perfectBlockWindow}ms, hattest ${timeSinceBlock.toFixed(0)}ms)`);
      
      } else {
        // Wrong zone blocked - reduced damage reduction
        damage = Math.floor(damage * (1 - WRONG_ZONE_BLOCK_REDUCTION));
        const tooLateBy = timeSinceBlock - perfectBlockWindow;
        console.log(`❌ PERFECT BLOCK FAILED! Du warst ${tooLateBy.toFixed(0)}ms zu SPÄT! (brauchtest ≤${perfectBlockWindow}ms, hattest ${timeSinceBlock.toFixed(0)}ms) + falsche Zone`);
      }
    } else if (isInGracePeriod) {
      // Grace period: ONLY perfect block is possible, no normal damage reduction!
      const blockStartTime = defender.getBlockStartTime();
      const timeSinceBlock = now - blockStartTime;
      
      if (timeSinceBlock <= perfectBlockWindow) {
        // Perfect block via grace period - no damage!
        blocked = true;
        damage = 0;
        isPerfectBlock = true;
        console.log(`✅ PERFECT BLOCK! (grace period) Blocked after ${timeSinceBlock.toFixed(0)}ms (window: ${perfectBlockWindow}ms)`);
      } else {
        // Grace period but too late for perfect block - full damage!
        console.log(`❌ Grace period but too late for perfect block (${timeSinceBlock.toFixed(0)}ms > ${perfectBlockWindow}ms) - full damage`);
      }
    }
    
    // Log to combat log
    const weapon: WeaponType = attacker.getLoadout() === 'sword' ? 'sword' : 'bare';
    let eventType: CombatEventType = 'hit';
    if (isPerfectBlock) {
      eventType = 'perfect-block';
    } else if (blocked) {
      eventType = 'blocked';
    } else if (isHeadshot) {
      eventType = 'headshot';
    }
    
    this.combatLog.add({
      type: eventType,
      attacker: attackerNum,
      defender: defenderNum,
      damage,
      weapon,
      attackName: attackId ?? undefined
    });
    
    // Apply damage
    const newHealth = Math.max(0, defenderStats.currentHealth() - damage);
    defenderStats.currentHealth.set(newHealth);
    
    // Apply vampirism (player 1 only, heals on hit)
    if (attackerNum === 1 && this.player1Vampirism > 0 && damage > 0 && !blocked) {
      const healAmount = this.player1Vampirism;
      const currentHealth = attackerStats.currentHealth();
      const maxHealth = attackerStats.maxHealth;
      const healedHealth = Math.min(maxHealth, currentHealth + healAmount);
      attackerStats.currentHealth.set(healedHealth);
      this.onHealthChange?.(1, healedHealth, maxHealth);
    }
    
    // Update meters based on who is attacking (only if not blocked)
    if (!blocked) {
      if (attackerNum === 1) {
        // Player 1 attacking: charge special meter using meter-system
        let specialCharge = attackConfig.specialCharge ?? 10;
        // Apply special charge multiplier bonus
        specialCharge = Math.floor(specialCharge * this.player1SpecialChargeMultiplier);
        const newSpecialMeter = addToMeter(this.player1Stats.special, specialCharge);
        this.onSpecialMeterChange?.(newSpecialMeter);
        
        // Also add stun to AI (player 2) using meter-system
        // BUT only if AI is not already stunned! (prevents perma-stun)
        if (!defenderStats.stun.isStunned()) {
          let stunIncrease = getStunIncrease(isHeadshot);
          // Apply stun multiplier bonus
          stunIncrease = Math.floor(stunIncrease * this.player1StunMultiplier);
          const newStunMeter = addToMeter(defenderStats.stun, stunIncrease);
          this.onStunMeterChange?.(defenderNum, newStunMeter);
          
          // Check if stun meter is full
          if (defenderStats.stun.isFull()) {
            this.triggerStunOnPlayer(defenderNum);
          }
        }
      } else {
        // Player 2 (AI) attacking: no stun for player 1, no special meter for AI
        // Player 1 cannot be stunned, so we skip stun logic
      }
    }
    
    // Trigger hit reaction on defender (use actual hit zone)
    const hitReactionZone: HitZone = isHeadshot ? 'top' : (attackConfig.targetZone === 'bottom' ? 'bottom' : 'center');
    
    // Check for super armor - defender takes damage but is NOT interrupted
    const hasSuperArmor = defender.hasSuperArmor();
    // @ts-ignore - debug only
    const fighterId = (defender as any)._debugId || 'no-id';
    console.log(`[Combat] processHit: defender ${fighterId} hasSuperArmor=${hasSuperArmor}`);
    
    if (!blocked && !hasSuperArmor) {
      defender.takeHit(hitReactionZone);
      
      // Apply knockback (only if no super armor)
      if (attackConfig.knockback) {
        const knockbackDir = attacker.isFacingRight() ? 1 : -1;
        const currentPos = defender.getPosition();
        defender.setPosition(currentPos.x + attackConfig.knockback * knockbackDir, currentPos.y);
      }
    } else if (hasSuperArmor && !blocked) {
      // Super armor: take damage but don't interrupt attack
      console.log(`[Combat] Super Armor absorbed hit! Damage: ${damage}`);
    } else if (isPerfectBlock) {
      // Perfect block: push attacker back (punish)
      const knockbackDir = attacker.isFacingRight() ? -1 : 1;
      const attackerPos = attacker.getPosition();
      attacker.setPosition(attackerPos.x + 80 * knockbackDir, attackerPos.y);
      
      // Perfect block fills special meter to 100%!
      if (defenderNum === 1) {
        fillMeter(this.player1Stats.special);
        this.onSpecialMeterChange?.(SPECIAL_METER_MAX);
      }
      
      // Perfect block adds stun bonus to attacker's stun meter (AI only)
      if (attackerNum === 2) {
        const newStun = addToMeter(this.player2Stats.stun, PERFECT_BLOCK_STUN_BONUS);
        this.onStunMeterChange?.(2, newStun);
        
        // Check if stun meter is full
        if (this.player2Stats.stun.isFull()) {
          this.triggerStunOnPlayer(2);
        }
      }
    }
    
    // Callbacks
    this.onHealthChange?.(defenderNum, newHealth, defenderStats.maxHealth);
    this.onHit?.(attackerNum, defenderNum, damage, blocked, hitZone, isPerfectBlock);
  }
  
  /**
   * Trigger stun state for a player using meter-system
   */
  private triggerStunOnPlayer(playerNum: 1 | 2): void {
    const stats = playerNum === 1 ? this.player1Stats : this.player2Stats;
    const player = playerNum === 1 ? this.player1 : this.player2;
    
    // Use meter-system to trigger stun
    triggerStun(stats.stun);
    
    // setStunned now handles the animation internally
    player.setStunned(true);
    
    this.onStunStart?.(playerNum);
  }
  
  private checkKO(): void {
    if (!this.player1Stats.isAlive()) {
      this.matchActive = false;
      this.player1.die('A');
      this.onKO?.(1);
    }
    
    if (!this.player2Stats.isAlive()) {
      this.matchActive = false;
      this.player2.die('A');
      this.onKO?.(2);
    }
  }
  
  // ============================================
  // Public API
  // ============================================
  
  getPlayer1Health(): number {
    return this.player1Stats.currentHealth();
  }
  
  getPlayer2Health(): number {
    return this.player2Stats.currentHealth();
  }
  
  getPlayer1StunMeter(): number {
    return this.player1Stats.stun.value();
  }
  
  getPlayer2StunMeter(): number {
    return this.player2Stats.stun.value();
  }
  
  getPlayer1SpecialMeter(): number {
    return this.player1Stats.special.value();
  }
  
  /**
   * Get the combat log instance
   */
  getCombatLog(): CombatLog {
    return this.combatLog;
  }
  
  /**
   * Check if player 1 can use special attack (meter full)
   */
  canUseSpecial(): boolean {
    return this.player1Stats.special.isFull();
  }
  
  /**
   * Consume the special meter when special attack is used
   */
  consumeSpecialMeter(): void {
    consumeMeter(this.player1Stats.special);
    this.onSpecialMeterChange?.(0);
  }
  
  isMatchActive(): boolean {
    return this.matchActive;
  }
  
  reset(): void {
    this.player1Stats.currentHealth.set(this.player1Stats.maxHealth);
    this.player2Stats.currentHealth.set(this.player2Stats.maxHealth);
    // Reset meters using meter-system
    resetMeter(this.player1Stats.stun);
    resetMeter(this.player2Stats.stun);
    resetMeter(this.player1Stats.special);
    resetMeter(this.player2Stats.special);
    endStun(this.player1Stats.stun);
    endStun(this.player2Stats.stun);
    this.matchActive = true;
    this.player1AttackHit = false;
    this.player2AttackHit = false;
    this.player1LastHitTime = 0;
    this.player2LastHitTime = 0;
    this.frameCount = 0;
    this.gameTime = 0;
    
    // Note: Position reset is handled by game-engine.resetMatch()
    // This only resets combat state
  }
  
  /**
   * Apply damage directly (for network sync)
   */
  applyDamage(playerNum: 1 | 2, damage: number, hitZone: HitZone): void {
    const stats = playerNum === 1 ? this.player1Stats : this.player2Stats;
    const defender = playerNum === 1 ? this.player1 : this.player2;
    
    const newHealth = Math.max(0, stats.currentHealth() - damage);
    stats.currentHealth.set(newHealth);
    
    defender.takeHit(hitZone);
    
    this.onHealthChange?.(playerNum, newHealth, stats.maxHealth);
    this.checkKO();
  }
  
  /**
   * Sync health from network (for online mode)
   */
  syncHealth(player1Health: number, player2Health: number): void {
    this.player1Stats.currentHealth.set(player1Health);
    this.player2Stats.currentHealth.set(player2Health);
  }
}
