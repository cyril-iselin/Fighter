import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BuffHudComponent } from '../buff-hud/buff-hud.component';
import { ActiveBuff } from '../../endless-types';
import { LeaderboardService } from '../../../../services/leaderboard.service';

@Component({
  selector: 'app-game-over',
  standalone: true,
  imports: [CommonModule, FormsModule, BuffHudComponent],
  template: `
    <div class="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-8">
      <!-- Game Over Text -->
      <h1 class="text-6xl font-game text-red-500 mb-4 animate-pulse">
        GAME OVER
      </h1>
      
      <p class="text-2xl text-white/70 mb-8">
        Du wurdest in Level {{ level }} besiegt
      </p>
      
      <!-- Score Display -->
      <div class="text-center mb-8">
        <p class="text-white/50 text-lg mb-2">DEIN SCORE</p>
        <p class="text-5xl font-game text-neon-green animate-glow">
          {{ calculatedScore() }}
        </p>
      </div>
      
      <!-- Stats -->
      <div class="bg-white/5 rounded-xl p-6 mb-8 min-w-[350px]">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="text-white/50">Level erreicht:</div>
          <div class="text-right font-game text-white">{{ level }} <span class="text-white/30">× 1000 = {{ level * 1000 }}</span></div>
          
          <div class="text-white/50">Schaden verursacht:</div>
          <div class="text-right font-game text-white">{{ damage }} <span class="text-white/30">÷ 10 = {{ damagePoints() }}</span></div>
          
          <div class="text-white/50">Gegner besiegt:</div>
          <div class="text-right font-game text-white">{{ kills }}</div>
        </div>
        
        <!-- Active Buffs -->
        @if (activeBuffs.length > 0) {
          <div class="mt-4 pt-4 border-t border-white/10">
            <p class="text-white/50 text-sm mb-2">Gesammelte Buffs:</p>
            <app-buff-hud [activeBuffs]="activeBuffs"></app-buff-hud>
          </div>
        }
      </div>
      
      <!-- Name Entry -->
      @if (!submitted()) {
        <div class="mb-8 w-full max-w-[350px]">
          <label class="block text-white/50 text-sm mb-2 text-center">Name für Leaderboard eingeben:</label>
          <input 
            type="text"
            [(ngModel)]="playerName"
            (keydown.enter)="submitScore()"
            maxlength="20"
            placeholder="Dein Name..."
            class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-center text-xl
                   focus:outline-none focus:border-neon-green focus:bg-white/15 transition-colors"
            [disabled]="submitting()">
          
          <button 
            (click)="submitScore()"
            [disabled]="!playerName.trim() || submitting()"
            class="w-full mt-3 px-6 py-3 text-lg font-game text-black bg-neon-green rounded-lg
                   hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100">
            @if (submitting()) {
              <span class="animate-pulse">Speichern...</span>
            } @else {
              SCORE EINTRAGEN
            }
          </button>
        </div>
      } @else {
        <!-- Submission Result -->
        <div class="mb-8 text-center">
          @if (submitResult()) {
            <div class="bg-neon-green/20 border border-neon-green/50 rounded-lg p-4 mb-4">
              <p class="text-neon-green text-lg font-game">
                @if (submitResult()!.isNewHighScore) {
                  🏆 NEUER HIGHSCORE! 🏆
                } @else {
                  Score eingetragen!
                }
              </p>
              <p class="text-white/70 mt-1">
                Platz <span class="text-white font-game">#{{ submitResult()!.rank }}</span> im Leaderboard
              </p>
            </div>
          } @else {
            <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
              <p class="text-red-400">Fehler beim Speichern. Offline?</p>
            </div>
          }
        </div>
      }
      
      <!-- Buttons -->
      <div class="flex gap-4">
        <button 
          (click)="onRestart.emit()"
          class="px-8 py-4 text-xl font-game text-black bg-neon-green rounded-lg
                 hover:scale-105 transition-transform">
          NOCHMAL
        </button>
        <button 
          (click)="onMenu.emit()"
          class="px-8 py-4 text-xl font-game text-white bg-white/10 rounded-lg
                 border border-white/20 hover:bg-white/20 transition-colors">
          MENÜ
        </button>
      </div>
    </div>
  `,
  styles: [`
    @keyframes glow {
      0%, 100% { text-shadow: 0 0 20px rgba(57, 255, 20, 0.5); }
      50% { text-shadow: 0 0 40px rgba(57, 255, 20, 0.8); }
    }
    .animate-glow {
      animation: glow 2s ease-in-out infinite;
    }
  `]
})
export class GameOverComponent {
  @Input() level = 1;
  @Input() kills = 0;
  @Input() damage = 0;
  @Input() activeBuffs: ActiveBuff[] = [];
  
  @Output() onRestart = new EventEmitter<void>();
  @Output() onMenu = new EventEmitter<void>();
  
  playerName = '';
  submitted = signal(false);
  submitting = signal(false);
  submitResult = signal<{ rank: number; score: number; isNewHighScore: boolean } | null>(null);
  
  damagePoints = computed(() => Math.floor(this.damage / 10));
  calculatedScore = computed(() => this.level * 1000 + this.damagePoints());
  
  constructor(private leaderboardService: LeaderboardService) {}
  
  async submitScore(): Promise<void> {
    if (!this.playerName.trim() || this.submitting()) return;
    
    this.submitting.set(true);
    
    const result = await this.leaderboardService.submitScore({
      playerName: this.playerName.trim(),
      level: this.level,
      damageDealt: this.damage,
    });
    
    this.submitting.set(false);
    this.submitted.set(true);
    this.submitResult.set(result);
  }
}
