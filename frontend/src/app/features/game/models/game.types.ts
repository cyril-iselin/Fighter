// ============================================
// Game Types - Core Game Type Definitions
// ============================================

// Re-export from engine types
import { Loadout as EngineLoadout } from '../engine/types';
export type Loadout = EngineLoadout;

export type GamePhase = 
  | 'loading'
  | 'matchmaking'
  | 'ready'
  | 'fighting'
  | 'paused'
  | 'finished';

export interface GameConfig {
  canvas: HTMLCanvasElement;
  player1Loadout: Loadout;
  player2Loadout: Loadout;
  roundTime?: number;
  roundsToWin?: number;
}

export interface GameState {
  phase: GamePhase;
  player1Health: number;
  player2Health: number;
  player1Rounds: number;
  player2Rounds: number;
  currentRound: number;
  timeRemaining: number;
}

export interface RoundResult {
  winner: 1 | 2 | 'draw';
  player1HealthRemaining: number;
  player2HealthRemaining: number;
}

export interface MatchResult {
  winner: 1 | 2;
  player1Rounds: number;
  player2Rounds: number;
  totalRounds: number;
}
