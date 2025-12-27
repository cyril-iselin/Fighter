import type { GameEvent } from '../core/types';
import type { SfxId } from './audio/sound-config';

// ============================================================================
// SOUND ADAPTER (Event -> SFX Mapping)
// ============================================================================

/**
 * SFX Key constants (maps to SfxId in sound-config)
 */
export const SFX_KEYS = {
  // Combat
  HIT_FLESH: 'hit_flesh',
  HIT_BLOCK: 'hit_block',
  PARRY: 'parry',
  ATTACK_LIGHT: 'attack_light',
  ATTACK_HEAVY: 'attack_heavy',
  
  // Special
  RAGE_BURST: 'rage_burst',
  PHASE_CHANGE: 'phase_change',
  STUN: 'stun',
  
  // Movement
  JUMP: 'jump',
  LAND: 'land',
  
  // States
  DEATH: 'death',
  TELEGRAPH: 'telegraph',
  
  // Match Flow
  FIGHT_START: 'fight_start',
  FIGHT_WON: 'fight_won',
  GAME_OVER: 'game_over',
} as const;

export type SfxKey = typeof SFX_KEYS[keyof typeof SFX_KEYS];

/**
 * Maps GameEvent -> SFX keys
 * Pure function, no side effects, no audio playback logic
 */
export function mapEventToSfx(event: GameEvent): SfxKey | SfxKey[] | null {
  switch (event.type) {
    case 'hit':
      return SFX_KEYS.HIT_FLESH;

    case 'block':
      return event.perfect ? SFX_KEYS.PARRY : SFX_KEYS.HIT_BLOCK;

    case 'parry':
      return SFX_KEYS.PARRY;

    case 'whiff':
      // No sound for whiff - too noisy
      return null;

    case 'attackStart': {
      // Determine attack type from attack name
      const isHeavy = event.attack.toLowerCase().includes('heavy') || 
                      event.attack.toLowerCase().includes('kick');
      return isHeavy ? SFX_KEYS.ATTACK_HEAVY : SFX_KEYS.ATTACK_LIGHT;
    }

    case 'rageBurst':
      return SFX_KEYS.RAGE_BURST;

    case 'phaseChange':
      return SFX_KEYS.PHASE_CHANGE;

    case 'stun':
      return SFX_KEYS.STUN;

    case 'jump':
      return SFX_KEYS.JUMP;

    case 'land':
      return SFX_KEYS.LAND;

    case 'death':
      return SFX_KEYS.DEATH;

    case 'telegraph':
      return SFX_KEYS.TELEGRAPH;

    case 'fightStart':
      return SFX_KEYS.FIGHT_START;

    case 'fightWon':
      return SFX_KEYS.FIGHT_WON;

    case 'gameOver':
      return SFX_KEYS.GAME_OVER;

    case 'stateChange':
      // State changes don't produce sound directly
      return null;

    default:
      return null;
  }
}

/**
 * Sound Adapter Class
 * Handles event-to-sound mapping with optional audio player injection
 */
export class SoundAdapter {
  constructor(private audioPlayer?: AudioPlayer) {}

  /**
   * Processes events and triggers sounds
   * Returns array of SFX keys that should be played
   */
  handleEvents(events: GameEvent[]): SfxKey[] {
    const sfxKeys: SfxKey[] = [];

    for (const event of events) {
      const result = mapEventToSfx(event);
      
      if (result) {
        // Handle single key or array of keys
        const keys = Array.isArray(result) ? result : [result];
        
        for (const sfxKey of keys) {
          sfxKeys.push(sfxKey);
          
          // If audio player is injected, play immediately
          if (this.audioPlayer) {
            this.audioPlayer.play(sfxKey);
          }
        }
      }
    }

    return sfxKeys;
  }
}

// ============================================================================
// AUDIO PLAYER INTERFACE (for dependency injection)
// ============================================================================

/**
 * Interface for audio playback (to avoid direct audio library dependency)
 * Actual implementation will use Web Audio API, Howler.js, or similar
 */
export interface AudioPlayer {
  /**
   * Plays a sound effect by key
   * @param key - SFX key (maps to audio file)
   */
  play(key: SfxKey): void;

  /**
   * Sets volume (0.0 - 1.0)
   */
  setVolume?(volume: number): void;

  /**
   * Mutes all sound
   */
  mute?(): void;

  /**
   * Unmutes all sound
   */
  unmute?(): void;
}
