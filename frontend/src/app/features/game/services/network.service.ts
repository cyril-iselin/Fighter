// ============================================
// Network Service - SignalR Connection Management
// ============================================

import { Injectable, signal, computed } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { 
  ConnectionState, 
  MatchState, 
  PlayerInput, 
  MatchInfo,
  GameSnapshot,
  NetworkLoadout
} from '../models/network.types';

const HUB_URL = 'http://localhost:5000/api/game-hub';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private connection: signalR.HubConnection | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastPingTime = 0;

  // Reactive State
  readonly connectionState = signal<ConnectionState>(ConnectionState.Disconnected);
  readonly matchState = signal<MatchState>(MatchState.Waiting);
  readonly playerNumber = signal<1 | 2>(1);
  readonly ping = signal(0);
  readonly matchId = signal('');

  // Computed
  readonly isConnected = computed(() => 
    this.connectionState() !== ConnectionState.Disconnected &&
    this.connectionState() !== ConnectionState.Error
  );
  readonly isInMatch = computed(() => 
    this.connectionState() === ConnectionState.InMatch
  );

  // Callbacks
  onMatchFound: ((info: MatchInfo) => void) | null = null;
  onFightStart: (() => void) | null = null;
  onOpponentInput: ((input: PlayerInput) => void) | null = null;
  onGameSnapshot: ((snapshot: GameSnapshot) => void) | null = null;
  onOpponentDisconnected: (() => void) | null = null;
  onMatchEnded: ((winnerPlayerNumber: 1 | 2) => void) | null = null;
  onOpponentLoadoutChanged: ((loadout: NetworkLoadout) => void) | null = null;

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connectionState.set(ConnectionState.Connecting);

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.setupEventHandlers();
    this.setupReconnectHandlers();

    try {
      await this.connection.start();
      this.connectionState.set(ConnectionState.Connected);
      this.startPingInterval();
      console.log('[NetworkService] Connected to server');
    } catch (error) {
      this.connectionState.set(ConnectionState.Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPingInterval();
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.connectionState.set(ConnectionState.Disconnected);
  }

  async joinMatchmaking(playerName: string): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    
    this.connectionState.set(ConnectionState.InQueue);
    await this.connection.invoke('JoinMatchmaking', playerName);
  }

  async leaveMatchmaking(): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('LeaveMatchmaking');
    this.connectionState.set(ConnectionState.Connected);
  }

  async playerReady(): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('PlayerReady');
  }

  async sendInput(input: PlayerInput): Promise<void> {
    if (!this.connection || !this.isInMatch()) return;
    await this.connection.invoke('SendInput', input);
  }

  async sendLoadout(loadout: NetworkLoadout): Promise<void> {
    if (!this.connection || !this.isInMatch()) return;
    await this.connection.invoke('SendLoadout', loadout);
  }

  async reportDamage(targetPlayer: 1 | 2, damage: number): Promise<void> {
    if (!this.connection || !this.isInMatch()) return;
    await this.connection.invoke('ReportDamage', targetPlayer, damage);
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Server sendet MatchInfo-Objekt
    this.connection.on('MatchFound', (info: { matchId: string; playerNumber: number; opponentName: string }) => {
      console.log('[NetworkService] MatchFound:', info);
      this.matchId.set(info.matchId);
      this.playerNumber.set(info.playerNumber as 1 | 2);
      this.connectionState.set(ConnectionState.InMatch);
      this.matchState.set(MatchState.Starting);
      
      this.onMatchFound?.({
        matchId: info.matchId,
        playerNumber: info.playerNumber as 1 | 2,
        opponentName: info.opponentName,
        opponentLoadout: 'bare'
      });
    });

    this.connection.on('FightStart', () => {
      this.matchState.set(MatchState.Fighting);
      this.onFightStart?.();
    });

    this.connection.on('OpponentInput', (input: PlayerInput) => {
      this.onOpponentInput?.(input);
    });

    this.connection.on('GameSnapshot', (snapshot: GameSnapshot) => {
      this.onGameSnapshot?.(snapshot);
    });

    this.connection.on('OpponentDisconnected', () => {
      this.matchState.set(MatchState.Waiting);
      this.connectionState.set(ConnectionState.InQueue);
      this.onOpponentDisconnected?.();
    });

    this.connection.on('MatchEnded', (winnerPlayerNumber: number) => {
      this.matchState.set(MatchState.MatchEnd);
      this.onMatchEnded?.(winnerPlayerNumber as 1 | 2);
    });

    this.connection.on('OpponentLoadoutChanged', (loadout: NetworkLoadout) => {
      console.log('[NetworkService] OpponentLoadoutChanged:', loadout);
      this.onOpponentLoadoutChanged?.(loadout);
    });

    this.connection.on('Pong', () => {
      this.ping.set(Date.now() - this.lastPingTime);
    });
  }

  private setupReconnectHandlers(): void {
    if (!this.connection) return;

    this.connection.onreconnecting(() => {
      this.connectionState.set(ConnectionState.Reconnecting);
    });

    this.connection.onreconnected(() => {
      this.connectionState.set(ConnectionState.Connected);
    });

    this.connection.onclose(() => {
      this.connectionState.set(ConnectionState.Disconnected);
      this.stopPingInterval();
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.connection?.state === signalR.HubConnectionState.Connected) {
        this.lastPingTime = Date.now();
        this.connection.invoke('Ping').catch(() => {});
      }
    }, 2000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
