// ============================================
// Network Types - Multiplayer Type Definitions
// ============================================

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  InQueue = 'in-queue',
  InMatch = 'in-match',
  Reconnecting = 'reconnecting',
  Error = 'error'
}

export enum MatchState {
  Waiting = 'waiting',
  Starting = 'starting',
  Fighting = 'fighting',
  RoundEnd = 'round-end',
  MatchEnd = 'match-end'
}

// ============================================
// Enums für PlayerInput (kompakte Netzwerk-Werte)
// ============================================
export enum MoveDirection {
  None = 0,
  Left = 1,
  Right = 2
}

export enum AttackType {
  None = 0,
  Light = 1,   // J - Schnell, wenig Schaden
  Heavy = 2,   // K - Langsam, viel Schaden
  Special = 3  // L - Spezial-Attacke
}

export enum BlockZone {
  None = 0,
  Top = 1,     // U - Kopf blocken
  Center = 2,  // I - Mitte blocken
  Bottom = 3   // O - Beine blocken
}

// ============================================
// Loadout - Equipment selection
// Muss mit Backend Loadout enum übereinstimmen
// ============================================
export enum NetworkLoadout {
  Bare = 0,
  Sword = 1
  // Erweiterbar: Spear = 2, Hammer = 3, etc.
}

// ============================================
// Player Input - Wird jeden Frame gesendet
// Optimiert: Kurze JSON-Namen (m, j, a, b)
// ============================================
export interface PlayerInput {
  m: MoveDirection;  // moveDir
  j: boolean;        // jump
  a: AttackType;     // attack
  b: BlockZone;      // block
  r: boolean;        // run (sprint)
}

// Lokaler Input-State (für Game Engine)
export interface LocalInput {
  moveDir: 'left' | 'right' | 'none';
  jump: boolean;
  attack: 'none' | 'light' | 'heavy' | 'special';
  block: 'none' | 'top' | 'center' | 'bottom';
  run: boolean;
}

// Konvertierung LocalInput -> PlayerInput (für Netzwerk)
export function toNetworkInput(local: LocalInput): PlayerInput {
  return {
    m: local.moveDir === 'left' ? MoveDirection.Left 
     : local.moveDir === 'right' ? MoveDirection.Right 
     : MoveDirection.None,
    j: local.jump,
    a: local.attack === 'light' ? AttackType.Light
     : local.attack === 'heavy' ? AttackType.Heavy
     : local.attack === 'special' ? AttackType.Special
     : AttackType.None,
    b: local.block === 'top' ? BlockZone.Top
     : local.block === 'center' ? BlockZone.Center
     : local.block === 'bottom' ? BlockZone.Bottom
     : BlockZone.None,
    r: local.run
  };
}

// Konvertierung PlayerInput -> LocalInput (vom Netzwerk)
export function fromNetworkInput(net: PlayerInput): LocalInput {
  return {
    moveDir: net.m === MoveDirection.Left ? 'left'
           : net.m === MoveDirection.Right ? 'right'
           : 'none',
    jump: net.j,
    attack: net.a === AttackType.Light ? 'light'
          : net.a === AttackType.Heavy ? 'heavy'
          : net.a === AttackType.Special ? 'special'
          : 'none',
    block: net.b === BlockZone.Top ? 'top'
         : net.b === BlockZone.Center ? 'center'
         : net.b === BlockZone.Bottom ? 'bottom'
         : 'none',
    run: net.r
  };
}

export interface MatchInfo {
  matchId: string;
  playerNumber: 1 | 2;
  opponentName: string;
  opponentLoadout: string;
}

export interface PlayerState {
  x: number;
  y: number;
  health: number;
  animation: string;
  facingRight: boolean;
}

export interface GameSnapshot {
  frame: number;
  timestamp: number;
  player1: PlayerState;
  player2: PlayerState;
  matchState: MatchState;
}
