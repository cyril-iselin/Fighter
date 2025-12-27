// ============================================================================
// GENERIC BASIC BRAIN (Profile-Driven)
// ============================================================================
// Generic AI implementation driven by CharacterAIProfile
// No character-specific logic - all behavior comes from profile
// ============================================================================

import type { IFighterBrain } from '../brain.interface';
import type { Observation, Intent, AttackCommand, FighterState, HitZone, Loadout } from '../../core/types';
import type { CharacterAIProfile, AttackWeight, BossPhase } from './types';
import { getCharacterAttackData, getAttacksForLoadout } from '../../characters/provider-registry';
import type { IRNG } from '../rng';
import { SeededRNG } from '../rng';

/**
 * GenericBasicBrain - Profile-driven AI with anti-flicker logic
 * All character-specific behavior is defined in the profile
 * Attack ranges are read from attack-data.ts (engageRange per attack)
 */
export class GenericBasicBrain implements IFighterBrain {
  // Anti-flicker state
  private lastChaseDir: 'left' | 'right' | null = null;
  private chaseDirLockUntil = -1;
  private lastRetreatDir: 'left' | 'right' | null = null;
  private retreatDirLockUntil = -1;
  private inEngageRange = false;
  private engageLockUntil = -1;

  // Attack cooldown tracking
  private attackCooldowns = new Map<AttackCommand, number>();
  
  // Cached engage range per loadout (computed from attack-data)
  private engageRangeCache = new Map<Loadout, number>();
  
  // Current phase tracking
  private currentPhase: BossPhase | null = null;
  private lastPhaseHpPercent: number = 100;
  private pendingPhaseChange: { phaseName: string; hpPercent: number } | null = null;

  constructor(
    private readonly characterId: string,
    private readonly profile: CharacterAIProfile,
    private readonly rng: IRNG = new SeededRNG()
  ) {}

  // ============================================================================
  // PHASE SYSTEM
  // ============================================================================
  
  /**
   * Get the current phase based on HP percentage
   * 
   * Phase logic: Each phase activates when HP drops to or below its threshold.
   * We use the phase with the LOWEST threshold that the current HP is still at or below.
   * 
   * Example with phases [100%, 50%, 25%]:
   *   - HP 80% → Phase 100 (80 <= 100, 80 > 50)
   *   - HP 50% → Phase 50  (50 <= 50, 50 > 25)  
   *   - HP 40% → Phase 50  (40 <= 50, 40 > 25)
   *   - HP 25% → Phase 25  (25 <= 25)
   *   - HP 10% → Phase 25  (10 <= 25)
   */
  private getCurrentPhase(hpPercent: number): BossPhase | null {
    if (!this.profile.phases || this.profile.phases.length === 0) {
      return null;
    }
    
    // Sort phases by hpPercent descending (100, 50, 25)
    const sortedPhases = [...this.profile.phases].sort((a, b) => b.hpPercent - a.hpPercent);
    
    // Find the phase with the lowest hpPercent that is still >= currentHP
    let activePhase: BossPhase | null = null;
    
    for (const phase of sortedPhases) {
      if (hpPercent <= phase.hpPercent) {
        activePhase = phase;
        // Don't break - continue to find even lower thresholds that still apply
      }
    }
    
    return activePhase ?? sortedPhases[0];
  }
  
  /**
   * Update current phase based on HP
   * Returns true if phase changed
   */
  private updatePhase(hpPercent: number): boolean {
    const newPhase = this.getCurrentPhase(hpPercent);
    
    // Compare by hpPercent threshold, not object reference
    const currentPhasePct = this.currentPhase?.hpPercent ?? -1;
    const newPhasePct = newPhase?.hpPercent ?? -1;
    
    if (newPhasePct !== currentPhasePct) {
      console.log(`[AI Phase] ${this.profile.name}: Phase change! HP ${hpPercent.toFixed(0)}% → Phase ${newPhasePct}%`);
      if (newPhase) {
        console.log(`[AI Phase] New modifiers:`, {
          speed: newPhase.speed,
          aggression: newPhase.aggression,
          attackWeights: newPhase.attackWeights,
          reactionDelay: newPhase.reactionDelay,
          telegraphOverrides: newPhase.telegraphOverrides,
        });
        
        // Store pending phase change for event emission
        this.pendingPhaseChange = {
          phaseName: newPhase.name ?? `Phase ${newPhasePct}%`,
          hpPercent: newPhasePct,
        };
      }
      
      this.currentPhase = newPhase;
      this.lastPhaseHpPercent = hpPercent;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get effective aggression (base + phase modifier)
   */
  private getEffectiveAggression(): number {
    return this.currentPhase?.aggression ?? this.profile.behavior.aggression;
  }
  
  /**
   * Get effective reaction delay (base + phase modifier)
   */
  private getEffectiveReactionDelay(): number {
    return this.currentPhase?.reactionDelay ?? this.profile.behavior.reactionDelay;
  }
  
  /**
   * Get effective preferred distance (base + phase modifier)
   */
  private getEffectivePreferredDistance(loadout: Loadout): number {
    if (this.currentPhase?.preferredDistance !== undefined) {
      return this.currentPhase.preferredDistance;
    }
    return this.getPreferredDistance(loadout);
  }
  
  /**
   * Get effective attack weights (base + phase modifier)
   */
  private getEffectiveAttackWeights(): readonly AttackWeight[] {
    if (!this.currentPhase?.attackWeights) {
      return this.profile.attackPolicy.attacks;
    }
    
    // Merge phase weights with base weights
    const phaseWeights = this.currentPhase.attackWeights;
    return this.profile.attackPolicy.attacks.map(attack => ({
      ...attack,
      weight: phaseWeights[attack.command] ?? attack.weight,
    }));
  }
  
  /**
   * Get current speed multiplier (for phase system)
   * Used by game-loop to apply speed modifier to fighter
   */
  getSpeedMultiplier(): number {
    return this.currentPhase?.speed ?? 1.0;
  }
  
  /**
   * Check if super armor is active (for phase system)
   * Used by game-loop to apply super armor to fighter
   */
  hasSuperArmor(): boolean {
    return this.currentPhase?.superArmor ?? false;
  }
  
  /**
   * Get telegraph duration overrides (for phase system)
   * Used by game-loop to apply to fighter.telegraphOverrides
   */
  getTelegraphOverrides(): Record<string, number> | undefined {
    return this.currentPhase?.telegraphOverrides;
  }
  
  /**
   * Get rage burst configuration (for phase system)
   * Used by game-loop to check proximity-based rage burst
   */
  getRageBurstConfig(): { proximityThreshold?: number; durationTicks?: number; cooldownTicks?: number; knockbackStrength?: number } | undefined {
    return this.currentPhase?.rageBurst;
  }
  
  /**
   * Consume pending phase change event
   * Returns event data once, then null until next phase change
   */
  consumePhaseChange(): { phaseName: string; hpPercent: number } | null {
    const pending = this.pendingPhaseChange;
    this.pendingPhaseChange = null;
    return pending;
  }
  
  /**
   * Get loadout override (for phase system)
   * Used by game-loop to apply phase-specific loadout to fighter
   */
  getLoadoutOverride(): 'bare' | 'sword' | undefined {
    return this.currentPhase?.loadout;
  }

  // ============================================================================
  // MAIN DECISION LOOP
  // ============================================================================

  decide(obs: Observation, tick: number): Intent {
    const { self, opponent, distance } = obs;

    // Update phase based on current HP percentage
    const hpPercent = (self.health / self.maxHealth) * 100;
    this.updatePhase(hpPercent);

    // Default intent
    const intent: Intent = {
      move: 'none',
      attack: null,
      block: null,
      jump: false,
      run: false,
    };

    // Can't act - return empty intent
    if (!self.canAct) {
      return intent;
    }

    // === DEFENSE: Block/Parry ===
    if (this.shouldBlock(opponent, distance)) {
      intent.block = this.getBlockZone(opponent);
      return intent; // Blocking takes priority
    }

    // === OFFENSE: Attack or Approach ===
    const { rangePolicy } = this.profile;
    const engageRange = this.getEngageRange(self.loadout);
    const engageOut = engageRange + rangePolicy.engageHysteresis;

    // Engage range hysteresis to prevent attack/chase flicker
    if (this.inEngageRange) {
      // Currently in engage - only exit if clearly outside
      if (distance <= engageOut || tick < this.engageLockUntil) {
        // Stay in engage mode - try to attack
        const attack = this.chooseAttack(obs, tick);
        if (attack) {
          intent.attack = attack;
          // Don't move while attacking
        } else {
          // No attack available - handle movement (might approach closer or retreat)
          this.handleMovement(obs, tick, intent);
        }
      } else {
        // Exit engage mode
        this.inEngageRange = false;
        this.engageLockUntil = tick + rangePolicy.chaseLockTicks;
        // Chase
        this.handleMovement(obs, tick, intent);
      }
    } else {
      // Not in engage - only enter if clearly inside
      if (distance <= engageRange && tick >= this.engageLockUntil) {
        // Enter engage mode
        this.inEngageRange = true;
        intent.attack = this.chooseAttack(obs, tick);
        // If no attack, still handle movement
        if (!intent.attack) {
          this.handleMovement(obs, tick, intent);
        }
      } else {
        // Movement mode (chase, retreat, or maintain distance)
        this.handleMovement(obs, tick, intent);
      }
    }

    return intent;
  }

  // ============================================================================
  // RANGE CALCULATIONS (computed from attack-data per loadout)
  // ============================================================================

  /**
   * Get engage range for a loadout
   * Uses profile override if set, otherwise computes max from attack-data
   */
  private getEngageRange(loadout: Loadout): number {
    // Profile override takes precedence
    if (this.profile.rangePolicy.engageRange !== undefined) {
      return this.profile.rangePolicy.engageRange;
    }
    
    // Check cache
    if (this.engageRangeCache.has(loadout)) {
      return this.engageRangeCache.get(loadout)!;
    }
    
    // Compute from attack-data
    const attacks = getAttacksForLoadout(this.characterId, loadout);
    const maxRange = attacks.reduce((max, attack) => {
      const range = attack.engageRange ?? attack.range ?? 100;
      return Math.max(max, range);
    }, 100); // Default fallback
    
    this.engageRangeCache.set(loadout, maxRange);
    return maxRange;
  }

  /**
   * Get preferred fighting distance for a loadout
   * Uses profile override if set, otherwise auto-computes as 70% of engageRange
   * 
   * This means:
   * - Bare (engageRange ~150) → preferredDistance ~105
   * - Sword (engageRange ~220) → preferredDistance ~154
   */
  private getPreferredDistance(loadout: Loadout): number {
    // Profile override takes precedence
    if (this.profile.rangePolicy.preferredDistance !== undefined) {
      return this.profile.rangePolicy.preferredDistance;
    }
    
    // Auto-compute: 70% of engage range (not too close, not too far)
    const engageRange = this.getEngageRange(loadout);
    return Math.round(engageRange * 0.7);
  }

  /**
   * Get retreat distance for a loadout
   * Uses profile override if set, otherwise auto-computes as 50% of preferredDistance
   * 
   * This means:
   * - Bare → retreatDistance ~52 
   * - Sword → retreatDistance ~77
   */
  private getRetreatDistance(loadout: Loadout): number {
    // Profile override takes precedence
    if (this.profile.rangePolicy.retreatDistance !== undefined) {
      return this.profile.rangePolicy.retreatDistance;
    }
    
    // Auto-compute: 50% of preferred distance
    const preferred = this.getPreferredDistance(loadout);
    return Math.round(preferred * 0.5);
  }

  /**
   * Get attacks available at current distance for loadout
   */
  private getAvailableAttacks(loadout: Loadout, distance: number): any[] {
    const attacks = getAttacksForLoadout(this.characterId, loadout);
    return attacks.filter(attack => {
      const range = attack.engageRange ?? attack.range ?? 100;
      return range >= distance;
    });
  }

  // ============================================================================
  // DEFENSE LOGIC
  // ============================================================================

  private shouldBlock(opponent: Observation['opponent'], distance: number): boolean {
    const { defensePolicy } = this.profile;

    // Check if opponent is in an attacking state
    if (!defensePolicy.attackingStates.includes(opponent.state)) {
      return false;
    }

    // Need active attack to determine range
    if (!opponent.activeAttack) {
      return false;
    }

    // Get attack data from opponent's character
    const attackConfig = getCharacterAttackData(opponent.characterId, opponent.activeAttack);
    if (!attackConfig) {
      return false;
    }

    // Block if within hit range (with buffer)
    return distance <= attackConfig.range + defensePolicy.blockRangeBuffer;
  }

  private getBlockZone(opponent: Observation['opponent']): HitZone {
    const { defensePolicy } = this.profile;

    if (!opponent.activeAttack) {
      return defensePolicy.blockMapping.defaultZone;
    }

    // Get attack zone from opponent's character data
    const attackConfig = getCharacterAttackData(opponent.characterId, opponent.activeAttack);
    const attackZone = attackConfig?.zone as HitZone | undefined;

    if (attackZone && attackZone in defensePolicy.blockMapping.zoneMap) {
      return defensePolicy.blockMapping.zoneMap[attackZone];
    }

    return defensePolicy.blockMapping.defaultZone;
  }

  // ============================================================================
  // ATTACK SELECTION
  // ============================================================================

  private chooseAttack(obs: Observation, tick: number): AttackCommand | null {
    const { attackPolicy } = this.profile;
    const { opponent, distance } = obs;

    // Check aggression roll (use phase-modified aggression)
    const effectiveAggression = this.getEffectiveAggression();
    if (!this.rng.chance(effectiveAggression)) {
      return null;
    }

    // Select attack pool based on opponent state (use phase-modified weights)
    let attackPool = this.getEffectiveAttackWeights();
    
    // Use telegraph attacks if opponent is telegraphing
    if (attackPolicy.telegraphAttacks && opponent.state === 'telegraph') {
      attackPool = attackPolicy.telegraphAttacks;
    }

    // Filter valid attacks based on conditions
    const validAttacks = this.filterValidAttacks(attackPool, obs, tick);

    if (validAttacks.length === 0) {
      // Fallback to any attack that's off cooldown
      const effectiveAttacks = this.getEffectiveAttackWeights();
      const fallback = effectiveAttacks.filter(a => this.isOffCooldown(a.command, tick));
      if (fallback.length === 0) return null;
      return this.weightedSelect(fallback, tick);
    }

    return this.weightedSelect(validAttacks, tick);
  }

  private filterValidAttacks(
    attacks: readonly AttackWeight[],
    obs: Observation,
    tick: number
  ): AttackWeight[] {
    const { distance, opponent, self } = obs;
    
    // Get attacks available at this distance (from attack-data)
    const availableAttacks = this.getAvailableAttacks(self.loadout, distance);
    const availableCommands = new Set(availableAttacks.map(a => a.command));

    return attacks.filter(attack => {
      // Check cooldown
      if (!this.isOffCooldown(attack.command, tick)) {
        return false;
      }

      // Check if attack is available at this distance (from attack-data)
      if (!availableCommands.has(attack.command)) {
        return false;
      }

      // Check opponent state constraints
      if (attack.opponentStates && !attack.opponentStates.includes(opponent.state)) {
        return false;
      }

      return true;
    });
  }

  private isOffCooldown(command: AttackCommand, tick: number): boolean {
    const cooldownUntil = this.attackCooldowns.get(command) ?? 0;
    return tick >= cooldownUntil;
  }

  private weightedSelect(attacks: readonly AttackWeight[], tick: number): AttackCommand {
    const totalWeight = attacks.reduce((sum, a) => sum + a.weight, 0);
    let roll = this.rng.next() * totalWeight;

    for (const attack of attacks) {
      roll -= attack.weight;
      if (roll <= 0) {
        // Apply cooldown if specified
        if (attack.cooldownTicks) {
          this.attackCooldowns.set(attack.command, tick + attack.cooldownTicks);
        }
        return attack.command;
      }
    }

    // Fallback (should never reach)
    return attacks[0].command;
  }

  // ============================================================================
  // MOVEMENT LOGIC (Chase, Retreat, Spacing)
  // ============================================================================

  /**
   * Handle all movement decisions
   * Priority: Retreat > Maintain Distance > Chase
   */
  private handleMovement(obs: Observation, tick: number, intent: Intent): void {
    const { self, opponent, distance } = obs;
    const { rangePolicy } = this.profile;
    const dx = opponent.x - self.x;

    // Don't move if opponent is airborne and close (prevents flicker during cross-up)
    if (opponent.state === 'jump' && Math.abs(dx) < rangePolicy.airborneStopRange) {
      intent.move = 'none';
      return;
    }

    // === RETREAT CHECK (loadout-aware) ===
    if (this.shouldRetreat(self.loadout, distance, tick)) {
      this.handleRetreat(obs, tick, intent);
      return;
    }

    // === MAINTAIN DISTANCE CHECK (loadout-aware, phase-aware) ===
    if (rangePolicy.maintainDistance) {
      const preferredDist = this.getEffectivePreferredDistance(self.loadout);
      const deadzone = rangePolicy.chaseDeadzone;
      
      // Too close - back off toward preferred distance
      if (distance < preferredDist - deadzone) {
        this.handleRetreat(obs, tick, intent);
        return;
      }
      
      // At preferred distance - stop
      if (distance >= preferredDist - deadzone && distance <= preferredDist + deadzone) {
        intent.move = 'none';
        return;
      }
    }

    // === CHASE (default) ===
    this.handleChase(obs, tick, intent);
  }

  /**
   * Check if AI should retreat (too close to opponent)
   * Uses loadout-specific retreat distance
   */
  private shouldRetreat(loadout: Loadout, distance: number, tick: number): boolean {
    const { rangePolicy } = this.profile;
    
    // Get loadout-specific retreat distance
    const retreatDist = this.getRetreatDistance(loadout);
    
    // No retreat (distance is 0)
    if (retreatDist <= 0) {
      return false;
    }
    
    // Not close enough to retreat
    if (distance > retreatDist) {
      return false;
    }
    
    // Already locked into retreat
    if (tick < this.retreatDirLockUntil) {
      return true;
    }
    
    // Roll for retreat probability
    const retreatProb = rangePolicy.retreatProbability ?? 0.5;
    return this.rng.chance(retreatProb);
  }

  /**
   * Handle retreat movement (move away from opponent)
   */
  private handleRetreat(obs: Observation, tick: number, intent: Intent): void {
    const { self, opponent } = obs;
    const { rangePolicy } = this.profile;
    const dx = opponent.x - self.x;
    const retreatLockTicks = rangePolicy.retreatLockTicks ?? rangePolicy.chaseLockTicks;

    // Direction lock to prevent flicker
    if (tick < this.retreatDirLockUntil && this.lastRetreatDir) {
      intent.move = this.lastRetreatDir;
      return;
    }

    // Move away from opponent
    const retreatDir = dx > 0 ? 'left' : 'right';
    intent.move = retreatDir;
    this.lastRetreatDir = retreatDir;
    this.retreatDirLockUntil = tick + retreatLockTicks;
  }

  /**
   * Handle chase movement (approach opponent)
   */
  private handleChase(obs: Observation, tick: number, intent: Intent): void {
    const { self, opponent } = obs;
    const { rangePolicy } = this.profile;
    const dx = opponent.x - self.x;

    // Direction lock to prevent flicker
    if (tick < this.chaseDirLockUntil && this.lastChaseDir) {
      intent.move = this.lastChaseDir;
      return;
    }

    // Outside deadzone - choose new direction
    if (Math.abs(dx) > rangePolicy.chaseDeadzone) {
      const newDir = dx > 0 ? 'right' : 'left';
      intent.move = newDir;
      this.lastChaseDir = newDir;
      this.chaseDirLockUntil = tick + rangePolicy.chaseLockTicks;
    } else {
      // Inside deadzone - keep last direction or stop
      intent.move = this.lastChaseDir || 'none';
    }
  }

  // ============================================================================
  // STATE RESET
  // ============================================================================

  /**
   * Reset internal state (call between rounds)
   */
  reset(): void {
    this.lastChaseDir = null;
    this.chaseDirLockUntil = -1;
    this.lastRetreatDir = null;
    this.retreatDirLockUntil = -1;
    this.inEngageRange = false;
    this.engageLockUntil = -1;
    this.attackCooldowns.clear();
    this.engageRangeCache.clear();
    this.rng.reset();
  }
}
