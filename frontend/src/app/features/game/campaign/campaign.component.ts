// ============================================
// Campaign Component - Main Campaign Mode (Endless)
// ============================================

import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CampaignService } from './campaign.service';
import { StoryIntroComponent } from './story-intro.component';
import { BonusSelectionComponent } from './bonus-selection.component';
import { ScoreSubmitComponent } from './score-submit.component';
import { LeaderboardComponent } from './leaderboard.component';
import { type Bonus } from './campaign-types';
import { getCampaignLevel } from './campaign-levels';
import { FightGame, GameConfig } from '../engine/game-engine';
import { CITY1_PARALLAX, CITY2_PARALLAX, CITY3_PARALLAX, CITY4_PARALLAX, ParallaxConfig } from '../engine/spine-manager';

type CampaignPhase = 'preview' | 'story' | 'fighting' | 'bonus' | 'defeat' | 'score-submit' | 'leaderboard';

const BACKGROUND_MAP: Record<string, ParallaxConfig> = {
  'CITY1': CITY1_PARALLAX,
  'CITY2': CITY2_PARALLAX,
  'CITY3': CITY3_PARALLAX,
  'CITY4': CITY4_PARALLAX,
};

@Component({
  selector: 'app-campaign',
  standalone: true,
  imports: [CommonModule, StoryIntroComponent, BonusSelectionComponent, ScoreSubmitComponent, LeaderboardComponent],
  templateUrl: './campaign.component.html',
  styleUrl: './campaign.component.css'
})
export class CampaignComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private router = inject(Router);
  campaign = inject(CampaignService);
  
  // Phase management
  phase = signal<CampaignPhase>('preview');
  
  // Current level config (always returns a valid level in endless mode)
  currentLevel = computed(() => getCampaignLevel(this.campaign.currentLevel()));
  
  // Bonus selection state
  bonusOptions = signal<Bonus[]>([]);
  
  // Game state
  private game: FightGame | null = null;
  playerHealth = signal(100);
  playerMaxHealth = signal(100);
  enemyHealth = signal(100);
  enemyMaxHealth = signal(100);
  playerStun = signal(0);
  enemyStun = signal(0);
  specialMeter = signal(0);
  
  // Track player health between levels (for health carry-over)
  private carryOverHealth: number | null = null;
  
  // Track the level where player was defeated (before reset)
  defeatLevel = signal(1);
  
  // Track enemy health at defeat for score calculation
  defeatEnemyHealthPercent = signal(100);
  
  // Track submitted score rank for leaderboard highlight
  submittedRank = signal(0);
  
  // AI Telegraph indicator (shows what attack is incoming)
  aiTelegraph = signal<'light' | 'heavy' | 'special' | null>(null);
  aiTelegraphPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Player "BLOCK!" indicator (shows perfect block timing)
  showBlockIndicator = signal(false);
  blockIndicatorPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  
  ngOnInit(): void {
    // Check if there's an active campaign to resume
    if (this.campaign.isActive()) {
      this.phase.set('preview');
    }
  }
  
  ngAfterViewInit(): void {
    // Canvas is available after view init
  }
  
  ngOnDestroy(): void {
    this.destroyGame();
  }
  
  // ----------------------------------------
  // Flow Control
  // ----------------------------------------
  
  startCampaign(): void {
    if (!this.campaign.isActive()) {
      this.campaign.startCampaign();
    }
    this.phase.set('story');
  }
  
  restartCampaign(): void {
    this.carryOverHealth = null; // Reset health carry-over for new campaign
    this.campaign.startCampaign();
    this.phase.set('story');
  }
  
  onStoryContinue(): void {
    this.phase.set('fighting');
    // Small delay to ensure canvas is rendered
    setTimeout(() => this.initializeGame(), 100);
  }
  
  onBonusSelected(bonus: Bonus): void {
    this.campaign.selectBonus(bonus.id);
    this.advanceToNextLevel();
  }
  
  onBonusSkipped(): void {
    this.campaign.skipBonus();
    this.advanceToNextLevel();
  }
  
  private advanceToNextLevel(): void {
    // Endless mode - always continue to next level
    this.phase.set('story');
  }
  
  goBack(): void {
    this.campaign.exitCampaign();
    this.router.navigate(['/']);
  }
  
  // ----------------------------------------
  // Game Management
  // ----------------------------------------
  
  private async initializeGame(): Promise<void> {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }
    
    const level = this.currentLevel();
    if (!level) {
      console.error('Level config not found');
      return;
    }
    
    // Get bonus effects
    const effects = this.campaign.bonusEffects();
    
    // Calculate player max health with vitality bonus
    const basePlayerHealth = 100;
    const calculatedPlayerMaxHealth = Math.round(basePlayerHealth * effects.healthMultiplier);
    
    // Calculate starting health (carry-over from previous level or max)
    let startingHealth: number;
    if (this.carryOverHealth !== null) {
      // Heal +50 from previous level, but cap at max health
      startingHealth = Math.min(calculatedPlayerMaxHealth, this.carryOverHealth + 50);
      this.carryOverHealth = null; // Reset carry-over
    } else {
      // First level or new campaign: start with full health
      startingHealth = calculatedPlayerMaxHealth;
    }
    
    // Set initial health values
    this.playerMaxHealth.set(calculatedPlayerMaxHealth);
    this.playerHealth.set(startingHealth);
    this.enemyMaxHealth.set(level.aiHealth);
    this.enemyHealth.set(level.aiHealth);
    this.playerStun.set(0);
    this.enemyStun.set(0);
    this.specialMeter.set(0);
    
    // Get parallax config
    const parallaxConfig = BACKGROUND_MAP[level.background] ?? CITY1_PARALLAX;
    
    // Determine player loadout based on sword bonus
    const playerLoadout = effects.hasSword ? 'sword' : 'bare';
    
    // AI gets sword from level 4 onwards
    const currentLevelNum = this.campaign.currentLevel();
    const aiLoadout = currentLevelNum >= 4 ? 'sword' : 'bare';

    const config: GameConfig = {
      canvas,
      mode: 'local',
      aiDifficulty: level.aiDifficulty,
      parallaxConfig,
      player1Loadout: playerLoadout,
      player1MaxHealth: calculatedPlayerMaxHealth,
      player1StartingHealth: startingHealth,
      player2MaxHealth: level.aiHealth,
      player1BonusEffects: {
        speedMultiplier: effects.speedMultiplier,
        damageMultiplier: effects.damageMultiplier,
        jumpMultiplier: effects.jumpMultiplier,
        blockReduction: effects.blockReduction,
        vampirism: effects.vampirism,
        stunRateMultiplier: effects.stunRateMultiplier,
        specialChargeMultiplier: effects.specialChargeMultiplier,
        perfectBlockWindowBonus: effects.perfectBlockWindowBonus,
      },
      player2Loadout: aiLoadout,
      onHealthChange: (player, health, maxHealth) => {
        if (player === 1) {
          this.playerHealth.set(health);
        } else {
          this.enemyHealth.set(health);
        }
      },
      onStunMeterChange: (player, stun) => {
        if (player === 1) {
          this.playerStun.set(stun);
        } else {
          this.enemyStun.set(stun);
        }
      },
      onSpecialMeterChange: (meter) => {
        this.specialMeter.set(meter);
      },
      onKO: (loser) => {
        this.handleKO(loser);
      },
      onAITelegraph: (attackType, totalTimeMs) => {
        console.log('[Campaign] AI Telegraph:', attackType, 'totalTimeMs:', totalTimeMs);
        // Get AI position and convert to screen coordinates
        if (this.game) {
          const aiPos = this.game.getPlayer2().getPosition();
          const screenPos = this.worldToScreen(aiPos.x, aiPos.y + 550); // Higher above head
          this.aiTelegraphPosition.set(screenPos);
          
          // Calculate player position for block indicator (only for heavy attacks)
          if (attackType === 'heavy') {
            const playerPos = this.game.getPlayer1().getPosition();
            const playerScreenPos = this.worldToScreen(playerPos.x, playerPos.y + 550);
            this.blockIndicatorPosition.set(playerScreenPos);
          }
        }
        
        // Show telegraph indicator
        this.aiTelegraph.set(attackType);
        
        // Perfect block window is 300ms (from combat-system.ts PERFECT_BLOCK_WINDOW_MS)
        // Show BLOCK! indicator when the perfect block window STARTS
        // This gives player exactly the right timing
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
        
        // Clear indicators after telegraph completes
        setTimeout(() => {
          this.aiTelegraph.set(null);
          this.showBlockIndicator.set(false);
        }, totalTimeMs);
      }
    };
    
    this.game = new FightGame(config);
    
    await this.game.initialize();
  }
  
  private handleKO(loser: 1 | 2): void {
    // Delay to show KO animation
    setTimeout(() => {
      if (loser === 2) {
        // Player wins! Save current health for next level
        this.carryOverHealth = this.playerHealth();
      }
      
      this.destroyGame();
      
      if (loser === 2) {
        // Player wins!
        const options = this.campaign.onVictory();
        this.bonusOptions.set(options);
        this.phase.set('bonus');
      } else {
        // Player loses - save the level and enemy health before reset
        this.defeatLevel.set(this.campaign.currentLevel());
        // Calculate enemy health percent for score bonus
        const enemyHealthPercent = (this.enemyHealth() / this.enemyMaxHealth()) * 100;
        this.defeatEnemyHealthPercent.set(enemyHealthPercent);
        this.carryOverHealth = null;
        this.campaign.onDefeat();
        // Go to score submit instead of defeat screen
        this.phase.set('score-submit');
      }
    }, 1500);
  }
  
  private destroyGame(): void {
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
  }
  
  // ----------------------------------------
  // UI Helpers
  // ----------------------------------------
  
  getBonusClasses(bonus: Bonus): string {
    switch (bonus.rarity) {
      case 'common':
        return 'bg-gray-800 text-gray-300 border border-gray-600';
      case 'uncommon':
        return 'bg-blue-900/50 text-blue-300 border border-blue-500';
      case 'rare':
        return 'bg-yellow-900/50 text-yellow-300 border border-yellow-500';
    }
  }
  
  // ----------------------------------------
  // Leaderboard Flow
  // ----------------------------------------
  
  onScoreSubmitted(result: { playerName: string; rank: number; score: number }): void {
    this.submittedRank.set(result.rank);
    this.phase.set('leaderboard');
  }
  
  onScoreSkipped(): void {
    this.phase.set('defeat');
  }
  
  onLeaderboardClose(): void {
    this.phase.set('defeat');
  }
  
  // Convert world coordinates (design space 1920x1080) to screen pixels
  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    
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
