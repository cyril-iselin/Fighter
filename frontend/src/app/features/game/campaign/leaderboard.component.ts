// ============================================
// Leaderboard Component - Wunderschöne Rangliste
// ============================================

import { Component, input, output, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.component.html'
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private readonly leaderboard = inject(LeaderboardService);
  
  // Input: Highlight a specific rank (e.g., the player's new rank)
  highlightRank = input<number>(0);
  
  // Output
  close = output<void>();
  
  // Expose service signals
  entries = this.leaderboard.entries;
  loading = this.leaderboard.loading;
  error = this.leaderboard.error;
  
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  ngOnInit(): void {
    this.leaderboard.fetchLeaderboard();
    
    // Add keyboard listener for close
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        this.close.emit();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }
  
  ngOnDestroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
  }
  
  onClose(): void {
    this.close.emit();
  }
}
