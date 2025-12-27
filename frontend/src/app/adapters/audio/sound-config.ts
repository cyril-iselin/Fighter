// ============================================================================
// SOUND CONFIGURATION
// ============================================================================
// Central configuration for all sound assets
// Adjust paths here to point to your MP3/OGG files
// ============================================================================

/**
 * Sound effect configuration
 * All paths are relative to the assets folder
 */
export const SFX_CONFIG = {
  // ===========================================================================
  // COMBAT SOUNDS
  // ===========================================================================
  
  /** Impact sound when hit connects */
  hit_flesh: {
    path: 'assets/audio/sfx/hit_flesh.mp3',
    volume: 0.8,
  },
  
  /** Sound when attack is blocked */
  hit_block: {
    path: 'assets/audio/sfx/hit_block.mp3',
    volume: 0.7,
  },
  
  /** Perfect parry sound */
  parry: {
    path: 'assets/audio/sfx/parry.mp3',
    volume: 0.9,
  },
  
  /** Light attack whoosh */
  attack_light: {
    path: 'assets/audio/sfx/whoosh_light.mp3',
    volume: 0.5,
  },
  
  /** Heavy attack whoosh (deeper) */
  attack_heavy: {
    path: 'assets/audio/sfx/whoosh_heavy.mp3',
    volume: 0.6,
  },
  
  // ===========================================================================
  // SPECIAL SOUNDS
  // ===========================================================================
  
  /** Rage burst explosion */
  rage_burst: {
    path: 'assets/audio/sfx/rage_burst.mp3',
    volume: 1.0,
  },
  
  /** Boss phase change dramatic sound */
  phase_change: {
    path: 'assets/audio/sfx/phase_change.mp3',
    volume: 0.9,
  },
  
  /** Stun/daze sound */
  stun: {
    path: 'assets/audio/sfx/stun.mp3',
    volume: 0.7,
  },
  
  // ===========================================================================
  // MOVEMENT SOUNDS
  // ===========================================================================
  
  /** Jump sound */
  jump: {
    path: 'assets/audio/sfx/jump.mp3',
    volume: 0.4,
  },
  
  /** Landing sound */
  land: {
    path: 'assets/audio/sfx/land.mp3',
    volume: 0.4,
  },
  
  // ===========================================================================
  // GAME STATE SOUNDS
  // ===========================================================================
  
  /** Fight start announcement */
  fight_start: {
    path: 'assets/audio/sfx/fight_start.mp3',
    volume: 1.0,
  },
  
  /** Victory fanfare */
  fight_won: {
    path: 'assets/audio/sfx/fight_won.mp3',
    volume: 0.9,
  },
  
  /** Game over / defeat sound */
  game_over: {
    path: 'assets/audio/sfx/game_over.mp3',
    volume: 0.8,
  },
  
  /** Death/KO sound */
  death: {
    path: 'assets/audio/sfx/death.mp3',
    volume: 0.8,
  },
} as const;

/**
 * Music configuration
 * For looping background tracks
 */
export const MUSIC_CONFIG = {
  /** Main menu background music */
  menu: {
    path: 'assets/audio/music/menu.mp3',
    volume: 0.4,
    loop: true,
  },
  
  /** Combat/fight music */
  fight: {
    path: 'assets/audio/music/fight.mp3',
    volume: 0.3,
    loop: true,
  },
} as const;

/**
 * Global audio settings
 */
export const AUDIO_SETTINGS = {
  /** Master volume multiplier (0.0 - 1.0) */
  masterVolume: 1.0,
  
  /** SFX volume multiplier (0.0 - 1.0) */
  sfxVolume: 1.0,
  
  /** Music volume multiplier (0.0 - 1.0) */
  musicVolume: 0.5,
  
  /** Fade duration for music transitions (ms) */
  musicFadeDuration: 1000,
  
  /** Whether to preload all sounds on startup */
  preloadAll: true,
};

// Type exports for type safety
export type SfxId = keyof typeof SFX_CONFIG;
export type MusicId = keyof typeof MUSIC_CONFIG;
