import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, signal, computed, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameLoop } from '../../game/game-loop';
import type { MatchState, GameEvent, Loadout } from '../../core/types';
import { SpineRenderer, type SpineStatus } from '../../adapters/spine-renderer';
import { AVAILABLE_BACKGROUNDS, type BackgroundId } from '../../adapters/spine-stage';
import { PlayerHealthbarComponent } from '../../shared/components/player-healthbar/player-healthbar.component';
import { AiHealthbarComponent } from '../../shared/components/ai-healthbar/ai-healthbar.component';
import { getAudioPlayer, initializeAudio } from '../../adapters/audio';

import { LevelIntroComponent } from './components/level-intro/level-intro.component';
import { BuffSelectionComponent } from './components/buff-selection/buff-selection.component';
import { BuffHudComponent } from './components/buff-hud/buff-hud.component';
import { GameOverComponent } from './components/game-over/game-over.component';

import {
  EndlessPhase, EndlessRunState, ActiveBuff, BuffDefinition,
  PlayerModifiers, calculateModifiers
} from './endless-types';
import { initializeCharacters } from '../../characters/registry';
import {
  getLevelConfig, selectRandomBuffs, ENDLESS_SCALING, BUFF_POOL
} from './endless-config';

// Boss Event System
import { BossEventManager, BossEventRenderer, BossEventResult } from './events';
import { TICK_RATE, PHYSICS } from 'src/app/core/config';
import { DESIGN_HEIGHT, GROUND_Y } from 'src/app/adapters/spine-bone-transform';

// Dummy System
import { DummyRenderer, getDummy, initializeDummies } from '../../dummies';
import type { DummyInstance } from '../../dummies';

@Component({
  selector: 'app-endless',
  standalone: true,
  imports: [
    CommonModule,
    PlayerHealthbarComponent,
    AiHealthbarComponent,
    LevelIntroComponent,
    BuffSelectionComponent,
    BuffHudComponent,
    GameOverComponent
  ],
  templateUrl: './endless.component.html',
  styleUrl: './endless.component.css'
})
export class EndlessComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: false }) canvasRef!: ElementRef<HTMLDivElement>;

  private gameLoop?: GameLoop;
  private spineRenderer?: SpineRenderer;
  private lastFrameTime: number = 0;

  // Regeneration tracking (ticks since last regen)
  private regenTickAccumulator: number = 0;
  private readonly TICKS_PER_SECOND = TICK_RATE;

  // Endless mode state
  phase = signal<EndlessPhase>('intro');
  runState = signal<EndlessRunState>({
    currentLevel: 1,
    playerHealth: ENDLESS_SCALING.playerStartHp,
    playerMaxHealth: ENDLESS_SCALING.playerStartMaxHp,
    activeBuffs: [], // BUFF_POOL.map(b => ({ id: b.id, stacks: 3 }))
    loadout: 'bare',
    totalKills: 0,
    totalDamageDealt: 0,
  });

  // Current level config
  currentLevelConfig = computed(() => getLevelConfig(this.runState().currentLevel));

  // Available buff choices
  buffChoices = signal<BuffDefinition[]>([]);

  // Player modifiers from buffs
  playerModifiers = computed(() => {
    const state = this.runState();
    return calculateModifiers(state.activeBuffs, state.loadout);
  });

  // Match state
  private matchState = signal<MatchState | null>(null);
  fighter0 = computed(() => {
    const state = this.matchState();
    if (!state) return this.createEmptyFighter();

    // Override with run state HP
    const fighter = { ...state.fighters[0] };
    fighter.health = this.runState().playerHealth;
    fighter.maxHealth = this.runState().playerMaxHealth + this.playerModifiers().maxHealthBonus;
    return fighter;
  });
  fighter1 = computed(() => this.matchState()?.fighters[1] ?? this.createEmptyFighter());

  // Spine status
  spineStatus = signal<SpineStatus>('loading');

  // Available backgrounds for random selection
  private readonly availableBackgrounds: BackgroundId[] = ['city1', 'city2', 'city3', 'city4', 'forrest', 'castle', 'destroyedCity'];

  // Preloaded background for next fight
  private preloadedBackground: BackgroundId | null = null;

  // Fight ending state (for death animation delay)
  private fightEnding = false;

  // Boss Event System
  private eventManager?: BossEventManager;
  private eventRenderer?: BossEventRenderer;
  private eventActive = signal(false);
  private lastRenderTime = 0;

  // Dummy System (for dummy-wave events)
  private dummyRenderer?: DummyRenderer;
  private activeDummyInstance?: DummyInstance;

  // Game over stats
  gameOverStats = computed(() => ({
    level: this.runState().currentLevel,
    kills: this.runState().totalKills,
    damage: this.runState().totalDamageDealt,
  }));

  constructor(private router: Router) { }

  @HostListener('window:keydown.escape', ['$event'])
  handleEscape(event: Event): void {
    event.preventDefault();
    // In endless mode, ESC goes back to menu (no pause)
    if (this.phase() === 'fight') {
      this.exitToMenu();
    }
  }

  ngOnInit(): void {
    // Initialization handled in ngAfterViewInit
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.canvasRef?.nativeElement) {
      console.error('[EndlessMode] Canvas container not found!');
      this.spineStatus.set('error');
      return;
    }

    await this.initializeSpine();
  }

  ngOnDestroy(): void {
    const audio = getAudioPlayer();
    audio.stopMusic(true);
    this.spineRenderer?.dispose();
    this.gameLoop?.dispose();
    this.eventRenderer?.dispose();
    this.dummyRenderer?.dispose();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initializeSpine(): Promise<void> {
    this.spineStatus.set('loading');

    // Initialize all character providers FIRST
    await initializeCharacters();

    // Initialize dummy system (for dummy-wave events)
    await initializeDummies();

    const canvas = document.createElement('canvas');
    const container = this.canvasRef.nativeElement;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(container.clientWidth * dpr);
    canvas.height = Math.floor(container.clientHeight * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    container.appendChild(canvas);

    this.spineRenderer = new SpineRenderer(canvas);

    try {
      await this.spineRenderer.initialize();
      this.spineStatus.set('ready');

      // Preload first background immediately
      await this.preloadNextBackground();

      // Start render loop
      this.startRenderLoop();
    } catch (error) {
      console.error('[EndlessMode] Spine initialization failed:', error);
      this.spineStatus.set('error');
    }
  }

  // ============================================================================
  // PHASE TRANSITIONS
  // ============================================================================

  private startRenderLoop(): void {
    this.lastFrameTime = performance.now() / 1000;

    const render = () => {
      if (this.spineStatus() !== 'ready') return;

      const now = performance.now() / 1000;
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.spineRenderer?.render(delta);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  private selectRandomBackground(): BackgroundId {
    const index = Math.floor(Math.random() * this.availableBackgrounds.length);
    return this.availableBackgrounds[index];
  }

  private async preloadNextBackground(): Promise<void> {
    this.preloadedBackground = this.selectRandomBackground();
    await this.spineRenderer?.setBackground(this.preloadedBackground);
  }

  async onIntroStart(): Promise<void> {

    // Reset fight ending state
    this.fightEnding = false;

    // Use preloaded background or load one now
    if (!this.preloadedBackground) {
      await this.preloadNextBackground();
    }

    // Switch to fight phase (background is already loaded)
    this.phase.set('fight');

    // Initialize audio
    await initializeAudio();
    const audio = getAudioPlayer();
    await audio.playMusic('fight');

    // Start the fight (async - switches boss character)
    await this.startFight();
  }

  onBuffsSelected(buffs: BuffDefinition[]): void {
    const state = this.runState();
    let newBuffs = [...state.activeBuffs];
    let newLoadout = state.loadout;
    let newHealth = state.playerHealth;

    // Process each selected buff
    for (const buff of buffs) {
      const existingIndex = newBuffs.findIndex(b => b.id === buff.id);

      if (existingIndex >= 0 && buff.stackable) {
        // Stack existing buff
        newBuffs[existingIndex] = {
          ...newBuffs[existingIndex],
          stacks: newBuffs[existingIndex].stacks + 1,
        };
      } else if (existingIndex < 0) {
        // Add new buff
        newBuffs = [...newBuffs, { id: buff.id, stacks: 1 }];
      }

      // Check for sword mastery
      if (buff.id === 'sword_mastery') {
        newLoadout = 'sword';
      }
    }

    // Apply max health bonus immediately
    const newModifiers = calculateModifiers(newBuffs, newLoadout);
    const newMaxHealth = ENDLESS_SCALING.playerStartMaxHp + newModifiers.maxHealthBonus;

    // Process vitality buffs healing
    for (const buff of buffs) {
      if (buff.id === 'vitality') {
        newHealth = Math.min(newHealth + 50, newMaxHealth);
      } else if (buff.id === 'greater_vitality') {
        newHealth = Math.min(newHealth + 75, newMaxHealth);
      }
    }

    this.runState.set({
      ...state,
      activeBuffs: newBuffs,
      loadout: newLoadout,
      playerMaxHealth: newMaxHealth,
      playerHealth: newHealth,
      currentLevel: state.currentLevel + 1,
    });

    // Move to next level intro
    this.phase.set('intro');
  }

  // ============================================================================
  // FIGHT LOGIC
  // ============================================================================

  private async startFight(): Promise<void> {
    const levelConfig = this.currentLevelConfig();
    const state = this.runState();
    const modifiers = this.playerModifiers();

    // Calculate actual max health with buffs
    const playerMaxHealth = ENDLESS_SCALING.playerStartMaxHp + modifiers.maxHealthBonus;

    // Ensure player health doesn't exceed max
    const playerHealth = Math.min(state.playerHealth, playerMaxHealth);

    // Switch boss character BEFORE creating GameLoop
    const bossCharacterId = this.getCharacterIdFromAI(levelConfig.aiId);
    if (this.spineRenderer) {
      await this.spineRenderer.switchFighterCharacter(1, bossCharacterId);
    }

    const skeletons = this.spineRenderer?.getSkeletons() ?? [];

    this.gameLoop = new GameLoop({
      loadouts: [modifiers.loadout, 'bare'],  // Use modifiers.loadout for sword_mastery buff
      characterIds: ['stickman', bossCharacterId],
      aiEnabled: true,
      skeletons: skeletons,
      spineRenderer: this.spineRenderer,
    });

    // Initialize Boss Event System
    this.initializeEventSystem(levelConfig.events ?? []);

    // Override initial health values
    // Note: We need to modify the game state after creation

    // Reset regeneration accumulator for new fight
    this.regenTickAccumulator = 0;

    // Subscribe to tick updates
    this.gameLoop.onTick((matchState, events) => {
      // Apply swift buff - increase player movement speed (always, even during events)
      const modifiers = this.playerModifiers();
      if (modifiers.speedMultiplier !== 1.0) {
        matchState.fighters[0].speedMultiplier = modifiers.speedMultiplier;
      }

      // Skip normal processing during active event
      if (this.eventActive()) {
        // CRITICAL: Update SpineRenderer FIRST so cameraX is current for event rendering!
        this.spineRenderer?.applySnapshot(matchState);
        // Only update event system
        this.tickEventSystem(matchState);
        this.matchState.set(matchState);
        return;
      }

      // Apply regeneration buff (HP per second)
      if (modifiers.hpRegenPerSecond > 0) {
        this.regenTickAccumulator++;
        if (this.regenTickAccumulator >= this.TICKS_PER_SECOND) {
          this.regenTickAccumulator = 0;
          this.healPlayer(modifiers.hpRegenPerSecond);
        }
      }

      // Check for boss events
      // CRITICAL: applySnapshot must be called BEFORE tickEventSystem 
      // so cameraX is synchronized between SpineRenderer and EventRenderer
      this.spineRenderer?.applySnapshot(matchState);
      this.tickEventSystem(matchState);

      // Apply player modifiers to damage dealt
      this.processEventsWithModifiers(matchState, events);

      // Pass events to SpineRenderer for combat text
      this.spineRenderer?.handleEvents(events);

      this.matchState.set(matchState);

      // Check for fight end
      this.checkFightEnd(matchState, events);
    });

    // Start the loop
    this.gameLoop.start();

    // Override player health after start
    this.overridePlayerHealth(playerHealth, playerMaxHealth);

    // Override boss health
    this.overrideBossHealth(levelConfig.bossHealth);
  }

  // ============================================================================
  // BOSS EVENT SYSTEM
  // ============================================================================

  private initializeEventSystem(events: import('./events').BossEventDefinition[]): void {
    // Create renderer if needed
    if (!this.eventRenderer && this.canvasRef?.nativeElement) {
      this.eventRenderer = new BossEventRenderer(this.canvasRef.nativeElement);
    }

    // Create dummy renderer if needed
    if (!this.dummyRenderer && this.canvasRef?.nativeElement) {
      const container = this.canvasRef.nativeElement;
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 1920;
      dummyCanvas.height = 1080;
      dummyCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9;
      `;
      container.appendChild(dummyCanvas);
      this.dummyRenderer = new DummyRenderer(dummyCanvas);
      this.dummyRenderer.setShowHitboxes(false);
    }

    // Create manager with callbacks
    this.eventManager = new BossEventManager(events, {
      onEventStart: (event) => {
        console.log('[EndlessMode] Boss event started:', event.definition.type);
        this.eventActive.set(true);

        // Show announcement
        if (event.definition.announcement) {
          this.spineRenderer?.showCenteredText(event.definition.announcement, '#ffaa00', 2.0);
        }

        // Hide boss
        this.spineRenderer?.setFighterVisible(1, false);

        // Pause AI
        this.gameLoop?.setAIEnabled(false);
        
        // Disable boss interaction (no facing/collision)
        this.gameLoop?.setBossInteractionEnabled(false);

        // Enable arena bounds for dummy events
        if (event.definition.type === 'dummy-wave' && this.dummyRenderer) {
          this.dummyRenderer.setArenaBounds(true, PHYSICS.minX, PHYSICS.maxX);
        }
      },
      onEventEnd: (result) => {
        console.log('[EndlessMode] Boss event ended:', result.success ? 'SUCCESS' : 'FAIL');
        this.eventActive.set(false);

        // Show boss
        this.spineRenderer?.setFighterVisible(1, true);

        // Resume AI
        this.gameLoop?.setAIEnabled(true);
        
        // Re-enable boss interaction
        this.gameLoop?.setBossInteractionEnabled(true);

        // Clear and disable arena bounds for dummies
        if (this.dummyRenderer) {
          this.dummyRenderer.clearInstances();
          this.dummyRenderer.setArenaBounds(false);
          console.log('[EndlessMode] Dummies cleared');
        }

        // Apply result
        this.applyEventResult(result);

        // Clear event overlay
        this.eventRenderer?.clear();
        this.activeDummyInstance = undefined;
      },
      onDummySpawnRequest: async (dummyId, x, y, facing) => {
        console.log('[EndlessMode] Spawning dummy:', dummyId, 'at', x, y);
        
        if (!this.dummyRenderer) return;

        // Load dummy assets if not loaded
        if (!this.dummyRenderer.isLoaded(dummyId)) {
          const dummyDef = getDummy(dummyId);
          if (dummyDef) {
            await this.dummyRenderer.loadDummy(dummyId);
          }
        }

        // Get stage-specific groundY (each background has different ground height)
        const stageGroundY = this.spineRenderer?.getGroundY() ?? 250;
        
        // Spawn dummy instance at stage ground level
        this.activeDummyInstance = this.dummyRenderer.spawnDummy(dummyId, x, stageGroundY, facing);
      },
      onDummyDeath: (dummyId, x, y) => {
        console.log('[EndlessMode] Dummy died:', dummyId, 'at', x, y);
        
        // Don't remove yet - death animation needs it
        // Will be removed when animation completes (deathAnimationTicks === 0)
      },
      onDummyAnimationComplete: () => {
        // Called when death animation finishes (deathAnimationTicks === 0)
        if (this.activeDummyInstance && this.dummyRenderer) {
          this.dummyRenderer.removeDummy(this.activeDummyInstance);
          this.activeDummyInstance = undefined;
          console.log('[EndlessMode] Removed dead dummy after animation');
        }
      },
    });

    this.lastRenderTime = performance.now();
  }

  private tickEventSystem(matchState: MatchState): void {
    if (!this.eventManager) return;

    const boss = matchState.fighters[1];
    const player = matchState.fighters[0];

    const cameraLeft = this.spineRenderer?.getCameraLeft() ?? 0;
    const groundY =  DESIGN_HEIGHT - GROUND_Y;

    // Calculate player hitbox for dummy-wave events (in world coordinates!)
    const playerAttacking = player.state === 'attack';
    const playerFacingRight = player.facingRight;
    
    // Simple hitbox: 100px wide, 150px tall, positioned in front of player based on facing
    // NOTE: Keep in world coordinates (don't subtract cameraLeft)
    const playerHitbox = {
      x: player.x + (playerFacingRight ? 0 : -100), // In front when attacking
      y: groundY - 150, // Approximate player height
      width: 100,
      height: 150
    };

    // Get current dummy position if active (for hit detection)
    const currentDummyX = this.activeDummyInstance?.x;

    // Tick the event manager
    this.eventManager.tick(
      boss.health,
      boss.maxHealth,
      player.x,
      player.y,
      boss.x,
      matchState.tick,
      cameraLeft,
      groundY,
      playerAttacking,
      playerFacingRight,
      playerHitbox,
      currentDummyX
    );

    // Update dummy movement during event
    const activeEvent = this.eventManager.getActiveEvent();
    if (activeEvent && activeEvent.definition.type === 'dummy-wave' && this.dummyRenderer) {
      const deltaTime = 1 / TICK_RATE; // Fixed timestep
      this.dummyRenderer.update(deltaTime);
    }

    // Render event overlay
    const now = performance.now();
    const deltaMs = now - this.lastRenderTime;
    this.lastRenderTime = now;

    if (activeEvent && this.eventRenderer) {
      this.eventRenderer.setCameraLeft(cameraLeft);
      this.eventRenderer.render(activeEvent, deltaMs, groundY);
      
      // Render dummies with camera offset
      if (activeEvent.definition.type === 'dummy-wave' && this.dummyRenderer) {
        this.dummyRenderer.render(cameraLeft);
      }
    }
    // Result is handled by callback
  }

  private applyEventResult(result: BossEventResult): void {
    if (!this.gameLoop) return;

    if (result.success && result.reward) {
      const reward = result.reward;

      // Apply rewards directly to GameLoop state so they persist
      this.gameLoop.modifyState((state) => {
        // Stun boss
        if (reward.bossStunTicks) {
          state.fighters[1].pressureStunTicks = reward.bossStunTicks;
          state.fighters[1].state = 'hurt';
          state.fighters[1].stateTicks = 0;
          console.log('[EndlessMode] Boss stunned for', reward.bossStunTicks, 'ticks');
        }

        // Grant special meter
        if (reward.specialMeter) {
          const oldMeter = state.fighters[0].specialMeter;
          state.fighters[0].specialMeter = Math.min(100,
            state.fighters[0].specialMeter + reward.specialMeter);
          console.log('[EndlessMode] Special meter:', oldMeter, '->', state.fighters[0].specialMeter);
        }

        // Damage boss
        if (reward.bossDamage) {
          state.fighters[1].health = Math.max(0,
            state.fighters[1].health - reward.bossDamage);
        }
      });

      // Heal player (uses separate runState)
      if (reward.healPlayer) {
        this.healPlayer(reward.healPlayer);
      }

      console.log('[EndlessMode] Event reward applied:', reward);

      // Show success message
      this.spineRenderer?.showCenteredText('✅ EVENT ERFOLGREICH', '#44ff44');
    } else if (!result.success && result.penalty) {
      const penalty = result.penalty;

      // Apply penalties directly to GameLoop state
      this.gameLoop.modifyState((state) => {
        // Damage player
        if (penalty.playerDamage) {
          state.fighters[0].health = Math.max(0,
            state.fighters[0].health - penalty.playerDamage);
        }

        // Stun player
        if (penalty.playerStunTicks) {
          state.fighters[0].pressureStunTicks = penalty.playerStunTicks;
          state.fighters[0].state = 'hurt';
          state.fighters[0].stateTicks = 0;
        }

        // Heal boss
        if (penalty.bossHeal) {
          state.fighters[1].health = Math.min(
            state.fighters[1].maxHealth,
            state.fighters[1].health + penalty.bossHeal
          );
        }
      });

      // Also update runState for player damage
      if (penalty.playerDamage) {
        const runState = this.runState();
        this.runState.set({
          ...runState,
          playerHealth: Math.max(0, runState.playerHealth - penalty.playerDamage),
        });
      }

      console.log('[EndlessMode] Event penalty applied:', penalty);

      // Show failure message
      this.spineRenderer?.showCenteredText('❌ EVENT FEHLGESCHLAGEN', '#ff4444');
    }
  }

  private processEventsWithModifiers(state: MatchState, events: GameEvent[]): void {
    const modifiers = this.playerModifiers();
    const runState = this.runState();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Apply damage multipliers for player attacks
      if (event.type === 'hit' && event.attacker === 0) {
        const baseDamage = event.damage;

        // Determine damage multiplier based on attack ID
        let damageMultiplier = 1.0;
        const attackId = event.attack?.toLowerCase() ?? '';

        // Special attacks
        if (attackId === 'thousand_fists') {
          damageMultiplier = modifiers.damageSpecial;
        }
        // Heavy attacks
        else if (attackId === 'kick_high' || attackId === 'flying_kick' || attackId === 'salto_kick' || attackId === 'slash_heavy') {
          damageMultiplier = modifiers.damageHeavy;
        }
        // Light attacks (jab_double, reverse_kick, slash, and any others)
        else {
          damageMultiplier = modifiers.damageLight;
        }

        // Calculate total damage with multiplier
        const totalDamage = Math.floor(baseDamage * damageMultiplier);
        const bonusDamage = totalDamage - baseDamage;

        if (bonusDamage > 0) {
          // Apply bonus damage directly to boss HP
          state.fighters[1].health = Math.max(0, state.fighters[1].health - bonusDamage);

          // Update event damage for combat text display
          (events[i] as any).damage = totalDamage;
        }

        // Track total damage (base + bonus)
        this.runState.set({
          ...runState,
          totalDamageDealt: runState.totalDamageDealt + totalDamage,
        });

        // HP on hit (vampirism)
        if (modifiers.hpOnHit > 0) {
          this.healPlayer(modifiers.hpOnHit);
        }

        // Bonus special meter charge on hit (special_charge buff)
        if (modifiers.specialChargeMultiplier > 1.0) {
          const baseCharge = 10;
          const bonusCharge = Math.floor(baseCharge * (modifiers.specialChargeMultiplier - 1.0));
          if (bonusCharge > 0) {
            state.fighters[0].specialMeter = Math.min(100, state.fighters[0].specialMeter + bonusCharge);
          }
        }

        // Extra pressure meter build on boss (pressure_master buff)
        if (modifiers.pressureMultiplier > 1.0) {
          const basePressure = 15;
          const bonusPressure = Math.floor(basePressure * (modifiers.pressureMultiplier - 1.0));
          if (bonusPressure > 0) {
            state.fighters[1].pressureMeter = Math.min(100, state.fighters[1].pressureMeter + bonusPressure);
          }
        }
      }

      // HP on parry + counter damage (parry mastery + counter strike)
      if (event.type === 'parry' && event.defender === 0) {
        // HP on parry
        if (modifiers.hpOnParry > 0) {
          this.healPlayer(modifiers.hpOnParry);
        }

        // Counter strike - deal bonus damage to attacker (boss)
        if (modifiers.parryCounterDamage > 0) {
          state.fighters[1].health = Math.max(0, state.fighters[1].health - modifiers.parryCounterDamage);
        }

        // Bonus special meter charge on parry (special_charge buff)
        if (modifiers.specialChargeMultiplier > 1.0) {
          const bonusCharge = Math.floor(12 * (modifiers.specialChargeMultiplier - 1.0));
          state.fighters[0].specialMeter = Math.min(100, state.fighters[0].specialMeter + bonusCharge);
        }
      }

      // Block boost - heal small amount on successful block
      if (event.type === 'block' && event.defender === 0) {
        if (modifiers.blockReduction > 0) {
          // Convert block reduction to HP restored (30% = 6 HP per block)
          const healAmount = Math.floor(modifiers.blockReduction * 20);
          this.healPlayer(healAmount);
        }
      }

      // Track damage taken by player - apply boss damage multiplier!
      if (event.type === 'hit' && event.defender === 0) {
        const levelConfig = this.currentLevelConfig();
        const bossMultiplier = levelConfig.bossDamageMultiplier;
        const baseDamage = event.damage;
        const totalDamage = Math.floor(baseDamage * bossMultiplier);

        // Update event damage for display
        (events[i] as any).damage = totalDamage;

        this.runState.update(s => ({
          ...s,
          playerHealth: Math.max(0, s.playerHealth - totalDamage),
        }));
      }
    }
  }

  private healPlayer(amount: number): void {
    const state = this.runState();
    const maxHealth = ENDLESS_SCALING.playerStartMaxHp + this.playerModifiers().maxHealthBonus;
    const newHealth = Math.min(state.playerHealth + amount, maxHealth);

    this.runState.set({
      ...state,
      playerHealth: newHealth,
    });
  }

  private checkFightEnd(state: MatchState, events: GameEvent[]): void {
    // Don't process if already ending
    if (this.fightEnding) return;

    for (const event of events) {
      if (event.type === 'fightWon') {
        this.fightEnding = true;

        // Let death animation play for 2 seconds before transitioning
        setTimeout(() => {
          if (event.winner === 0) {
            this.onPlayerVictory();
          } else {
            this.onPlayerDefeat();
          }
        }, 2000);

        return; // Only handle once
      }
    }
  }

  private async onPlayerVictory(): Promise<void> {

    // Stop game loop
    this.gameLoop?.setPaused(true);
    this.gameLoop?.dispose();
    this.gameLoop = undefined;

    // Calculate HP restore with First Aid bonus
    const state = this.runState();
    const modifiers = this.playerModifiers();
    const maxHealth = ENDLESS_SCALING.playerStartMaxHp + modifiers.maxHealthBonus;

    // Base restore + First Aid bonus (e.g. 100 * (1 + 0.5) = 150 with one stack)
    const baseRestore = ENDLESS_SCALING.hpRestoreOnWin;
    const totalRestore = Math.floor(baseRestore * (1 + modifiers.victoryHealBonus));
    const newHealth = Math.min(state.playerHealth + totalRestore, maxHealth);

    this.runState.set({
      ...state,
      playerHealth: newHealth,
      totalKills: state.totalKills + 1,
    });

    // Generate buff choices
    const excludeIds = state.activeBuffs
      .filter(b => {
        const def = BUFF_POOL.find(d => d.id === b.id);
        return def && !def.stackable;
      })
      .map(b => b.id);

    this.buffChoices.set(selectRandomBuffs(5, excludeIds));

    // Preload next background while showing buff selection
    this.preloadedBackground = null; // Clear old one
    await this.preloadNextBackground();

    // Show buff selection
    this.phase.set('buff-select');
  }

  private onPlayerDefeat(): void {

    // Stop game loop
    this.gameLoop?.setPaused(true);
    this.gameLoop?.dispose();
    this.gameLoop = undefined;

    // Stop music
    const audio = getAudioPlayer();
    audio.stopMusic(true);

    // Show game over
    this.phase.set('game-over');
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getCharacterIdFromAI(aiId: string): string {
    // Extract character from AI ID (e.g., 'boss1-aggressive' -> 'boss1')
    if (aiId.startsWith('boss1')) return 'boss1';
    if (aiId.startsWith('boss2')) return 'boss2';
    if (aiId.startsWith('boss3')) return 'boss3';
    return 'stickman';
  }

  private overridePlayerHealth(health: number, maxHealth: number): void {
    // Access internal state - this is a bit hacky but necessary
    const state = (this.gameLoop as any)?.matchState;
    if (state?.fighters?.[0]) {
      state.fighters[0].health = health;
      state.fighters[0].maxHealth = maxHealth;
    }
  }

  private overrideBossHealth(health: number): void {
    const state = (this.gameLoop as any)?.matchState;
    if (state?.fighters?.[1]) {
      state.fighters[1].health = health;
      state.fighters[1].maxHealth = health;
    }
  }

  private createEmptyFighter() {
    return {
      id: 0 as const,
      characterId: 'stickman',
      loadout: 'bare' as Loadout,
      state: 'idle' as const,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      moveVx: 0,
      impulseVx: 0,
      externalImpulseX: 0,
      facingRight: true,
      health: 500,
      maxHealth: 500,
      specialMeter: 0,
      maxSpecialMeter: 100,
      pressureMeter: 0,
      maxPressureMeter: 100,
      pressureStunTicks: 0,
      stateTicks: 0,
      cooldownTicks: 0,
      activeAttack: null,
      attackZone: null,
      blockZone: null,
      attackInstanceId: 0,
      lastHitByInstanceId: -1,
      lastBlockPressTick: -99999,
      isParryWindowActive: false,
      attackLandedHit: false,
      speedMultiplier: 1.0,
      superArmorActive: false,
    };
  }

  exitToMenu(): void {
    this.gameLoop?.dispose();
    const audio = getAudioPlayer();
    audio.stopMusic(true);
    this.router.navigate(['/menu']);
  }

  restartRun(): void {
    // Reset run state
    this.runState.set({
      currentLevel: 1,
      playerHealth: ENDLESS_SCALING.playerStartHp,
      playerMaxHealth: ENDLESS_SCALING.playerStartMaxHp,
      activeBuffs: [],
      loadout: 'bare',
      totalKills: 0,
      totalDamageDealt: 0,
    });

    // Cleanup old game loop
    this.gameLoop?.dispose();

    // Start fresh
    this.phase.set('intro');
  }
}
