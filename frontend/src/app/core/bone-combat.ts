// ============================================================================
// BONE-DRIVEN COMBAT SYSTEM
// ============================================================================
// Uses sampled bone positions from Spine for hitbox collision
// Replaces anchor-rig simulation with direct bone sampling
// VISUAL HIT DETECTION: Hits when bones visually connect during attack state
// ============================================================================

import type { Fighter, GameEvent, HitZone } from './types';
import { BLOCK_CORRECT_REDUCTION, BLOCK_WRONG_REDUCTION, HEAD_DAMAGE_MULTIPLIER, PRESSURE_METER_MAX, PRESSURE_STUN_TICKS } from './config';
import { getAttackData } from '../adapters/attack-resolver';
import type { AttackId } from './attack-types';
import { applyHitKnockback, applyBlockKnockback, applyParryKnockback } from './rules/knockback';
import { forceTransition } from './state-machine';
import type { BoneSamples } from './bone-samples';
import { getCharacter } from '../characters/registry';
import {
  type Circle,
  type Box,
  type Line,
  circleCircleCollision,
  circleBoxCollision,
  lineCircleCollision,
  lineBoxCollision
} from './collision';

// ============================================================================
// ZONE MAPPING (Hurtbox -> HitZone)
// ============================================================================

type HurtboxType = 'head' | 'chest';

/**
 * Maps hurtbox collision to hit zone for block mechanics
 * - head hit -> 'top' zone
 * - chest hit -> 'center' zone
 */
function hitZoneFromHurtbox(hurtbox: HurtboxType): HitZone {
  return hurtbox === 'head' ? 'top' : 'center';
}

/**
 * Check if block zone covers hit zone
 * - blockZone 'top' blocks only 'top' hits
 * - blockZone 'center' blocks 'center' AND 'bottom' hits
 */
function blockCoversZone(blockZone: HitZone, hitZone: HitZone): boolean {
  if (blockZone === 'top') {
    return hitZone === 'top';
  }
  if (blockZone === 'center') {
    return hitZone === 'center'
  }
  return false;  // blockZone 'bottom' not used for defense
}

// ============================================================================
// HIT DETECTION (bone-driven)
// ============================================================================

export interface BoneCombatDebugData {
  attackerBones: BoneSamples;
  defenderBones: BoneSamples;
  hitboxBone: string;
  hitboxPosition: Circle | Line;  // Primary hitbox (the one that hit, or first if no hit)
  allHitboxPositions: { bone: string; position: Circle }[];  // All bone hitboxes for multi-bone attacks
  collisionResult: {
    headHit: boolean;
    chestHit: boolean;
  };
  activeWindow: {
    tickInAttack: number;
    activeFrom: number;
    activeTo: number;
    isActive: boolean;
  };
}

let _boneCombatDebugData: BoneCombatDebugData | null = null;

export function getBoneCombatDebugData(): BoneCombatDebugData | null {
  return _boneCombatDebugData;
}

/**
 * Check if defender has super armor during active attack frames
 */
function hasSuperArmor(defender: Fighter, currentTick: number): boolean {
  // Must be attacking (including telegraph) and have active attack
  if ((defender.state !== 'attack' && defender.state !== 'telegraph') || !defender.activeAttack) {
    return false;
  }

  // Phase-based super armor (all attacks have super armor)
  if (defender.superArmorActive) {
    return true;
  }

  // Attack-specific super armor
  const attackConfig = getAttackData(defender.characterId, defender.activeAttack || '');
  if (!attackConfig.superArmor) {
    return false;
  }

  // Super armor active during entire attack state AND telegraph state
  // (not just during hitbox active window - that's only for hit detection)
  return true;
}

/**
 * Check if attack hits defender (bone-driven)
 */
export function checkBoneHit(
  attacker: Fighter,
  defender: Fighter,
  attackerBones: BoneSamples,
  defenderBones: BoneSamples,
  currentTick: number
): GameEvent | null {
  // Only check during attack state
  if (attacker.state !== 'attack' || !attacker.activeAttack) {
    // Don't clear debug data - keep last valid data for rendering
    return null;
  }

  // CRITICAL: Prevent multi-hit from same attack instance (unless multi-hit attack)
  const multiHitConfig = getAttackData(attacker.characterId, attacker.activeAttack || '');
  if (!multiHitConfig.multiHit && attacker.attackLandedHit) {
    // Don't clear debug data - keep last valid data for rendering
    return null;  // This attack already hit once (single-hit attacks)
  }

  // Multi-hit interval check: prevent hits too frequently
  if (multiHitConfig.multiHit && attacker.lastHitTick >= 0) {
    const ticksSinceLastHit = currentTick - attacker.lastHitTick;
    const hitInterval = multiHitConfig.hitInterval || 10;
    if (ticksSinceLastHit < hitInterval) {
      return null;  // Too soon for next hit
    }
  }

  // Check facing (can't hit behind you)
  const defenderInFront = attacker.facingRight
    ? defender.x > attacker.x
    : defender.x < attacker.x;

  if (!defenderInFront) {
    // Don't clear debug data - keep last valid data for rendering
    return null;
  }

  const attackId = attacker.activeAttack as AttackId;
  const mainAttackConfig = getAttackData(attacker.characterId, attackId);

  // Get character-specific configs
  const characterDef = getCharacter(attacker.characterId);
  if (!characterDef) {
    console.warn(`No character definition for: ${attacker.characterId}`);
    return null;
  }

  const hitboxConfig = characterDef.combat.hitboxes[attackId];
  if (!hitboxConfig) {
    console.warn(`No bone hitbox config for attack: ${attackId}`);
    return null;
  }

  // Check if hitbox is active (VISUAL: attack state = hit detection active)
  if (attacker.state !== 'attack') {
    _boneCombatDebugData = null;
    return null;
  }

  const tickInAttack = attacker.stateTicks;

  // === ACTIVE WINDOW CALCULATION ===
  // 
  // NEW TELEGRAPH SYSTEM:
  // - Animation plays to freezeAtSpineFrame, pauses for freezeDurationMs, then continues
  // - When transitioning to attack state, stateTicks starts at freezeAtSpineFrame × 2
  // - This keeps stateTicks synchronized with animation frames!
  //
  // activeFromFrac/activeToFrac are relative to durationTicks.
  // The key insight: stateTicks in attack state = animation frame number
  // - stateTicks=freezeAtSpineFrame×2 → attack animation resumes (after telegraph)
  // - stateTicks=durationTicks → attack animation ends
  //
  // So activeFromFrac=0.5 means "at 50% of durationTicks frames into the attack"
  // freezeDurationMs can be changed per boss phase WITHOUT affecting hit timing!
  
  const activeFrom = (hitboxConfig.activeFromFrac ?? 0.0) * mainAttackConfig.durationTicks;
  const activeTo = (hitboxConfig.activeToFrac ?? 0.35) * mainAttackConfig.durationTicks;
  
  const isInActiveWindow = tickInAttack >= activeFrom && tickInAttack < activeTo;

  // Get attack hitbox from bone samples (for debug visualization)
  let headHit = false;
  let chestHit = false;
  let hitboxPosition: any;

  // Define defender's hurtboxes from character config
  const defenderCharacterDef = getCharacter(defender.characterId);
  if (!defenderCharacterDef) {
    console.warn(`No character definition for defender: ${defender.characterId}`);
    return null;
  }

  // Flip offsetX based on facing direction (offset is defined for facing right)
  const defenderFacingMultiplier = defender.facingRight ? 1 : -1;

  const headConfig = defenderCharacterDef.combat.hurtboxes['head'];
  const headHurtbox: Circle = {
    x: defenderBones.head.x + (headConfig.offsetX ?? 0) * defenderFacingMultiplier,
    y: defenderBones.head.y + (headConfig.offsetY ?? 0),
    radius: headConfig.radius,
  };

  const chestConfig = defenderCharacterDef.combat.hurtboxes['chest'];
  const chestHurtbox: Box = {
    x: defenderBones.chest.x + (chestConfig.offsetX ?? 0) * defenderFacingMultiplier,
    y: defenderBones.chest.y + (chestConfig.offsetY ?? 0),
    width: chestConfig.width,
    height: chestConfig.height,
  };


  if (hitboxConfig.bone === 'weaponLine') {
    // Weapon line hitbox
    const weaponLine = attackerBones.weaponLine;
    if (!weaponLine) {
      _boneCombatDebugData = null;
      return null;  // No weapon equipped
    }

    const lineHitbox: Line = {
      x1: weaponLine.x1,
      y1: weaponLine.y1,
      x2: weaponLine.x2,
      y2: weaponLine.y2,
      thickness: hitboxConfig.thickness ?? 40,
    };

    hitboxPosition = lineHitbox;

    // Test against hurtboxes (sword can hit both head and body)
    headHit = lineCircleCollision(lineHitbox, headHurtbox);
    chestHit = !headHit && lineBoxCollision(lineHitbox, chestHurtbox);

  } else {
    // Point bone hitbox (hand/foot) - can be single bone or array of bones
    const bones = Array.isArray(hitboxConfig.bone) ? hitboxConfig.bone : [hitboxConfig.bone];
    let hitBoneName: string = bones[0]; // Track which bone actually hit
    const allBoneHitboxes: { bone: string; position: Circle }[] = [];
    
    // Get offset values from config (default to 0)
    // offsetX is flipped based on facing direction (positive = forward)
    const rawOffsetX = hitboxConfig.offsetX ?? 0;
    const offsetX = attacker.facingRight ? rawOffsetX : -rawOffsetX;
    const offsetY = hitboxConfig.offsetY ?? 0;
    
    // Build all hitbox positions first (for debug visualization)
    for (const boneName of bones) {
      if (boneName === 'weaponLine') continue;
      
      const bonePoint = attackerBones[boneName as 'rightHand' | 'leftHand' | 'rightFoot' | 'leftFoot'];
      const attackCircle: Circle = {
        x: bonePoint.x + offsetX,
        y: bonePoint.y + offsetY,
        radius: hitboxConfig.radius,
      };
      
      allBoneHitboxes.push({ bone: boneName, position: attackCircle });
    }
    
    // Store all hitboxes for debug
    (hitboxConfig as any)._allHitboxes = allBoneHitboxes;
    
    // Test each bone until we find a hit
    for (const { bone: boneName, position: attackCircle } of allBoneHitboxes) {
      // Use first bone for initial hitbox position (for debug visualization when no hit)
      if (!hitboxPosition) {
        hitboxPosition = attackCircle;
      }

      // Test against hurtboxes
      const thisHeadHit = !headHit && circleCircleCollision(attackCircle, headHurtbox);
      const thisChestHit = !headHit && !chestHit && circleBoxCollision(attackCircle, chestHurtbox);
      
      // If this bone hit, update hitboxPosition to show the actual hitting bone
      if (thisHeadHit || thisChestHit) {
        headHit = thisHeadHit;
        chestHit = thisChestHit;
        hitboxPosition = attackCircle; // Update to the bone that actually hit
        hitBoneName = boneName;
        break;
      }
    }
    
    // Store the bone name that hit (for debug data below)
    (hitboxConfig as any)._hitBoneName = hitBoneName;
  }

  // Determine which bone to show in debug (use actual hitting bone for arrays)
  const debugBoneName = (hitboxConfig as any)._hitBoneName 
    ?? (Array.isArray(hitboxConfig.bone) ? hitboxConfig.bone[0] : hitboxConfig.bone);
  
  // Get all hitbox positions for multi-bone visualization
  const allHitboxPositions = (hitboxConfig as any)._allHitboxes ?? [];

  // Store debug data (ALWAYS, for visualization even outside active window)
  _boneCombatDebugData = {
    attackerBones,
    defenderBones,
    hitboxBone: debugBoneName,
    hitboxPosition,
    allHitboxPositions,
    collisionResult: { headHit, chestHit },
    activeWindow: {
      tickInAttack,
      activeFrom,
      activeTo,
      isActive: isInActiveWindow,  // True only during active window
    },
  };

  // Early return if outside active window (no hit detection)
  if (!isInActiveWindow) {
    return null;  // Outside active window - debug data set but no collision
  }

  if (!headHit && !chestHit) {
    return null;  // Miss
  }

  // Determine which hurtbox was hit
  const hitHurtbox: HurtboxType = headHit ? 'head' : 'chest';
  const hitZone = hitZoneFromHurtbox(hitHurtbox);

  // ============================================================================
  // BLOCK & PARRY RESOLUTION
  // ============================================================================

  // Apply headshot multiplier (30% bonus damage)
  let finalDamage = headHit
    ? Math.floor(mainAttackConfig.damage * HEAD_DAMAGE_MULTIPLIER)
    : mainAttackConfig.damage;

  let wasBlocked = false;
  let wasParried = false;
  let blockCorrect = false;

  // Check for parry FIRST (uses flag set in step.ts when block pressed)
  if (defender.isParryWindowActive) {
    // PARRY SUCCESS - no damage, zone doesn't matter
    wasParried = true;
    finalDamage = 0;

    // Consume parry window (can only parry once per block press)
    defender.isParryWindowActive = false;

    // Parry rewards (similar to perfect block)
    if (defender.id === 0) {  // Player defender gets special meter
      defender.specialMeter = Math.min(100, defender.specialMeter + 12);
    }

    // Put attacker in brief hurt state (parry punishment)
    forceTransition(attacker, 'hurt');
    attacker.stateTicks = 0;

    // CRITICAL: Mark attack as resolved to prevent multi-parry
    if (!mainAttackConfig.multiHit) {
      attacker.attackLandedHit = true;  // Single-hit: mark as landed permanently
    }
    attacker.lastHitTick = currentTick;  // Multi-hit: track timing for interval
    applyParryKnockback(attacker, defender, mainAttackConfig.knockback);
    // Emit parry event with damage:0 for UI/logging
    return {
      type: 'parry',
      defender: defender.id,
      attacker: attacker.id,
      attack: attackId,
      zone: hitZone,
      damage: 0,  // Explicit damage:0 for UI
    };
  }

  // Check for block (must be in block state AND have blockZone set)
  if (defender.state === 'block' && defender.blockZone !== null) {
    // Normal block (not in parry window)
    wasBlocked = true;
    blockCorrect = blockCoversZone(defender.blockZone, hitZone);

    const reduction = blockCorrect ? BLOCK_CORRECT_REDUCTION : BLOCK_WRONG_REDUCTION;
    finalDamage = Math.floor(mainAttackConfig.damage * (1 - reduction));
    applyBlockKnockback(attacker, defender, mainAttackConfig.knockback);
  }

  // Mark attack as landed for whiff tracking
  if (!mainAttackConfig.multiHit) {
    attacker.attackLandedHit = true;  // Single-hit: mark as landed permanently
  }
  attacker.lastHitTick = currentTick;  // Multi-hit: track timing for interval

  // Apply damage
  defender.health -= finalDamage;
  defender.lastHitByInstanceId = attacker.attackInstanceId;

  // Build meters (player gets special, AI gets pressure)
  // Player (Fighter 0) builds special meter when attacking
  if (attacker.id === 0 && mainAttackConfig.specialCharge) {
    attacker.specialMeter = Math.min(100, attacker.specialMeter + mainAttackConfig.specialCharge);
  }

  // AI (Fighter 1) builds pressure meter when getting hit (but not during pressure stun)
  if (defender.id === 1 && mainAttackConfig.pressureCharge && defender.pressureStunTicks === 0) {
    defender.pressureMeter = Math.min(PRESSURE_METER_MAX, defender.pressureMeter + mainAttackConfig.pressureCharge);
  }
  
  // Check for pressure stun (triggers when meter hits 100%)
  // IMPORTANT: Pressure stun IGNORES super armor - it's meant to break through aggressive bosses!
  if (defender.id === 1 && defender.pressureStunTicks === 0 && defender.pressureMeter >= PRESSURE_METER_MAX) {
    // Trigger pressure stun: force hurt state and set stun timer
    forceTransition(defender, 'hurt');
    defender.stateTicks = 0;
    defender.pressureStunTicks = PRESSURE_STUN_TICKS;
    defender.activeAttack = null;  // Cancel any ongoing attack
    // Note: pressureMeter reset happens after stun ends in step.ts
  }

  // Clamp health to 0 and check for death
  if (defender.health <= 0) {
    defender.health = 0;
    // Trigger death state if not already dead
    if (defender.state !== 'dead') {
      forceTransition(defender, 'dead');
    }
  }

  // Emit block event if blocked (but not parried)
  if (wasBlocked && !wasParried) {
    // Perfect block rewards
    if (blockCorrect) {


      // Put attacker in brief hurt state (perfect block punishment)
      forceTransition(attacker, 'hurt');
      attacker.stateTicks = 0;
    }

    // Apply hurt state with reduced stun to defender (unless super armor)
    if (!hasSuperArmor(defender, currentTick)) {
      forceTransition(defender, 'hurt');
      defender.stateTicks = 0;
    }

    return {
      type: 'block',
      defender: defender.id,
      attacker: attacker.id,
      attack: attackId,
      zone: hitZone,
      damage: finalDamage,
      perfect: blockCorrect,
    };
  }

  // Normal hit - apply hurt state (unless defender has super armor)
  if (!hasSuperArmor(defender, currentTick)) {
    forceTransition(defender, 'hurt');
    defender.stateTicks = 0;
  }
  applyHitKnockback(attacker, defender, mainAttackConfig.knockback);

  return {
    type: 'hit',
    attacker: attacker.id,
    defender: defender.id,
    attack: attackId,
    zone: hitZone,
    damage: finalDamage,
  };
}
