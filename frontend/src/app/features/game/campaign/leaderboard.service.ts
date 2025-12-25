// ============================================
// Leaderboard Service - High Scores API
// ============================================

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  score: number;
  level: number;
  bonusPoints: number;
  timestamp: string;
}

export interface SubmitScoreRequest {
  playerName: string;
  level: number;
  enemyHealthPercent: number; // 0-100
}

export interface SubmitScoreResponse {
  rank: number;
  score: number;
  isNewHighScore: boolean;
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  
  private readonly apiUrl = environment.apiUrl || 'http://localhost:5000';
  
  // State
  private readonly _entries = signal<LeaderboardEntry[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  
  // Public readonly signals
  readonly entries = this._entries.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  
  // Top 10 entries
  readonly top10 = computed(() => this._entries().slice(0, 10));
  
  constructor(private http: HttpClient) {}
  
  /**
   * Calculate score from level and enemy health
   * Level 7 with 30% enemy HP remaining = 700 + 70 = 770 points
   */
  static calculateScore(level: number, enemyHealthPercent: number): { total: number; levelPoints: number; bonusPoints: number } {
    const levelPoints = level * 100;
    // Bonus = 100 - remaining enemy HP (so more damage dealt = more points)
    const bonusPoints = Math.round(100 - Math.max(0, Math.min(100, enemyHealthPercent)));
    return {
      total: levelPoints + bonusPoints,
      levelPoints,
      bonusPoints
    };
  }
  
  /**
   * Fetch leaderboard from server
   */
  async fetchLeaderboard(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    
    try {
      const response = await this.http
        .get<LeaderboardEntry[]>(`${this.apiUrl}/api/leaderboard`)
        .toPromise();
      
      this._entries.set(response ?? []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      this._error.set('Leaderboard konnte nicht geladen werden');
      // Use cached/empty data
      this._entries.set([]);
    } finally {
      this._loading.set(false);
    }
  }
  
  /**
   * Submit a new score
   */
  async submitScore(request: SubmitScoreRequest): Promise<SubmitScoreResponse | null> {
    this._loading.set(true);
    this._error.set(null);
    
    try {
      const response = await this.http
        .post<SubmitScoreResponse>(`${this.apiUrl}/api/leaderboard`, request)
        .toPromise();
      
      // Refresh leaderboard after submit
      await this.fetchLeaderboard();
      
      return response ?? null;
    } catch (err) {
      console.error('Failed to submit score:', err);
      this._error.set('Punktzahl konnte nicht gespeichert werden');
      return null;
    } finally {
      this._loading.set(false);
    }
  }
  
  /**
   * Check if a score would make the top 10
   */
  wouldMakeTop10(score: number): boolean {
    const entries = this._entries();
    if (entries.length < 10) return true;
    return score > entries[entries.length - 1].score;
  }
}
