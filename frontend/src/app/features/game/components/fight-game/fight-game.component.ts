// ============================================
// Fight Game Component - Main Game Container
// ============================================

import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

// Shared Components
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

// Feature Components
import { ConnectionStatusComponent } from '../connection-status/connection-status.component';
import { HudComponent } from '../hud/hud.component';
import { LoadoutSelectorComponent } from '../loadout-selector/loadout-selector.component';
import { MatchResultComponent } from '../match-result/match-result.component';
import { ControlsInfoComponent } from '../controls-info/controls-info.component';

// Services
import { NetworkService } from '../../services/network.service';
import { MatchService } from '../../services/match.service';

// Types
import { Loadout } from '../../models/game.types';
import { ConnectionState, PlayerInput, fromNetworkInput, toNetworkInput, LocalInput, NetworkLoadout } from '../../models/network.types';

// Engine
import { FightGame } from '../../engine/game-engine';
import { LocalInputState } from '../../engine/input-handler';
import { AIDifficulty } from '../../engine/fighter-ai';

@Component({
  selector: 'app-fight-game',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSpinnerComponent,
    ConnectionStatusComponent,
    HudComponent,
    LoadoutSelectorComponent,
    MatchResultComponent,
    ControlsInfoComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fight-game.component.html',
  styleUrl: './fight-game.component.css'
})
export class FightGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  // Services
  readonly network = inject(NetworkService);
  readonly match = inject(MatchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  
  // Game Engine
  private game!: FightGame;
  private frameNumber = 0;
  
  // Game Mode (local = single player vs AI, online = network multiplayer)
  readonly gameMode = signal<'local' | 'online'>('online');
  readonly isLocalMode = computed(() => this.gameMode() === 'local');
  
  // AI Difficulty (for single player mode)
  readonly aiDifficulty = signal<'easy' | 'medium' | 'hard'>('medium');
  
  // AI Loadout (for single player mode)
  readonly aiLoadout = signal<Loadout>('sword');
  
  // AI Telegraph indicator (shows what attack is incoming)
  readonly aiTelegraph = signal<'light' | 'heavy' | 'special' | null>(null);
  readonly aiTelegraphPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Player "BLOCK!" indicator (shows perfect block timing)
  readonly showBlockIndicator = signal(false);
  readonly blockIndicatorPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // UI State
  readonly isLoading = signal(true);
  readonly matchEnded = signal(false);
  readonly isWinner = signal(false);
  
  // Computed
  readonly connectionState = computed(() => this.network.connectionState());
  readonly hasOpponent = computed(() => this.isLocalMode() || this.network.isInMatch());
  readonly isPlayer1 = computed(() => this.network.playerNumber() === 1);
  
  async ngAfterViewInit(): Promise<void> {
    // Read game mode from route parameter
    const mode = this.route.snapshot.paramMap.get('mode');
    this.gameMode.set(mode === 'local' ? 'local' : 'online');
    
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 1. Game initialisieren
    await this.initializeGame();
    
    // 2. Netzwerk setup nur im Online-Modus
    if (!this.isLocalMode()) {
      this.match.initialize();
      this.setupNetworkCallbacks();
      await this.connectToServer();
    }
    
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }
  
  private onKeyDown(event: KeyboardEvent): void {
    // F3 toggles debug mode
    if (event.key === 'F3') {
      event.preventDefault();
      this.game?.toggleDebug();
    }
  }
  
  private async initializeGame(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;
    
    if (this.isLocalMode()) {
      // ============================================
      // LOCAL MODE - Single Player vs AI
      // ============================================
      this.game = new FightGame({
        canvas,
        player1Loadout: 'bare',
        player2Loadout: 'sword', // AI starts with sword for variety
        mode: 'local',
        myPlayerNumber: 1,
        aiDifficulty: this.aiDifficulty(),
        onHealthChange: (player, health, maxHealth) => {
          const healthPercent = Math.round((health / maxHealth) * 100);
          if (player === 1) {
            this.match.player1Health.set(healthPercent);
          } else {
            this.match.player2Health.set(healthPercent);
          }
        },
        onStunMeterChange: (player, stunMeter) => {
          // Only player 2 (AI) has stun meter
          if (player === 2) {
            this.match.player2StunMeter.set(stunMeter);
          }
        },
        onSpecialMeterChange: (specialMeter) => {
          // Player 1 special meter
          this.match.player1SpecialMeter.set(specialMeter);
        },
        onStunStart: (player) => {
          // Only AI can be stunned
          if (player === 2) {
            this.match.player2Stunned.set(true);
          }
        },
        onStunEnd: (player) => {
          // Only AI can be stunned
          if (player === 2) {
            this.match.player2Stunned.set(false);
          }
        },
        onKO: (loser) => {
          this.isWinner.set(loser === 2); // We win if player 2 loses
          this.matchEnded.set(true);
        },
        onAITelegraph: (attackType, totalTimeMs) => {
          // Get AI position and convert to screen coordinates
          const aiPos = this.game.getPlayer2().getPosition();
          const screenPos = this.worldToScreen(aiPos.x, aiPos.y + 350); // Above head
          this.aiTelegraphPosition.set(screenPos);
          
          // Calculate player position for block indicator (only for heavy attacks)
          if (attackType === 'heavy') {
            const playerPos = this.game.getPlayer1().getPosition();
            const playerScreenPos = this.worldToScreen(playerPos.x, playerPos.y + 350);
            this.blockIndicatorPosition.set(playerScreenPos);
          }
          
          // Show telegraph indicator
          this.aiTelegraph.set(attackType);
          
          // Perfect block window is 300ms (from combat-system.ts PERFECT_BLOCK_WINDOW_MS)
          // Show BLOCK! indicator when the perfect block window STARTS
          const perfectBlockWindow = 300;
          const blockIndicatorDelay = Math.max(0, totalTimeMs - perfectBlockWindow);
          
          // Show "BLOCK!" indicator only for heavy attacks at the right moment
          if (attackType === 'heavy') {
            setTimeout(() => {
              if (this.aiTelegraph()) {
                this.showBlockIndicator.set(true);
              }
            }, blockIndicatorDelay);
          }
          
          // Clear indicators after telegraph time
          setTimeout(() => {
            this.aiTelegraph.set(null);
            this.showBlockIndicator.set(false);
          }, totalTimeMs);
        }
      });
      
      try {
        await this.game.initialize();
        this.isLoading.set(false);
        // Beide Spieler sofort sichtbar im Local Mode
        this.game.setPlayer2Visible(true);
        console.log(`[FightGame] Single Player mode initialized - AI difficulty: ${this.aiDifficulty()}`);
      } catch (error) {
        console.error('[FightGame] Single Player init failed:', error);
      }
    } else {
      // ============================================
      // ONLINE MODE - Netzwerk Multiplayer
      // ============================================
      this.game = new FightGame({
        canvas,
        player1Loadout: this.match.myLoadout(),
        player2Loadout: 'bare',
        mode: 'online',
        myPlayerNumber: 1, // Default, wird bei MatchFound aktualisiert
        onInput: (input) => this.sendInputToServer(input)
      });
      
      try {
        await this.game.initialize();
        this.isLoading.set(false);
        
        // Hide player 2 until opponent joins
        this.game.setPlayer2Visible(false);
        
      } catch (error) {
        console.error('[FightGame] Online mode init failed:', error);
      }
    }
  }
  
  private sendInputToServer(input: LocalInputState): void {
    // Sende nur wenn verbunden (auch in Queue)
    if (!this.network.isConnected()) return;
    
    // Konvertiere zu kompaktem Netzwerk-Format
    const networkInput = toNetworkInput({
      moveDir: input.moveDir,
      jump: input.jump,
      attack: input.attack,
      block: input.block,
      run: input.run
    });
    
    this.network.sendInput(networkInput);
  }
  
  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    this.game?.dispose();
    if (!this.isLocalMode()) {
      this.network.disconnect();
    }
  }
  
  // ============================================
  // Navigation
  // ============================================
  
  goToMenu(): void {
    this.router.navigate(['/']);
  }
  
  // ============================================
  // Connection (Online Mode only)
  // ============================================
  
  private async connectToServer(): Promise<void> {
    try {
      await this.network.connect();
      await this.network.joinMatchmaking(this.match.playerName());
    } catch (error) {
      console.error('[FightGame] Connection failed:', error);
    }
  }
  
  async retryConnection(): Promise<void> {
    await this.connectToServer();
  }
  
  async playAgain(): Promise<void> {
    this.matchEnded.set(false);
    this.isWinner.set(false);
    this.match.resetMatch();
    
    if (this.isLocalMode()) {
      // Local Mode: Full reset including positions and visibility
      this.game.resetMatch();
      this.game.setPlayer1Visible(true);
      this.game.setPlayer2Visible(true);
      console.log('[FightGame] Local Mode - Match reset');
    } else {
      // Online Mode: Hide player 2 and rejoin matchmaking
      this.game.setPlayer2Visible(false);
      await this.network.joinMatchmaking(this.match.playerName());
    }
  }
  
  // ============================================
  // Network Callbacks
  // ============================================
  
  private setupNetworkCallbacks(): void {
    this.network.onMatchFound = (info) => {
      console.log('[FightGame] Match found! Player:', info.playerNumber, 'vs', info.opponentName);
      this.match.opponentName.set(info.opponentName);
      
      // Setze welchen Charakter wir steuern (falls Server uns als P2 zuweist)
      this.game.setMyPlayerNumber(info.playerNumber);
      
      // Zeige Gegner-Charakter
      this.game.setPlayer2Visible(true);
      this.network.playerReady();
    };
    
    this.network.onFightStart = () => {
      this.frameNumber = 0;
      console.log('[FightGame] Fight started!');
    };
    
    this.network.onOpponentInput = (input) => {
      this.applyOpponentInput(input);
    };
    
    this.network.onOpponentDisconnected = () => {
      console.log('[FightGame] Opponent disconnected');
      this.match.opponentName.set('');
      this.game?.setPlayer2Visible(false);
      this.network.joinMatchmaking(this.match.playerName());
    };
    
    this.network.onMatchEnded = (winner) => {
      this.isWinner.set(winner === this.network.playerNumber());
      this.matchEnded.set(true);
    };
    
    this.network.onOpponentLoadoutChanged = (loadout) => {
      this.applyOpponentLoadout(loadout);
    };
  }
  
  private applyOpponentInput(input: PlayerInput): void {
    const opponent = this.isPlayer1() 
      ? this.game?.getPlayer2() 
      : this.game?.getPlayer1();
    
    if (!opponent) return;
    
    // Konvertiere Netzwerk-Input zu lokalem Format
    const local = fromNetworkInput(input);
    
    // Nutze die neue applyRemoteInput Methode für korrektes Animation-Cancelling
    opponent.applyRemoteInput(local);
  }
  
  // ============================================
  // Loadout
  // ============================================
  
  onLoadoutChange(loadout: Loadout): void {
    this.match.myLoadout.set(loadout);
    const myFighter = this.isPlayer1() 
      ? this.game?.getPlayer1() 
      : this.game?.getPlayer2();
    myFighter?.setLoadout(loadout);
    
    // Send loadout change to opponent (online mode only)
    if (!this.isLocalMode()) {
      this.network.sendLoadout(this.loadoutToNetwork(loadout));
    }
  }
  
  // Local mode loadout changes
  onPlayer1LoadoutChange(loadout: Loadout): void {
    this.match.myLoadout.set(loadout);
    this.game?.getPlayer1()?.setLoadout(loadout);
  }
  
  onPlayer2LoadoutChange(loadout: Loadout): void {
    this.match.opponentLoadout.set(loadout);
    this.game?.getPlayer2()?.setLoadout(loadout);
  }
  
  // AI Loadout change (single player mode)
  onAiLoadoutChange(loadout: Loadout): void {
    this.aiLoadout.set(loadout);
    this.match.opponentLoadout.set(loadout);
    this.game?.getPlayer2()?.setLoadout(loadout);
  }
  
  // AI Difficulty change (single player mode)
  onAIDifficultyChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const difficulty = select.value as AIDifficulty;
    this.aiDifficulty.set(difficulty);
    this.game?.setAIDifficulty(difficulty);
  }
  
  private applyOpponentLoadout(networkLoadout: NetworkLoadout): void {
    const opponent = this.isPlayer1() 
      ? this.game?.getPlayer2() 
      : this.game?.getPlayer1();
    
    if (!opponent) return;
    
    const loadout = this.networkToLoadout(networkLoadout);
    this.match.opponentLoadout.set(loadout);
    opponent.setLoadout(loadout);
  }
  
  private loadoutToNetwork(loadout: Loadout): NetworkLoadout {
    switch (loadout) {
      case 'bare': return NetworkLoadout.Bare;
      case 'sword': return NetworkLoadout.Sword;
      default: return NetworkLoadout.Bare;
    }
  }
  
  private networkToLoadout(networkLoadout: NetworkLoadout): Loadout {
    switch (networkLoadout) {
      case NetworkLoadout.Bare: return 'bare';
      case NetworkLoadout.Sword: return 'sword';
      default: return 'bare';
    }
  }
  
  private onResize(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  /**
   * Convert world coordinates (design space 1920x1080) to screen pixels
   */
  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const DESIGN_WIDTH = 1920;
    const DESIGN_HEIGHT = 1080;
    
    // Calculate scale to fit design in canvas
    const scaleX = canvas.width / DESIGN_WIDTH;
    const scaleY = canvas.height / DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate offset for letterboxing
    const scaledWidth = DESIGN_WIDTH * scale;
    const scaledHeight = DESIGN_HEIGHT * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;
    
    // Convert world position to screen position
    // Note: Spine Y is flipped (0 at bottom), so we flip it
    const screenX = worldX * scale + offsetX;
    const screenY = canvas.height - (worldY * scale + offsetY);
    
    return { x: screenX, y: screenY };
  }
}
