// ============================================
// Game Feature Module - Main Game Feature
// ============================================

// Components
export * from './components/fight-game/fight-game.component';
export * from './components/hud/hud.component';
export * from './components/loadout-selector/loadout-selector.component';
export * from './components/match-result/match-result.component';
export * from './components/connection-status/connection-status.component';
export * from './components/controls-info/controls-info.component';

// Services
export * from './services/network.service';
export * from './services/match.service';

// Models - use these for application-level types
export * from './models/game.types';
export * from './models/network.types';

// Engine - export specific items to avoid conflicts
export { 
  FightGame,
  FighterController,
  SpineGameManager,
  SpineFighterView,
  GameInputManager,
  PLAYER1_BINDINGS,
  ANIMATION_CATALOG,
  MIX_DURATIONS
} from './engine';

// Engine types that aren't duplicated
export type {
  SpinePlayer,
  SpineTrackEntry,
  SpineInstance,
  KeyBindings,
  LoadoutAnimations,
  FighterControllerConfig,
  HitZone,
  JumpVariant,
  DeathVariant,
  MoveDirection
} from './engine';
