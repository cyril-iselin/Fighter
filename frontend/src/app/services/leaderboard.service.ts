// ============================================================================
// LEADERBOARD SERVICE
// ============================================================================

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface LeaderboardEntry {
  id: string;
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
  damageDealt: number;
}

export interface SubmitScoreResponse {
  rank: number;
  score: number;
  isNewHighScore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private readonly apiUrl = environment.apiUrl || 'http://localhost:5000';
  
  /**
   * Calculate score from level and damage
   * Formula: Level * 1000 + Damage / 10
   */
  calculateScore(level: number, damageDealt: number): number {
    return level * 1000 + Math.floor(damageDealt / 10);
  }
  
  /**
   * Get top 100 leaderboard entries
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/leaderboard`);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      return await response.json();
    } catch (error) {
      console.error('[Leaderboard] Failed to fetch:', error);
      return [];
    }
  }
  
  /**
   * Submit a new score
   */
  async submitScore(request: SubmitScoreRequest): Promise<SubmitScoreResponse | null> {
    try {
      const response = await fetch(`${this.apiUrl}/api/leaderboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: request.playerName,
          level: request.level,
          // Backend uses EnemyHealthPercent but we'll send damage and let it calculate
          enemyHealthPercent: 0, // Not used in our formula
          damageDealt: request.damageDealt,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit score');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[Leaderboard] Failed to submit:', error);
      return null;
    }
  }
}
