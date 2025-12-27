import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameLoop } from '../../game/game-loop';
import type { MatchState, GameEvent, Loadout, FighterState } from '../../core/types';
import { SpineRenderer, type SpineStatus } from '../../adapters/spine-renderer';
import { TrainingPauseMenuComponent } from '../../shared/components/training-pause-menu/training-pause-menu.component';
import { PlayerHealthbarComponent } from '../../shared/components/player-healthbar/player-healthbar.component';
import { AiHealthbarComponent } from '../../shared/components/ai-healthbar/ai-healthbar.component';
import { AISelectionService, type AIOption } from '../../ai/ai-selection.service';
import { initializeAISelection } from '../../ai/init';
import { getAudioPlayer, initializeAudio } from '../../adapters/audio';

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [CommonModule, TrainingPauseMenuComponent, PlayerHealthbarComponent, AiHealthbarComponent],
  templateUrl: './training.component.html',
  styleUrl: './training.component.css'
})
export class TrainingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: false }) canvasRef!: ElementRef<HTMLDivElement>;
  
  private gameLoop?: GameLoop;
  private spineRenderer?: SpineRenderer;
  private lastFrameTime: number = 0;
  private readonly aiService = inject(AISelectionService);
  
  // Reactive state
  tickCount = signal(0);
  fps = signal(60);
  paused = signal(true);  // Start paused
  showPauseMenu = signal(true);  // Show pause menu on entry
  timeScale = signal(1.0);
  aiEnabled = signal(false);
  loadout0 = signal<Loadout>('bare');
  loadout1 = signal<Loadout>('bare');
  spineStatus = signal<SpineStatus>('loading');
  showDebugRanges = signal(false);
  showAllHitboxes = signal(false);
  showEventLog = signal(false);  // Event log overlay visibility
  currentBackground = signal<'city1' | 'city2' | 'city3' | 'city4' | 'forrest' | 'castle' | 'destroyedCity'>('city1');  // Current stage background
  // AI Selection
  availableAIs = computed(() => this.aiService.availableAIs());
  selectedAIId = computed(() => this.aiService.selectedAIId());
  playerCharacter = computed(() => 'Du');
  aiCharacter = computed(() => {
    const selectedId = this.selectedAIId();
    const available = this.availableAIs();
    const selected = available.find(ai => ai.id === selectedId);
    return selected?.name ?? 'No AI';
  });
  playerLoadoutType = computed(() => this.loadout0());
  aiLoadoutType = computed(() => this.loadout1());
  debug = computed(() => this.showDebugRanges() || this.showAllHitboxes());
  
  // Match state
  private matchState = signal<MatchState | null>(null);
  fighter0 = computed(() => this.matchState()?.fighters[0] ?? this.createEmptyFighter());
  fighter1 = computed(() => this.matchState()?.fighters[1] ?? this.createEmptyFighter());
  
  parryWindowActive = computed(() => {
    const fighter = this.fighter0();
    return fighter.isParryWindowActive;
  });
  
  // Victory condition
  fighter1Dead = computed(() => this.fighter1().state === 'dead');
  
  // Event log with UI metadata (snapshotHP for accurate logging)
  private eventsArray: Array<GameEvent & { id: number; tick: number; snapshotHP?: number }> = [];
  eventLog = signal<Array<GameEvent & { id: number; tick: number; snapshotHP?: number }>>([]);
  events = computed(() => this.eventLog());  // Alias for template
  private eventIdCounter = 0;

  // FPS update interval
  private fpsInterval?: ReturnType<typeof setInterval>;

  constructor(private router: Router) {
    // Initialize AI selection service with all profiles
    initializeAISelection(this.aiService);
  }

  /**
   * ESC key handler - Toggle pause menu
   */
  @HostListener('window:keydown.escape', ['$event'])
  handleEscape(event: Event): void {
    event.preventDefault();
    this.togglePauseMenu();
  }

  ngOnInit(): void {
    console.log('[TrainingComponent] Initializing...');
    // Game loop will be started after Spine initialization in ngAfterViewInit
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.canvasRef?.nativeElement) {
      console.error('[TrainingComponent] Canvas container element not found!');
      this.spineStatus.set('error');
      return;
    }

    console.log('[TrainingComponent] Initializing Spine renderer...');
    this.spineStatus.set('loading');
    
    // Create canvas element and append to container
    const canvas = document.createElement('canvas');
    const container = this.canvasRef.nativeElement;
    
    // Set initial canvas size based on container
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(container.clientWidth * dpr);
    canvas.height = Math.floor(container.clientHeight * dpr);
    
    // CSS size fills container
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    
    container.appendChild(canvas);
    
    this.spineRenderer = new SpineRenderer(canvas);
    
    try {
      await this.spineRenderer.initialize();
      this.spineStatus.set('ready');
      console.log('[TrainingComponent] Spine ready, starting game loop...');
      
      // Start game loop only when Spine is ready
      this.startGameLoop();
      this.startRenderLoop();
      
      // Start paused with menu visible
      this.gameLoop?.setPaused(true);
      this.paused.set(true);
      this.showPauseMenu.set(true);
      
    } catch (error) {
      console.error('[TrainingComponent] Spine initialization failed:', error);
      this.spineStatus.set('error');
    }
  }

  ngOnDestroy(): void {
    console.log('[TrainingComponent] Destroying...');
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
    }
    // Stop fight music when leaving
    const audio = getAudioPlayer();
    audio.stopMusic(true);
    
    this.spineRenderer?.dispose();
    this.gameLoop?.dispose();
  }

  // ============================================================================
  // GAME LOOP INITIALIZATION
  // ============================================================================

  private startGameLoop(): void {
    const skeletons = this.spineRenderer?.getSkeletons() ?? [];
    
    this.gameLoop = new GameLoop({
      loadouts: [this.loadout0(), this.loadout1()],
      enableDebugLogging: true,
      aiEnabled: this.aiEnabled(),
      skeletons: skeletons,  // Pass real skeletons to GameLoop
      spineRenderer: this.spineRenderer,  // Pass SpineRenderer for bone sampling
    });

    // Subscribe to tick updates
    this.gameLoop.onTick((state, events) => {
      this.matchState.set(state);
      
      // Apply state to Spine visualization
      this.spineRenderer?.applySnapshot(state);
      
      // Handle all events (including hit/block/parry from bone combat)
      this.spineRenderer?.handleEvents(events);
      
      // Check for player death - open pause menu
      for (const event of events) {
        if (event.type === 'death') {
          // Either fighter died - pause and show menu
          this.gameLoop?.setPaused(true);
          this.paused.set(true);
          this.showPauseMenu.set(true);
        }
      }
      
      // Add events to log with current tick (filter out noise)
      for (const event of events) {
        // Skip stateChange and attackStart events (too noisy)
        if (event.type === 'stateChange' || event.type === 'attackStart') {
          continue;
        }
        
        // Snapshot HP for combat events (after damage applied)
        let snapshotHP: number | undefined;
        if (event.type === 'hit' || event.type === 'block' || event.type === 'parry') {
          snapshotHP = state.fighters[event.defender].health;
        } else if (event.type === 'stun') {
          snapshotHP = state.fighters[event.fighter].health;
        }
        
        this.eventsArray.unshift({ 
          ...event, 
          id: this.eventIdCounter++, 
          tick: state.tick,
          snapshotHP  // Attach HP at event time
        });
      }
      
      // Keep only last 50 events
      if (this.eventsArray.length > 50) {
        this.eventsArray = this.eventsArray.slice(0, 50);
      }
      
      this.eventLog.set([...this.eventsArray]);
    });

    // Update tick count periodically
    this.fpsInterval = setInterval(() => {
      this.tickCount.set(this.gameLoop!.getTickCount());
      this.fps.set(this.gameLoop!.getFPS());
      this.paused.set(this.gameLoop!.isPaused());
      this.timeScale.set(this.gameLoop!.getTimeScale());
    }, 100);

    // Start game loop
    this.gameLoop.start();
  }

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

  // ============================================================================
  // CONTROL METHODS
  // ============================================================================

  /**
   * Toggle pause menu (ESC handler)
   */
  togglePauseMenu(): void {
    const newPauseState = !this.paused();
    this.gameLoop?.setPaused(newPauseState);
    this.paused.set(newPauseState);
    this.showPauseMenu.set(newPauseState);
  }

  /**
   * Resume from pause menu
   */
  async resumeTraining(): Promise<void> {
    // Initialize audio if not already done (requires user interaction)
    await initializeAudio();
    
    // Start fight music
    const audio = getAudioPlayer();
    await audio.playMusic('fight');
    
    this.gameLoop?.setPaused(false);
    this.paused.set(false);
    this.showPauseMenu.set(false);
  }

  togglePause(): void {
    this.gameLoop?.togglePause();
  }

  resetMatch(): void {
    this.gameLoop?.resetMatch();
    this.eventsArray = [];
    this.eventLog.set([]);
    this.eventIdCounter = 0;
  }

  setTimeScale(scale: number): void {
    this.gameLoop?.setTimeScale(scale);
  }

  cycleTimeScale(): void {
    const current = this.timeScale();
    const scales = [0.25, 0.5, 1.0, 2.0];
    const currentIndex = scales.indexOf(current);
    const nextScale = scales[(currentIndex + 1) % scales.length];
    this.setTimeScale(nextScale);
  }

  toggleAI(): void {
    const newState = !this.aiEnabled();
    this.aiEnabled.set(newState);
    this.gameLoop?.setAIEnabled(newState);
  }

  setLoadout(fighterId: 0 | 1, loadout: Loadout): void {
    if (fighterId === 0) {
      this.loadout0.set(loadout);
    } else {
      this.loadout1.set(loadout);
    }
    this.gameLoop?.setLoadout(fighterId, loadout);
  }

  goToMenu(): void {
    this.router.navigate(['/menu']);
  }

  toggleDebugRanges(): void {
    this.showDebugRanges.set(!this.showDebugRanges());
    this.spineRenderer?.setShowDebugRanges(this.showDebugRanges());
  }

  toggleAllHitboxes(): void {
    this.showAllHitboxes.set(!this.showAllHitboxes());
    this.spineRenderer?.setShowAllHitboxes(this.showAllHitboxes());
  }

  toggleDebug(): void {
    const isDebugActive = this.showDebugRanges() || this.showAllHitboxes();
    const newState = !isDebugActive;
    
    this.showDebugRanges.set(newState);
    this.showAllHitboxes.set(newState);
    this.spineRenderer?.setShowDebugRanges(newState);
    this.spineRenderer?.setShowAllHitboxes(newState);
  }

  toggleEventLog(): void {
    this.showEventLog.set(!this.showEventLog());
  }

  // Handlers for pause menu outputs
  onToggleDebug(): void {
    this.toggleDebug();
  }

  onToggleAI(): void {
    this.toggleAI();
  }

  onSetPlayerLoadout(loadout: Loadout): void {
    this.setLoadout(0, loadout);
  }

  onSetAILoadout(loadout: Loadout): void {
    this.setLoadout(1, loadout);
  }

  onCycleTimeScale(): void {
    this.cycleTimeScale();
  }

  onExit(): void {
    this.goToMenu();
  }

  onSetBackground(backgroundId: 'city1' | 'city2' | 'city3' | 'city4' | 'forrest' | 'castle' | 'destroyedCity'): void {
    this.currentBackground.set(backgroundId);
    this.spineRenderer?.setBackground(backgroundId);
  }

  /**
   * Handle AI selection from pause menu
   */
  async onSelectAI(aiId: string): Promise<void> {
    this.aiService.selectAI(aiId);
    
    // Get the selected AI option to determine character
    const selectedAI = this.availableAIs().find(ai => ai.id === aiId);
    if (!selectedAI) {
      console.warn(`[Training] AI not found: ${aiId}`);
      return;
    }

    // Create new brain and hot-swap
    const newBrain = this.aiService.createBrainById(aiId, { debug: true });
    if (newBrain && this.gameLoop) {
      this.gameLoop.setAIBrain(newBrain);
      
      // Switch character for Fighter 1 (AI) if different from current
      const characterId = selectedAI.forCharacter;
      if (characterId && characterId !== 'any') {
        console.log(`[Training] Switching AI character to: ${characterId}`);
        await this.gameLoop.setCharacter(1, characterId);
        
        // Reset match to apply character change properly
        this.resetMatch();
      }
      
      console.log(`[Training] Switched to AI: ${aiId} (character: ${characterId})`);
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private createEmptyFighter() {
    return {
      id: 0 as 0 | 1,
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
      health: 1000,
      maxHealth: 1000,
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
      lastBlockPressTick: -1,
      isParryWindowActive: false,
      attackLandedHit: false,
      lastHitTick: -1,
      proximityTicks: 0,
      rageBurstCooldownTick: 0,
      speedMultiplier: 1.0,
      superArmorActive: false,
    };
  }

  formatEventDetails(event: GameEvent & { tick: number; snapshotHP?: number }): string {
    // Use snapshot HP if available (taken at event time, after damage)
    const getHP = (fighterId: 0 | 1) => {
      if (event.type === 'hit' || event.type === 'block' || event.type === 'parry') {
        return event.snapshotHP ?? '?';
      }
      return this.matchState()?.fighters[fighterId]?.health ?? '?';
    };
    
    switch (event.type) {
      case 'hit': {
        const defenderHP = getHP(event.defender);
        return `F${event.attacker} → F${event.defender} | ${event.damage}dmg | HP: ${defenderHP} | ${event.attack}`;
      }
      case 'block': {
        const defenderHP = getHP(event.defender);
        return `F${event.defender} blocked ${event.zone} | ${event.damage}dmg | HP: ${defenderHP} | ${event.perfect ? 'PERFECT' : 'partial'}`;
      }
      case 'parry': {
        const defenderHP = getHP(event.defender);
        return `F${event.defender} 🛡️ PARRY SUCCESS | HP: ${defenderHP} | ${event.attack} | ${event.damage}dmg blocked`;
      }
      case 'stun':
        return `F${event.fighter} 😵‍💫 PRESSURE STUNNED | ${event.cause} stun for 60 ticks`;
      case 'whiff':
        return `F${event.attacker} whiffed | ${event.attack}`;
      case 'telegraph':
        return `F${event.fighter} telegraphs | ${event.attack}`;
      case 'death':
        return `F${event.fighter} ☠️ DEFEATED`;
      default:
        return '';
    }
  }

  getStateClass(state: FighterState): string {
    const stateColors: Record<FighterState, string> = {
      idle: 'text-blue-400 font-bold',
      move: 'text-green-400 font-bold',
      jump: 'text-yellow-400 font-bold',
      attack: 'text-orange-400 font-bold',
      telegraph: 'text-orange-500 font-bold',
      block: 'text-cyan-400 font-bold',
      hurt: 'text-red-400 font-bold',
      dead: 'text-slate-500 font-bold'
    };
    return stateColors[state] || 'text-white';
  }

  getEventClass(type: string): string {
    const eventClasses: Record<string, string> = {
      hit: 'border-red-500 bg-red-500/5',
      block: 'border-cyan-500 bg-cyan-500/5',
      parry: 'border-green-500 bg-green-500/10',  // Highlight parry success
      stun: 'border-red-600 bg-red-600/10',  // Bright red for stun events
      whiff: 'border-purple-500 bg-purple-500/5',
      telegraph: 'border-orange-500 bg-orange-500/5',
      death: 'border-slate-500 bg-slate-500/5',
      stateChange: 'border-slate-600 bg-slate-600/5',
      jump: 'border-yellow-500 bg-yellow-500/5',
      land: 'border-green-500 bg-green-500/5'
    };
    return eventClasses[type] || 'border-slate-600 bg-slate-600/5';
  }
}
