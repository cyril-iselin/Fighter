// ============================================
// Fighter AI - Computer-controlled opponent
// ============================================

import { FighterController } from './fighter-controller';
import { MoveDirection, HitZone, FighterState } from './types';
import { getAttackConfig, AttackId } from './attack-data';
import { TimerBag, TIMER, TIMER_PREFIX } from './timer-bag';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

interface AIConfig {
  difficulty: AIDifficulty;
  fighter: FighterController;
  getPlayerFighter: () => FighterController | null;
  getPlayerPosition: () => number;
  getAIPosition: () => number;
}

interface AIBehavior {
  reactionTime: number;      // ms before AI reacts
  aggressiveness: number;    // 0-1, how often AI attacks vs defends
  blockChance: number;       // 0-1, chance to block incoming attack
  moveSpeed: number;         // How often AI adjusts position
  attackRange: number;       // Preferred distance to attack
  retreatChance: number;     // 0-1, chance to back off after being hit
  telegraphTime: number;     // ms of "windup" before attack (gives player time to react)
  heavyAttackChance: number; // 0-1, chance to use heavy attack instead of light
}

const DIFFICULTY_SETTINGS: Record<AIDifficulty, AIBehavior> = {
  easy: {
    reactionTime: 400,
    aggressiveness: 0.4,
    blockChance: 0.3,
    moveSpeed: 0.5,
    attackRange: 280,
    retreatChance: 0.2,
    telegraphTime: 350,
    heavyAttackChance: 0.3
  },
  medium: {
    reactionTime: 300,
    aggressiveness: 0.5,
    blockChance: 0.4,
    moveSpeed: 0.6,
    attackRange: 280,
    retreatChance: 0.4,
    telegraphTime: 300,    // Medium windup
    heavyAttackChance: 0.4 // 40% heavy attacks
  },
  hard: {
    reactionTime: 200,
    aggressiveness: 0.7,
    blockChance: 0.7,
    moveSpeed: 0.8,
    attackRange: 280,
    retreatChance: 0.6,
    telegraphTime: 200,    // Short windup - harder to block
    heavyAttackChance: 0.7 // 70% heavy attacks (more super armor!)
  }
};

export class FighterAI {
  private fighter: FighterController;
  private getPlayerFighter: () => FighterController | null;
  private getPlayerPosition: () => number;
  private getAIPosition: () => number;
  
  private behavior: AIBehavior;
  private difficulty: AIDifficulty;
  
  // Timing
  private lastDecisionTime = 0;
  private decisionInterval = 200; // ms between decisions
  private lastAttackTime = 0;
  private attackCooldown = 300;
  
  // Attack-Urge System - akkumuliert über Zeit statt reinem Random
  private attackUrge = 0;
  private readonly URGE_PER_TICK = 0.15;      // Pro Decision-Tick akkumulieren
  private readonly URGE_THRESHOLD = 1.0;       // Bei 1.0 wird definitiv angegriffen
  private readonly URGE_ATTACK_RESET = -0.3;   // Nach Attack: teilweiser Reset (bleibt aggressiv)
  
  // Einheitlicher Range-Buffer (keine Dead Zone!)
  private readonly ENGAGE_BUFFER = 75;
  
  // State
  private isActive = false;
  private currentAction: 'idle' | 'approaching' | 'attacking' | 'blocking' | 'retreating' | 'telegraphing' = 'idle';
  private pendingAction: (() => void) | null = null;
  private pendingActionTime = 0;
  private pendingActionPriority = 0;
  
  // Action sequence ID - prevents stale callbacks from firing
  private actionSequenceId = 0;
  
  // Named timer management (verhindert Leaks, erlaubt gezieltes Clearing)
  private timers = new TimerBag();
  
  // Movement idempotency - prevents redundant move commands that thrash animations
  private lastMoveDir: MoveDirection = 'none';
  private lastMoveRun = false;
  
  // Anti-Stunlock: Track consecutive hits and force defensive behavior
  private consecutiveHits = 0;
  private lastHitTime = 0;
  private readonly COMBO_WINDOW = 1000; // Hits within 1s count as combo
  private readonly FORCE_BLOCK_THRESHOLD = 2; // Force block after 2 consecutive hits
  
  // Action priorities (higher = more important, won't be overwritten by lower)
  // BLOCK hat höchste Prio bei echter Gefahr, sonst ATTACK
  private static readonly PRIORITY_MOVEMENT = 0;
  private static readonly PRIORITY_ATTACK = 1;
  private static readonly PRIORITY_BLOCK = 2;    // Block bei Gefahr = höchste Prio
  
  // Telegraph callback - called when AI is about to attack (for UI indicator)
  // totalTimeMs = total time from now until attack hits (windupTime + telegraphTime + chargeUpMs)
  public onTelegraph?: (attackType: 'light' | 'heavy' | 'special', totalTimeMs: number) => void;
  
  constructor(config: AIConfig) {
    this.fighter = config.fighter;
    this.getPlayerFighter = config.getPlayerFighter;
    this.getPlayerPosition = config.getPlayerPosition;
    this.getAIPosition = config.getAIPosition;
    this.difficulty = config.difficulty;
    this.behavior = DIFFICULTY_SETTINGS[config.difficulty];
  }
  
  // ============================================
  // Public API
  // ============================================
  
  start(): void {
    this.isActive = true;
  }
  
  stop(): void {
    this.isActive = false;
    this.fighter.stopMove();
    this.currentAction = 'idle';
    this.pendingAction = null;
    this.pendingActionPriority = 0;
    this.actionSequenceId++; // Invalidate any pending timeouts
    this.attackUrge = 0; // Reset urge
    this.lastMoveDir = 'none'; // Reset movement tracking
    this.lastMoveRun = false;
    this.consecutiveHits = 0; // Reset combo counter
    this.timers.clearByPrefix(TIMER_PREFIX.AI); // Clear only AI timers
  }
  
  getActive(): boolean {
    return this.isActive;
  }
  
  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    this.behavior = DIFFICULTY_SETTINGS[difficulty];
  }
  
  getDifficulty(): AIDifficulty {
    return this.difficulty;
  }
  
  // Called every frame
  update(deltaTime: number, currentTime: number): void {
    if (!this.isActive) return;
    
    // Don't do anything while stunned!
    if (this.fighter.isStunned()) {
      this.clearPendingAction();
      this.currentAction = 'idle';
      return;
    }
    
    // Process pending action (reaction time delay)
    if (this.pendingAction && currentTime >= this.pendingActionTime) {
      this.pendingAction();
      this.clearPendingAction();
    }
    
    // Make decisions at intervals
    if (currentTime - this.lastDecisionTime < this.decisionInterval) return;
    this.lastDecisionTime = currentTime;
    
    this.makeDecision(currentTime);
  }
  
  // ============================================
  // Decision Making
  // ============================================
  
  /**
   * Get the effective attack range based on loadout
   * Sword has longer reach than bare hands
   * Bare hands need to get much closer to hit
   */
  private getEffectiveAttackRange(): number {
    const baseRange = this.behavior.attackRange;
    const loadout = this.fighter.getLoadout();
    
    if (loadout === 'sword') {
      return baseRange + 120; // Sword has longer reach (~400)
    }
    // Bare hands: Player can hit from ~350px with kick_straight
    // AI needs similar range to be competitive
    return baseRange + 50; // ~310-330 for bare hands
  }
  
  /**
   * Get telegraph time based on loadout
   * Bare hands attacks are faster (shorter telegraph)
   * Sword attacks are slower (longer telegraph due to heavier weapon)
   */
  private getEffectiveTelegraphTime(): number {
    const baseTelegraph = this.behavior.telegraphTime;
    const loadout = this.fighter.getLoadout();
    
    if (loadout === 'bare') {
      // Bare hands: 10% of base telegraph time (faster attacks)
      return Math.round(baseTelegraph * 0.8);
    }
    // Sword keeps full telegraph time
    return baseTelegraph;
  }
  
  private makeDecision(currentTime: number): void {
    const player = this.getPlayerFighter();
    if (!player) return;
    
    const playerPos = this.getPlayerPosition();
    const aiPos = this.getAIPosition();
    const distance = Math.abs(playerPos - aiPos);
    const playerState = player.getState();
    
    // Reset stale action states - if fighter is idle but currentAction is stuck
    const fighterState = this.fighter.getState();
    if (fighterState === FighterState.Idle && 
        (this.currentAction === 'retreating' || this.currentAction === 'approaching' || this.currentAction === 'blocking')) {
      this.currentAction = 'idle';
    }
    // Also reset if fighter is hurt - action was interrupted
    if (fighterState === FighterState.Hurt) {
      this.currentAction = 'idle';
    }
    
    // Zentralisierte Range-Policy - KEINE Dead Zone!
    const preferredRange = this.getEffectiveAttackRange();
    const inAttackRange = distance <= preferredRange + this.ENGAGE_BUFFER;
    const tooFar = distance > preferredRange + this.ENGAGE_BUFFER;
    const tooClose = distance < preferredRange - 50;
    
    // DEBUG: Log AI state every decision
    const loadout = this.fighter.getLoadout();
    console.log(`[AI-${loadout}] dist=${distance.toFixed(0)}, range=${preferredRange}, inRange=${inAttackRange}, urge=${this.attackUrge.toFixed(2)}, action=${this.currentAction}, state=${this.fighter.getState()}`);
    
    // Attack-Urge akkumulieren wenn in Range
    if (inAttackRange) {
      this.attackUrge += this.URGE_PER_TICK * this.behavior.aggressiveness;
    } else {
      // Langsamer Abbau wenn außer Range
      this.attackUrge = Math.max(0, this.attackUrge - 0.05);
    }
    
    // Priority 1 (HÖCHSTE): Block wenn Player AKTIV angreift und in Gefahr
    // Dies unterbricht auch Attack-Vorbereitung wenn nötig!
    const playerIsAttacking = playerState === FighterState.Attack;
    // Player's actual attack range is ~350-400px (kick_straight etc)
    // AI must recognize danger even when outside its own attack range!
    const inDangerZone = distance < 400;
    
    if (playerIsAttacking && inDangerZone && this.shouldBlock(distance)) {
      this.scheduleAction(() => this.doBlock(), this.behavior.reactionTime * 0.3, currentTime, FighterAI.PRIORITY_BLOCK);
      return;
    }
    
    // Priority 2: Attack wenn Urge hoch genug (und kein Player-Angriff droht)
    if (this.shouldAttack(distance, currentTime, inAttackRange)) {
      this.scheduleAction(() => this.doAttack(currentTime), this.behavior.reactionTime * 0.5, currentTime, FighterAI.PRIORITY_ATTACK);
      return;
    }
    
    // Priority 3: Position management
    this.managePosition(distance, playerPos, aiPos, tooFar, tooClose);
  }
  
  private shouldBlock(distance: number): boolean {
    // Bare hands AI doesn't block - pure offense!
    if (this.fighter.getLoadout() === 'bare') return false;
    
    // Player can hit from ~400px - AI must be willing to block at that range!
    if (distance > 420) return false; // Only truly safe if very far
    if (this.fighter.getState() === FighterState.Attack) return false; // Already attacking
    // NICHT blocken während Telegraph - AI hat sich zum Angriff committed!
    if (this.currentAction === 'telegraphing') return false;
    
    return Math.random() < this.behavior.blockChance;
  }

  private shouldAttack(distance: number, currentTime: number, inAttackRange: boolean): boolean {
    if (!inAttackRange) {
      return false;
    }
    if (currentTime - this.lastAttackTime < this.attackCooldown) {
      return false;
    }
    if (this.fighter.getState() === FighterState.Attack) {
      return false;
    }
    if (this.fighter.getState() === FighterState.Block) {
      return false;
    }
    if (this.currentAction === 'telegraphing') {
      return false;
    }
    
    // Attack-Urge System: Greife an wenn Urge >= Threshold ODER zufällig basierend auf Urge
    // Dies verhindert "tote Phasen" - je länger in Range, desto wahrscheinlicher Attack
    if (this.attackUrge >= this.URGE_THRESHOLD) {
      return true;
    }
    
    // Zusätzliche Chance basierend auf aktuellem Urge (0-1 mapped auf 0-aggressiveness)
    const randomChance = this.attackUrge * this.behavior.aggressiveness;
    return Math.random() < randomChance;
  }

  /**
   * Idempotent movement setter - prevents redundant commands that thrash animations
   * BUT: If fighter is not actually moving, force the move command
   */
  private setMove(dir: MoveDirection, run: boolean): void {
    // Check if fighter is actually moving - if not, we need to send the command again
    const fighterState = this.fighter.getState();
    const isActuallyMoving = fighterState === FighterState.Move;
    
    // Skip if same command AND fighter is actually moving
    if (dir === this.lastMoveDir && run === this.lastMoveRun && isActuallyMoving) {
      return;
    }
    
    // Handle run state transitions
    if (run && !this.lastMoveRun) {
      this.fighter.run();
    } else if (!run && this.lastMoveRun) {
      // Stop running if we were running before
      this.fighter.runStop();
    }
    
    this.lastMoveDir = dir;
    this.lastMoveRun = run;
    
    if (dir === 'none') {
      this.fighter.stopMove();
    } else {
      this.fighter.move(dir);
    }
  }

  private managePosition(distance: number, playerPos: number, aiPos: number, tooFar: boolean, tooClose: boolean): void {
    // Don't move if we're attacking, blocking, or telegraphing - let the animation finish!
    if (this.fighter.getState() === FighterState.Attack || 
        this.fighter.getState() === FighterState.Block ||
        this.currentAction === 'attacking' || 
        this.currentAction === 'blocking' ||
        this.currentAction === 'telegraphing') {
      return;
    }
    
    const direction: MoveDirection = playerPos > aiPos ? 'right' : 'left';
    
    // Immer bewegen wenn tooFar - keine Random-Chance die Bewegung verhindert!
    if (tooFar) {
      // Too far - IMMER approach (keine moveSpeed chance hier)
      this.currentAction = 'approaching';
      // Run wenn sehr weit weg
      const shouldRun = distance > this.getEffectiveAttackRange() + 200;
      this.setMove(direction, shouldRun);
    } else if (tooClose) {
      // Too close - maybe retreat (hier ist Random OK)
      if (Math.random() < this.behavior.retreatChance) {
        this.currentAction = 'retreating';
        const retreatDir: MoveDirection = direction === 'right' ? 'left' : 'right';
        this.setMove(retreatDir, false);
      } else {
        this.setMove('none', false);
      }
    } else {
      // In perfect range - beweglicher bleiben statt zu passiv!
      // Erhöht von 0.5 auf 0.8 für aktivere Positionierung
      if (Math.random() < this.behavior.moveSpeed * 0.8) {
        // Leichte Bewegung Richtung Gegner um Druck aufzubauen
        this.currentAction = 'approaching';
        this.setMove(direction, false);
      } else {
        this.currentAction = 'idle'; // Reset action when stopping
        this.setMove('none', false);
      }
    }
  }
  
  // ============================================
  // Actions
  // ============================================
  
  private scheduleAction(action: () => void, delay: number, currentTime: number, priority: number): void {
    // Only overwrite pending action if new action has higher or equal priority
    if (this.pendingAction && priority < this.pendingActionPriority) {
      // Current pending action has higher priority - don't overwrite
      return;
    }
    
    // Capture sequence ID at schedule time - prevents stale actions from firing
    const seq = this.actionSequenceId;
    this.pendingAction = () => {
      if (seq !== this.actionSequenceId) return; // Action was invalidated
      action();
    };
    this.pendingActionTime = currentTime + delay;
    this.pendingActionPriority = priority;
  }
  
  private clearPendingAction(): void {
    this.pendingAction = null;
    this.pendingActionPriority = 0;
  }
  
  private doBlock(): void {
    // Clear any pending actions when starting a new action
    this.clearPendingAction();
    
    // Always block center zone - most attacks target body
    const zone: HitZone = 'center';
    
    this.currentAction = 'blocking';
    this.actionSequenceId++;
    const seq = this.actionSequenceId;
    
    console.log(`[AI] doBlock: zone=${zone}, state=${this.fighter.getState()}, canBlock=${this.fighter.canBlock()}`);
    this.fighter.block(zone);
    
    // Release block after a short time - named timer for clean cancellation
    this.timers.set(TIMER.AI_BLOCK_RELEASE, () => {
      // Guard: check if this action is still valid
      if (seq !== this.actionSequenceId) return;
      if (!this.isActive) return;
      
      if (this.fighter.isCurrentlyBlocking()) {
        this.fighter.unblock();
        this.currentAction = 'idle';
      }
    }, 300 + Math.random() * 200);
  }
  
  private doAttack(currentTime: number): void {
    // Clear any pending actions when starting a new action
    this.clearPendingAction();
    
    // Double-check range - player might have moved since shouldAttack()
    const distance = Math.abs(this.getPlayerPosition() - this.getAIPosition());
    const effectiveRange = this.getEffectiveAttackRange();
    
    if (distance > effectiveRange + this.ENGAGE_BUFFER + 25) {
      // Attack aborted - reset urge completely to prevent instant re-attack
      this.attackUrge = 0;
      // Start approaching (don't just set state without action)
      this.currentAction = 'approaching';
      const dir: MoveDirection = this.getPlayerPosition() > this.getAIPosition() ? 'right' : 'left';
      this.setMove(dir, false);
      return;
    }
    
    // Attack wird ausgeführt - Reset Attack-Urge (teilweise - bleibt leicht aggressiv)
    this.attackUrge = Math.max(0, this.attackUrge + this.URGE_ATTACK_RESET);
    
    // First, enter telegraph state (windup)
    this.currentAction = 'telegraphing';
    this.lastAttackTime = currentTime;
    this.actionSequenceId++;
    const seq = this.actionSequenceId;
    
    // Stop moving to telegraph the attack
    this.fighter.stopMove();
    
    // Get loadout to determine available attacks
    const loadout = this.fighter.getLoadout();
    
    // Determine attack type based on difficulty
    // Easy: mostly light, Hard: mostly heavy (with super armor)
    const attackRoll = Math.random();
    let attackType: 'light' | 'heavy' = attackRoll < this.behavior.heavyAttackChance ? 'heavy' : 'light';

    // Enable super armor only for heavy and special attacks
    // Light attacks can be interrupted - encourages player to trade hits
    const useSuperArmor = attackType === 'heavy';
    console.log(`[AI] doAttack: type=${attackType}, superArmor=${useSuperArmor}`);
    if (useSuperArmor) {
      this.fighter.setSuperArmor(true);
      // @ts-ignore - debug only
      const fighterId = (this.fighter as any)._debugId || ((this.fighter as any)._debugId = Math.random().toString(36).substr(2,4));
      console.log(`[AI] Super Armor SET on fighter ${fighterId}, hasSuperArmor=${this.fighter.hasSuperArmor()}`);
    }
    
    // Determine which attack ID this maps to (for chargeUpMs lookup)
    // Must match player mapping in fighter-combat.ts!
    let attackId: AttackId;
    if (loadout === 'sword') {
      attackId = attackType === 'heavy' ? 'slash_heavy' : 'slash_light';
    } else {
      // Bare: light = kick_straight, heavy = uppercut (same as player)
      attackId = attackType === 'heavy' ? 'uppercut' : 'kick_straight';
    }
    
    // Get chargeUpMs and attackDurationMs from attack config
    const attackConfig = getAttackConfig(attackId);
    const chargeUpMs = attackConfig?.chargeUpMs ?? 0;
    const attackDurationMs = attackConfig?.attackDurationMs ?? 250; // Default 250ms if not specified
    
    // Start the attack animation and pause at wind-up position
    // windupTime = time to let animation play before freezing (shows the wind-up pose)
    const windupTime = 150; // ms to show initial wind-up motion
    
    // Total telegraph = loadout-adjusted telegraph + attack's chargeUp (AI takes longer than player)
    // Bare hands: shorter telegraph (faster attacks)
    // Sword: full telegraph (heavier weapon)
    const totalTelegraphTime = this.getEffectiveTelegraphTime() + chargeUpMs;
    
    // Total time from telegraph start until attack hits
    const totalTimeUntilHit = windupTime + totalTelegraphTime;
   
    // Fire telegraph callback with total time (for UI indicator)
    this.onTelegraph?.(attackType, totalTimeUntilHit);
    
    this.fighter.startAttackTelegraph(attackType, windupTime)
      .then(() => {
        // Animation is now paused at wind-up position
        // Wait for telegraph time, then execute - named timer!
        this.timers.set(TIMER.AI_TELEGRAPH_EXECUTE, () => {
          // Guard: check if this action is still valid
          if (seq !== this.actionSequenceId) {
            console.log('[AI] ❌ Telegraph cancelled (sequence mismatch)');
            if (useSuperArmor) this.fighter.setSuperArmor(false);
            this.timers.clear(TIMER.AI_TELEGRAPH_EXECUTE);
            this.timers.clear(TIMER.AI_ATTACK_RECOVERY);
            this.fighter.cancelTelegraph();
            return;
          }
          if (!this.isActive) {
            if (useSuperArmor) this.fighter.setSuperArmor(false);
            this.timers.clear(TIMER.AI_TELEGRAPH_EXECUTE);
            this.timers.clear(TIMER.AI_ATTACK_RECOVERY);
            this.fighter.cancelTelegraph();
            return;
          }
          
          // Check if we're still in telegraphing state (player might have hit us)
          // With super armor, we should NOT be interrupted, but check anyway
          if (this.currentAction !== 'telegraphing') {
            console.log('[AI] ❌ Telegraph cancelled (got hit)');
            if (useSuperArmor) this.fighter.setSuperArmor(false);
            this.timers.clear(TIMER.AI_TELEGRAPH_EXECUTE);
            this.timers.clear(TIMER.AI_ATTACK_RECOVERY);
            this.fighter.cancelTelegraph();
            return;
          }
          
          // KEEP super armor active during attack execution!
          // Heavy attacks should not be interrupted even during the swing
          // Super armor will be disabled after the attack completes
          
          this.currentAction = 'attacking';
          
          // Resume the attack animation
          this.fighter.executeAttackFromTelegraph();
          
          // Reset action state after attack animation completes - named timer!
          this.timers.set(TIMER.AI_ATTACK_RECOVERY, () => {
            // Guard again
            if (seq !== this.actionSequenceId) return;
            
            // NOW disable super armor - attack is fully complete
            if (useSuperArmor) {
              this.fighter.setSuperArmor(false);
              console.log('[AI] Super Armor DISABLED after attack complete');
            }
            
            if (this.currentAction === 'attacking') {
              this.currentAction = 'idle';
            }
          }, attackDurationMs + 150); // +150ms buffer for recovery animation
        }, totalTelegraphTime);
      })
      .catch((err) => {
        console.log('[AI] ❌ Telegraph failed:', err);
        if (useSuperArmor) this.fighter.setSuperArmor(false);
        // Clear timers and cancel animation
        this.timers.clear(TIMER.AI_TELEGRAPH_EXECUTE);
        this.timers.clear(TIMER.AI_ATTACK_RECOVERY);
        this.fighter.cancelTelegraph();
        this.currentAction = 'idle';
      });
  }
  
  // ============================================
  // React to Events
  // ============================================
  
  onHit(currentTime: number): void {
    // If we have super armor (heavy attack telegraph), ignore the hit completely!
    // Don't clear actions, don't increment sequence, don't track hits
    const hasSuperArmor = this.fighter.hasSuperArmor();
    console.log(`[AI] onHit CHECK: hasSuperArmor=${hasSuperArmor}, currentAction=${this.currentAction}`);
    if (hasSuperArmor) {
      console.log(`[AI] onHit: IGNORED (super armor active)`);
      return;
    }
    
    // Clear pending actions when hit - prevents stale actions
    this.clearPendingAction();
    this.actionSequenceId++;
    const seq = this.actionSequenceId; // Capture once for all uses
    
    // Track consecutive hits for anti-stunlock
    if (currentTime - this.lastHitTime < this.COMBO_WINDOW) {
      this.consecutiveHits++;
    } else {
      this.consecutiveHits = 1; // First hit of new combo
    }
    this.lastHitTime = currentTime;
    
    console.log(`[AI] onHit: consecutiveHits=${this.consecutiveHits}`);
    
    // AI telegraph got interrupted (light attack only - heavy has super armor checked above)
    if (this.currentAction === 'telegraphing') {
      // Light attack telegraph got interrupted - clear timers
      this.timers.clear(TIMER.AI_TELEGRAPH_EXECUTE);
      this.timers.clear(TIMER.AI_ATTACK_RECOVERY);
      this.fighter.cancelTelegraph();
      this.currentAction = 'idle';
      return;
    }
    
    // ANTI-STUNLOCK: Force block after consecutive hits!
    if (this.consecutiveHits >= this.FORCE_BLOCK_THRESHOLD) {
      console.log(`[AI] FORCE BLOCK after ${this.consecutiveHits} hits!`);
      // Schedule block immediately after hitstun ends (50ms delay)
      this.scheduleAction(() => {
        this.doBlock();
        this.consecutiveHits = 0; // Reset after forced block
      }, 50, currentTime, FighterAI.PRIORITY_BLOCK);
      return;
    }
    
    // Got hit - try to block next attack! (defensive recovery)
    // Higher chance to block after being hit
    if (Math.random() < this.behavior.blockChance + 0.3) {
      this.scheduleAction(() => this.doBlock(), 50, currentTime, FighterAI.PRIORITY_BLOCK);
      return;
    }
    
    // Otherwise maybe retreat
    if (Math.random() < this.behavior.retreatChance) {
      this.currentAction = 'retreating';
      const playerPos = this.getPlayerPosition();
      const aiPos = this.getAIPosition();
      const retreatDir: MoveDirection = playerPos > aiPos ? 'left' : 'right';
      
      this.scheduleAction(() => {
        if (seq !== this.actionSequenceId) return;
        this.fighter.run();
        this.fighter.move(retreatDir);
        this.timers.set(TIMER.AI_RETREAT_STOP, () => {
          if (seq !== this.actionSequenceId) return;
          this.fighter.stopMove();
        }, 300);
      }, 100, currentTime, FighterAI.PRIORITY_MOVEMENT);
    }
  }
  
  /**
   * Check if AI is currently telegraphing an attack
   * Useful for showing UI indicators to the player
   */
  isTelegraphing(): boolean {
    return this.currentAction === 'telegraphing';
  }
  
  onPlayerJump(currentTime: number): void {
    // Player jumped - good time to prepare block
    if (Math.random() < 0.5) {
      this.scheduleAction(() => this.doBlock(), this.behavior.reactionTime, currentTime, FighterAI.PRIORITY_BLOCK);
    }
  }
}
