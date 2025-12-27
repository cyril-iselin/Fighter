import { step, createInitialState } from '../core/step';
import type { MatchState, Loadout, Intent, GameEvent } from '../core/types';
import { TICK_RATE } from '../core/config';
import { SpineAdapter } from '../adapters/spine-adapter';
import { SoundAdapter } from '../adapters/sound-adapter';
import { InputHandler } from './input-handler';
import { DebugBrain } from '../ai/debug-brain';
import { createObservation } from '../ai/observation';
import type { IFighterBrain } from '../ai/brain.interface';
import { createBrain, initializeAI } from '../ai';
import { StubSpineSkeleton } from './stubs';
import { getAudioPlayer, type WebAudioPlayer } from '../adapters/audio/web-audio-player';
import { BufferManager } from '../core/buffer-manager';
import { checkBoneHit } from '../core/bone-combat';
import { checkProximityRageBurst } from '../core/rules/rage-burst';

// ============================================================================
// GAME LOOP (Fixed Timestep with Accumulator Pattern + Training Controls)
// ============================================================================

export interface GameLoopConfig {
  loadouts: [Loadout, Loadout];
  characterIds?: [string, string]; // Optional: defaults to ['stickman', 'stickman']
  aiBrain?: IFighterBrain;  // Optional: defaults to BasicBrain('stickman')
  enableDebugLogging?: boolean;
  aiEnabled?: boolean;  // Can toggle AI on/off
  skeletons?: any[];  // Optional: real skeletons from SpineRenderer
  spineRenderer?: any;  // Optional: SpineRenderer for bone sampling
}

/**
 * Main game loop orchestrator with training mode support
 * - Pause/Resume
 * - Step (single tick)
 * - Slow-motion (timeScale)
 * - Reset match
 */
export class GameLoop {
  private running = false;
  private paused = false;
  private matchState: MatchState;
  private lastTimestamp = 0;
  private accumulator = 0;
  private readonly dt = 1000 / TICK_RATE;  // 16.666... ms per tick
  private timeScale = 1.0;  // 1.0 = normal, 0.5 = half speed, 0.25 = quarter speed

  // Subsystems
  private readonly inputHandler: InputHandler;
  private aiBrain: IFighterBrain;
  private aiEnabled: boolean;
  private readonly spineAdapter: SpineAdapter;
  private readonly soundAdapter: SoundAdapter;
  private readonly bufferManager: BufferManager;  // Input buffer for cancel system

  // Skeletons (real from SpineRenderer or stubs for testing)
  private readonly skeletons: any[];
  private readonly spineRenderer?: any;  // SpineRenderer for bone sampling
  private readonly audioPlayer: WebAudioPlayer;

  // State tracking
  private initialLoadouts: [Loadout, Loadout];
  private initialCharacterIds: [string, string];
  private tickCount = 0;
  private fpsCounter = { frames: 0, lastTime: 0, fps: 0 };
  private lastEvents: GameEvent[] = [];

  // Callbacks
  private onTickCallback?: (state: MatchState, events: GameEvent[]) => void;

  constructor(config: GameLoopConfig) {
    // Store initial config for reset
    this.initialLoadouts = config.loadouts;
    this.initialCharacterIds = config.characterIds ?? ['stickman', 'stickman'];
    this.aiEnabled = config.aiEnabled ?? true;

    // Use provided skeletons or fall back to stubs
    this.skeletons = config.skeletons ?? [new StubSpineSkeleton(), new StubSpineSkeleton()];
    this.spineRenderer = config.spineRenderer;  // Store SpineRenderer reference

    // Initialize core state with character IDs
    this.matchState = createInitialState(config.loadouts, this.initialCharacterIds);

    // Initialize subsystems
    this.inputHandler = new InputHandler();
    
    // Audio player (global singleton)
    this.audioPlayer = getAudioPlayer();
    
    // AI Brain (with optional debug wrapper)
    // Default to GenericBasicBrain via factory if not provided
    initializeAI();  // Ensure profiles are registered
    const aiCharacterId = this.initialCharacterIds[1];
    const baseBrain = config.aiBrain ?? createBrain(aiCharacterId);
    this.aiBrain = config.enableDebugLogging 
      ? new DebugBrain(baseBrain, { logInterval: 60 })
      : baseBrain;

    this.spineAdapter = new SpineAdapter();
    this.soundAdapter = new SoundAdapter(this.audioPlayer);
    this.bufferManager = new BufferManager();  // Initialize buffer manager
    
    // Apply initial timeScale if not default
    if (this.timeScale !== 1.0) {
      this.spineAdapter.setTimeScale(this.timeScale);
    }

    console.log('[GameLoop] Initialized', {
      loadouts: config.loadouts,
      characterIds: this.initialCharacterIds,
      tickRate: TICK_RATE,
      dt: this.dt,
      aiEnabled: this.aiEnabled,
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Starts the game loop
   */
  start(): void {
    if (this.running) {
      console.warn('[GameLoop] Already running');
      return;
    }

    this.running = true;
    this.paused = false;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.fpsCounter.lastTime = performance.now();

    // Emit fight start event
    this.lastEvents = [{ type: 'fightStart' }];
    this.soundAdapter.handleEvents(this.lastEvents);

    console.log('[GameLoop] Started');
    this.loop(this.lastTimestamp);
  }

  /**
   * Stops the game loop
   */
  stop(): void {
    this.running = false;
    console.log('[GameLoop] Stopped', {
      totalTicks: this.tickCount,
      finalState: this.matchState,
    });
  }

  /**
   * Pauses/Resumes the game
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
    
    // Reset input handler when unpausing to prevent stale inputs (e.g., clicks from menu)
    if (!paused) {
      this.inputHandler.reset();
    }
    
    console.log(`[GameLoop] ${paused ? 'Paused' : 'Resumed'}`);
  }

  /**
   * Toggles pause state
   */
  togglePause(): void {
    this.setPaused(!this.paused);
  }

  /**
   * Sets time scale (slow-mo)
   * 1.0 = normal, 0.5 = half speed, 0.25 = quarter speed
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(2.0, scale));
    // Also apply to spine animations
    this.spineAdapter.setTimeScale(this.timeScale);
    console.log(`[GameLoop] Time scale: ${this.timeScale}x`);
  }

  /**
   * Resets match to initial state
   */
  resetMatch(): void {
    this.matchState = createInitialState(this.initialLoadouts, this.initialCharacterIds);
    this.tickCount = 0;
    this.accumulator = 0;
    this.lastEvents = [];
    
    // Reset input handler to clear any stuck flags (prevents auto-attack on reset)
    this.inputHandler.reset();
    
    // Clear input buffers
    this.bufferManager.clearAll();
    
    console.log('[GameLoop] Match reset');
    
    // Update visuals immediately
    this.render();
  }

  /**
   * Toggles AI on/off
   */
  setAIEnabled(enabled: boolean): void {
    this.aiEnabled = enabled;
    console.log(`[GameLoop] AI ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Hot-swap AI brain during runtime
   * @param brain New brain instance to use
   */
  setAIBrain(brain: IFighterBrain): void {
    this.aiBrain = brain;
    console.log('[GameLoop] AI brain swapped');
  }

  /**
   * Changes character for a fighter (requires visual update via SpineRenderer)
   * This updates the game state - caller should also call spineRenderer.switchFighterCharacter()
   */
  async setCharacter(fighterId: 0 | 1, characterId: string): Promise<void> {
    // Switch visual in SpineRenderer FIRST (loads skeleton asynchronously)
    // Only update game state after skeleton loads to avoid animation mismatch
    if (this.spineRenderer?.switchFighterCharacter) {
      const success = await this.spineRenderer.switchFighterCharacter(fighterId, characterId);
      if (!success) {
        console.error(`[GameLoop] Failed to switch Fighter ${fighterId} to ${characterId}`);
        return;
      }
    }
    
    // NOW update game state after skeleton is loaded
    this.initialCharacterIds[fighterId] = characterId;
    this.matchState.fighters[fighterId].characterId = characterId;
    
    console.log(`[GameLoop] Fighter ${fighterId} character changed to: ${characterId}`);
  }

  /**
   * Changes loadout for a fighter (hot-swap without reset)
   */
  setLoadout(fighterId: 0 | 1, loadout: Loadout): void {
    this.initialLoadouts[fighterId] = loadout;
    this.matchState.fighters[fighterId].loadout = loadout;
    
    // Clear active attack if fighter was attacking (weapon changed)
    const fighter = this.matchState.fighters[fighterId];
    if (fighter.activeAttack) {
      fighter.activeAttack = null;
      fighter.state = 'idle';
      fighter.stateTicks = 0;
    }
    
    console.log(`[GameLoop] Fighter ${fighterId} loadout changed to ${loadout}`);
  }

  /**
   * Gets current match state (readonly)
   */
  getState(): Readonly<MatchState> {
    return this.matchState;
  }

  /**
   * Gets last tick's events
   */
  getLastEvents(): readonly GameEvent[] {
    return this.lastEvents;
  }

  /**
   * Sets callback for tick updates (for UI)
   */
  onTick(callback: (state: MatchState, events: GameEvent[]) => void): void {
    this.onTickCallback = callback;
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    this.stop();
    this.inputHandler.dispose();
    console.log('[GameLoop] Disposed');
  }

  // ============================================================================
  // GAME LOOP (Private)
  // ============================================================================

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    // Calculate frame delta
    const frameDelta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Add to accumulator (clamped to prevent spiral of death)
    // Apply time scale for slow-mo
    if (!this.paused) {
      this.accumulator += Math.min(frameDelta, 100) * this.timeScale;
    }

    // Fixed timestep updates
    while (this.accumulator >= this.dt) {
      if (!this.paused) {
        this.tick();
        this.tickCount++;
      }
      this.accumulator -= this.dt;
    }

    // Render (happens every frame, independent of tick rate)
    this.render();

    // FPS counter
    this.updateFPS(timestamp);

    // Next frame
    requestAnimationFrame(this.loop);
  };

  /**
   * Fixed timestep tick (runs at TICK_RATE Hz)
   */
  private tick(): void {
    // Get intents
    const intent0 = this.inputHandler.getIntent();  // Player
    
    let intent1: Intent;
    if (this.aiEnabled) {
      const obs1 = createObservation(this.matchState, 1);
      intent1 = this.aiBrain.decide(obs1, this.matchState.tick);  // AI
    } else {
      // AI disabled - idle intent
      intent1 = { move: 'none', attack: null, block: null, jump: false, run: false };
    }

    // Step core simulation
    const result = step(this.matchState, [intent0, intent1], this.bufferManager);
    this.matchState = result.state;
    this.lastEvents = result.events;

    // Apply phase modifiers AFTER step (so they persist on new cloned state)
    if (this.aiEnabled) {
      if (this.aiBrain.getSpeedMultiplier) {
        this.matchState.fighters[1].speedMultiplier = this.aiBrain.getSpeedMultiplier();
      }
      if (this.aiBrain.hasSuperArmor) {
        this.matchState.fighters[1].superArmorActive = this.aiBrain.hasSuperArmor();
      }
      if (this.aiBrain.getTelegraphOverrides) {
        this.matchState.fighters[1].telegraphOverrides = this.aiBrain.getTelegraphOverrides();
      }
      
      // Apply loadout override from phase system
      if (this.aiBrain.getLoadoutOverride) {
        const loadoutOverride = this.aiBrain.getLoadoutOverride();
        if (loadoutOverride && this.matchState.fighters[1].loadout !== loadoutOverride) {
          console.log(`[GameLoop] AI loadout change: ${this.matchState.fighters[1].loadout} → ${loadoutOverride}`);
          this.matchState.fighters[1].loadout = loadoutOverride;
          // Also update initial loadouts for reset
          this.initialLoadouts[1] = loadoutOverride;
        }
      }
      
      // Proximity-based rage burst check (AI boss only)
      // NOTE: This runs AFTER step, so changes to fighter state persist
      if (this.aiBrain.getRageBurstConfig) {
        const rageBurstConfig = this.aiBrain.getRageBurstConfig();
        if (rageBurstConfig) {
          const [f0, f1] = this.matchState.fighters;
          const distance = Math.abs(f0.x - f1.x);
          const rageBurstEvent = checkProximityRageBurst(
            f1,  // boss (mutated directly on new state)
            f0,  // player
            distance,
            this.matchState.tick,
            rageBurstConfig
          );
          if (rageBurstEvent) {
            this.lastEvents.push(rageBurstEvent);
            console.log(`[RageBurst] Cooldown set to tick ${f1.rageBurstCooldownTick}`);
          }
        }
      }
      
      // Check for phase change events
      if (this.aiBrain.consumePhaseChange) {
        const phaseChange = this.aiBrain.consumePhaseChange();
        if (phaseChange) {
          this.lastEvents.push({
            type: 'phaseChange',
            fighter: 1,  // AI is always fighter 1
            phaseName: phaseChange.phaseName,
            hpPercent: phaseChange.hpPercent,
          });
        }
      }
    }

    // Bone-driven hit detection (if SpineRenderer available)
    if (this.spineRenderer) {
      this.performHitDetection();
    }

    // Check win condition FIRST (adds fightWon/gameOver events to lastEvents)
    this.checkWinCondition();

    // Process events (including win/death events)
    this.soundAdapter.handleEvents(this.lastEvents);
    this.spineAdapter.handleEvents(this.lastEvents, this.skeletons);

    // Notify callback (for UI updates) - use lastEvents which includes all events
    if (this.onTickCallback) {
      this.onTickCallback(this.matchState, this.lastEvents);
    }
  }

  /**
   * Render (variable framerate)
   */
  private render(): void {
    // Apply state to adapters
    this.spineAdapter.applySnapshot(this.matchState, this.skeletons);
  }

  /**
   * Checks for match end condition
   */
  private checkWinCondition(): void {
    // Don't emit multiple win events
    if (this.paused) return;
    
    const [f0, f1] = this.matchState.fighters;

    // Check for death by health <= 0 (more reliable than state check)
    if (f0.health <= 0) {
      console.log('🎉 Fighter 1 (AI) WINS! Player health:', f0.health);
      // Set dead state for animation
      f0.state = 'dead';
      // Emit match end events
      this.lastEvents.push({ type: 'gameOver', loser: 0 });
      this.lastEvents.push({ type: 'fightWon', winner: 1 });
      this.setPaused(true);  // Pause the game
    } else if (f1.health <= 0) {
      console.log('🎉 Fighter 0 (Player) WINS! Boss health:', f1.health);
      // Set dead state for animation
      f1.state = 'dead';
      // Emit match end events
      this.lastEvents.push({ type: 'gameOver', loser: 1 });
      this.lastEvents.push({ type: 'fightWon', winner: 0 });
      this.setPaused(true);  // Pause the game
    }
  }

  /**
   * Bone-driven hit detection with death and stun checks
   */
  private performHitDetection(): void {
    const bones0 = this.spineRenderer.sampleBones(0, this.matchState.tick);
    const bones1 = this.spineRenderer.sampleBones(1, this.matchState.tick);
    const [f0, f1] = this.matchState.fighters;

    // Fighter 0 attacks Fighter 1
    const hit0 = checkBoneHit(f0, f1, bones0, bones1, this.matchState.tick);
    if (hit0) {
      this.lastEvents.push(hit0);
      
      // Check for pressure stun
      if (f1.pressureStunTicks > 0) {
        this.lastEvents.push({ type: 'stun', fighter: 1, cause: 'pressure' });
      }
      
      // Check for death
      if (f1.health <= 0) {
        // Death transition handled by core, just emit event
        this.lastEvents.push({ type: 'death', fighter: 1 });
      }
    }

    // Fighter 1 attacks Fighter 0
    const hit1 = checkBoneHit(f1, f0, bones1, bones0, this.matchState.tick);
    if (hit1) {
      this.lastEvents.push(hit1);
      
      // Check for pressure stun
      if (f0.pressureStunTicks > 0) {
        this.lastEvents.push({ type: 'stun', fighter: 0, cause: 'pressure' });
      }
      
      // Check for death
      if (f0.health <= 0) {
        this.lastEvents.push({ type: 'death', fighter: 0 });
      }
    }
  }

  /**
   * Updates FPS counter
   */
  private updateFPS(timestamp: number): void {
    this.fpsCounter.frames++;
    
    if (timestamp - this.fpsCounter.lastTime >= 1000) {
      this.fpsCounter.fps = this.fpsCounter.frames;
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastTime = timestamp;
    }
  }

  /**
   * Gets current FPS
   */
  getFPS(): number {
    return this.fpsCounter.fps;
  }

  /**
   * Gets current tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Gets paused state
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Gets time scale
   */
  getTimeScale(): number {
    return this.timeScale;
  }
}
