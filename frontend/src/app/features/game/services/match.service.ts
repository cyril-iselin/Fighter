// ============================================
// Match Service - Game Match State Management
// ============================================

import { Injectable, signal, computed, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { GameState, GamePhase, RoundResult, MatchResult, Loadout } from '../models/game.types';
import { MatchState } from '../models/network.types';

const DEFAULT_ROUND_TIME = 99;
const ROUNDS_TO_WIN = 2;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly network = inject(NetworkService);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Player Info
  readonly playerName = signal(`Fighter${Math.floor(Math.random() * 9999)}`);
  readonly opponentName = signal('');
  readonly myLoadout = signal<Loadout>('bare');
  readonly opponentLoadout = signal<Loadout>('bare');

  // Game State
  readonly phase = signal<GamePhase>('loading');
  readonly player1Health = signal(100);
  readonly player2Health = signal(100);
  readonly player1SpecialMeter = signal(0);  // Player special meter
  readonly player2StunMeter = signal(0);      // AI stun meter
  readonly player1Stunned = signal(false);    // Not used for player
  readonly player2Stunned = signal(false);
  readonly player1Rounds = signal(0);
  readonly player2Rounds = signal(0);
  readonly currentRound = signal(1);
  readonly timeRemaining = signal(DEFAULT_ROUND_TIME);

  // Match Result
  readonly lastResult = signal<MatchResult | null>(null);

  // Computed
  readonly isPlayer1 = computed(() => this.network.playerNumber() === 1);
  readonly myHealth = computed(() => 
    this.isPlayer1() ? this.player1Health() : this.player2Health()
  );
  readonly opponentHealth = computed(() => 
    this.isPlayer1() ? this.player2Health() : this.player1Health()
  );
  readonly gameState = computed<GameState>(() => ({
    phase: this.phase(),
    player1Health: this.player1Health(),
    player2Health: this.player2Health(),
    player1Rounds: this.player1Rounds(),
    player2Rounds: this.player2Rounds(),
    currentRound: this.currentRound(),
    timeRemaining: this.timeRemaining()
  }));

  initialize(): void {
    this.setupNetworkCallbacks();
  }

  setPhase(phase: GamePhase): void {
    this.phase.set(phase);
    
    if (phase === 'fighting') {
      this.startRoundTimer();
    } else {
      this.stopRoundTimer();
    }
  }

  applyDamage(targetPlayer: 1 | 2, damage: number): void {
    if (targetPlayer === 1) {
      const newHealth = Math.max(0, this.player1Health() - damage);
      this.player1Health.set(newHealth);
      if (newHealth <= 0) this.endRound(2);
    } else {
      const newHealth = Math.max(0, this.player2Health() - damage);
      this.player2Health.set(newHealth);
      if (newHealth <= 0) this.endRound(1);
    }

    // Report to server
    this.network.reportDamage(targetPlayer, damage);
  }

  private endRound(winner: 1 | 2 | 'draw'): void {
    this.stopRoundTimer();
    
    const result: RoundResult = {
      winner,
      player1HealthRemaining: this.player1Health(),
      player2HealthRemaining: this.player2Health()
    };

    if (winner === 1) {
      this.player1Rounds.set(this.player1Rounds() + 1);
    } else if (winner === 2) {
      this.player2Rounds.set(this.player2Rounds() + 1);
    }

    // Check for match end
    if (this.player1Rounds() >= ROUNDS_TO_WIN) {
      this.endMatch(1);
    } else if (this.player2Rounds() >= ROUNDS_TO_WIN) {
      this.endMatch(2);
    } else {
      // Next round
      this.currentRound.set(this.currentRound() + 1);
      this.startNextRound();
    }
  }

  private startNextRound(): void {
    this.player1Health.set(100);
    this.player2Health.set(100);
    this.timeRemaining.set(DEFAULT_ROUND_TIME);
    
    // Brief delay before next round
    setTimeout(() => {
      this.setPhase('fighting');
    }, 2000);
  }

  private endMatch(winner: 1 | 2): void {
    this.setPhase('finished');
    
    this.lastResult.set({
      winner,
      player1Rounds: this.player1Rounds(),
      player2Rounds: this.player2Rounds(),
      totalRounds: this.currentRound()
    });
  }

  resetMatch(): void {
    this.player1Health.set(100);
    this.player2Health.set(100);
    this.player1SpecialMeter.set(0);
    this.player2StunMeter.set(0);
    this.player1Stunned.set(false);
    this.player2Stunned.set(false);
    this.player1Rounds.set(0);
    this.player2Rounds.set(0);
    this.currentRound.set(1);
    this.timeRemaining.set(DEFAULT_ROUND_TIME);
    this.lastResult.set(null);
    this.opponentName.set('');
  }

  private startRoundTimer(): void {
    this.stopRoundTimer();
    
    this.timerInterval = setInterval(() => {
      const remaining = this.timeRemaining() - 1;
      this.timeRemaining.set(remaining);
      
      if (remaining <= 0) {
        // Time out - winner is whoever has more health
        const p1 = this.player1Health();
        const p2 = this.player2Health();
        if (p1 > p2) this.endRound(1);
        else if (p2 > p1) this.endRound(2);
        else this.endRound('draw');
      }
    }, 1000);
  }

  private stopRoundTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private setupNetworkCallbacks(): void {
    this.network.onMatchFound = (info) => {
      this.opponentName.set(info.opponentName);
      this.setPhase('ready');
    };

    this.network.onFightStart = () => {
      this.setPhase('fighting');
    };

    this.network.onOpponentDisconnected = () => {
      this.resetMatch();
      this.setPhase('matchmaking');
    };

    this.network.onMatchEnded = (winner) => {
      this.endMatch(winner);
    };
  }
}
