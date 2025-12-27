import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-dark-bg flex flex-col items-center p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-5xl font-game text-white tracking-wider mb-2">LEADERBOARD</h1>
        <p class="text-white/50">Die besten Kämpfer aller Zeiten</p>
      </div>
      
      <!-- Loading -->
      @if (loading()) {
        <div class="text-white/50 text-xl animate-pulse py-12">Lade Bestenliste...</div>
      }
      
      <!-- Error -->
      @if (error()) {
        <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <p class="text-red-400 mb-4">Fehler beim Laden der Bestenliste</p>
          <button 
            (click)="loadLeaderboard()"
            class="px-4 py-2 bg-red-500/30 text-white rounded hover:bg-red-500/50 transition-colors">
            Erneut versuchen
          </button>
        </div>
      }
      
      <!-- Leaderboard Table -->
      @if (!loading() && !error()) {
        <div class="w-full max-w-2xl">
          <!-- Table Header -->
          <div class="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 rounded-t-lg border-b border-white/10 text-white/50 text-sm font-game">
            <div class="col-span-1 text-center">#</div>
            <div class="col-span-5">SPIELER</div>
            <div class="col-span-3 text-right">SCORE</div>
            <div class="col-span-3 text-right">LEVEL</div>
          </div>
          
          <!-- Entries -->
          @if (entries().length === 0) {
            <div class="text-center py-12 text-white/50">
              Noch keine Einträge. Sei der Erste!
            </div>
          } @else {
            <div class="divide-y divide-white/5">
              @for (entry of entries(); track entry.id) {
                <div 
                  class="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-white/5 transition-colors"
                  [class.bg-yellow-500/10]="entry.rank === 1"
                  [class.bg-gray-400/10]="entry.rank === 2"
                  [class.bg-orange-600/10]="entry.rank === 3">
                  
                  <!-- Rank -->
                  <div class="col-span-1 text-center font-game">
                    @if (entry.rank === 1) {
                      <span class="text-yellow-400">🥇</span>
                    } @else if (entry.rank === 2) {
                      <span class="text-gray-300">🥈</span>
                    } @else if (entry.rank === 3) {
                      <span class="text-orange-400">🥉</span>
                    } @else {
                      <span class="text-white/50">{{ entry.rank }}</span>
                    }
                  </div>
                  
                  <!-- Player Name -->
                  <div class="col-span-5 text-white truncate">
                    {{ entry.playerName }}
                  </div>
                  
                  <!-- Score -->
                  <div class="col-span-3 text-right font-game text-neon-green">
                    {{ entry.score | number }}
                  </div>
                  
                  <!-- Level -->
                  <div class="col-span-3 text-right text-white/70">
                    Level {{ entry.level }}
                  </div>
                </div>
              }
            </div>
          }
          
          <!-- Table Footer -->
          <div class="px-4 py-2 bg-white/5 rounded-b-lg text-white/30 text-xs text-center">
            Top 100 Spieler
          </div>
        </div>
      }
      
      <!-- Back Button -->
      <button 
        (click)="goBack()"
        class="mt-12 px-8 py-4 text-xl font-game text-white bg-white/10 rounded-lg
               border border-white/20 hover:bg-white/20 transition-colors">
        ← ZURÜCK
      </button>
    </div>
  `,
  styles: []
})
export class LeaderboardComponent implements OnInit {
  entries = signal<LeaderboardEntry[]>([]);
  loading = signal(true);
  error = signal(false);
  
  constructor(
    private leaderboardService: LeaderboardService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadLeaderboard();
  }
  
  async loadLeaderboard(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    
    try {
      const data = await this.leaderboardService.getLeaderboard();
      this.entries.set(data);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  
  goBack(): void {
    this.router.navigate(['/menu']);
  }
}
