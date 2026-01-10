// ============================================================================
// WEB AUDIO PLAYER
// ============================================================================
// Real audio implementation using Web Audio API
// Supports SFX playback, music with looping, volume control, fade transitions
// ============================================================================

import { SFX_CONFIG, MUSIC_CONFIG, AUDIO_SETTINGS, type SfxId, type MusicId } from './sound-config';
import type { AudioPlayer } from '../sound-adapter';

/**
 * Audio buffer cache entry
 */
interface AudioCache {
  buffer: AudioBuffer | null;
  loading: boolean;
  error?: string;
}

/**
 * Web Audio Player - Full implementation of AudioPlayer interface
 * Uses Web Audio API for low-latency sound playback
 */
export class WebAudioPlayer implements AudioPlayer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  
  // Audio buffer cache
  private sfxCache: Map<SfxId, AudioCache> = new Map();
  private musicCache: Map<MusicId, AudioCache> = new Map();
  
  // Current music state
  private currentMusic: {
    id: MusicId | null;
    source: AudioBufferSourceNode | null;
    gainNode: GainNode | null;
  } = { id: null, source: null, gainNode: null };
  
  // Volume settings
  private masterVolume = AUDIO_SETTINGS.masterVolume;
  private sfxVolume = AUDIO_SETTINGS.sfxVolume;
  private musicVolume = AUDIO_SETTINGS.musicVolume;
  private muted = false;
  
  // Initialization state
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // Progress tracking for preloading
  private loadProgress = {
    total: 0,
    loaded: 0,
    callback: null as ((progress: number, current: string) => void) | null
  };

  /**
   * Set progress callback for preloading
   */
  setProgressCallback(callback: (progress: number, current: string) => void): void {
    this.loadProgress.callback = callback;
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   * Call this on first user click/keypress to comply with autoplay policies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }
  
  private async doInitialize(): Promise<void> {
    try {
      // Create audio context
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain nodes for volume control
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      
      // Connect: sfx/music -> master -> destination
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      
      // Apply initial volumes
      this.updateVolumes();
      
      // Preload sounds if configured
      if (AUDIO_SETTINGS.preloadAll) {
        await this.preloadAll();
      }
      
      this.initialized = true;
      console.log('[WebAudioPlayer] Initialized successfully');
    } catch (error) {
      console.error('[WebAudioPlayer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Preload all configured sounds with progress tracking
   */
  async preloadAll(): Promise<void> {
    const sfxIds = Object.keys(SFX_CONFIG) as SfxId[];
    const musicIds = Object.keys(MUSIC_CONFIG) as MusicId[];
    
    this.loadProgress.total = sfxIds.length + musicIds.length;
    this.loadProgress.loaded = 0;

    // Load SFX
    for (const id of sfxIds) {
      this.loadProgress.callback?.(this.loadProgress.loaded / this.loadProgress.total, `SFX: ${id}`);
      await this.loadSfx(id);
      this.loadProgress.loaded++;
    }

    // Load Music
    for (const id of musicIds) {
      this.loadProgress.callback?.(this.loadProgress.loaded / this.loadProgress.total, `Music: ${id}`);
      await this.loadMusic(id);
      this.loadProgress.loaded++;
    }

    this.loadProgress.callback?.(1, 'Complete');
    console.log('[WebAudioPlayer] Preloading complete');
  }

  /**
   * Load a sound effect into cache
   */
  private async loadSfx(id: SfxId): Promise<AudioBuffer | null> {
    if (!this.context) return null;
    
    const cached = this.sfxCache.get(id);
    if (cached?.buffer) return cached.buffer;
    if (cached?.loading) return null;
    
    const config = SFX_CONFIG[id];
    if (!config) {
      console.warn(`[WebAudioPlayer] Unknown SFX: ${id}`);
      return null;
    }
    
    this.sfxCache.set(id, { buffer: null, loading: true });
    
    try {
      const response = await fetch(config.path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      
      this.sfxCache.set(id, { buffer: audioBuffer, loading: false });
      console.log(`[WebAudioPlayer] Loaded SFX: ${id}`);
      return audioBuffer;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.sfxCache.set(id, { buffer: null, loading: false, error: errorMsg });
      console.warn(`[WebAudioPlayer] Failed to load SFX ${id}:`, errorMsg);
      return null;
    }
  }

  /**
   * Load music track into cache
   */
  private async loadMusic(id: MusicId): Promise<AudioBuffer | null> {
    if (!this.context) return null;
    
    const cached = this.musicCache.get(id);
    if (cached?.buffer) return cached.buffer;
    if (cached?.loading) return null;
    
    const config = MUSIC_CONFIG[id];
    if (!config) {
      console.warn(`[WebAudioPlayer] Unknown music: ${id}`);
      return null;
    }
    
    this.musicCache.set(id, { buffer: null, loading: true });
    
    try {
      const response = await fetch(config.path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      
      this.musicCache.set(id, { buffer: audioBuffer, loading: false });
      console.log(`[WebAudioPlayer] Loaded music: ${id}`);
      return audioBuffer;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.musicCache.set(id, { buffer: null, loading: false, error: errorMsg });
      console.warn(`[WebAudioPlayer] Failed to load music ${id}:`, errorMsg);
      return null;
    }
  }

  // ===========================================================================
  // SFX PLAYBACK
  // ===========================================================================

  /**
   * Play a sound effect by key (implements AudioPlayer interface)
   */
  play(key: string): void {
    this.playSfx(key as SfxId);
  }

  /**
   * Play a sound effect by ID
   */
  async playSfx(id: SfxId): Promise<void> {
    if (!this.context || !this.sfxGain || this.muted) return;
    
    // Resume context if suspended (autoplay policy)
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    // Get or load buffer
    let buffer = this.sfxCache.get(id)?.buffer;
    if (!buffer) {
      buffer = await this.loadSfx(id);
      if (!buffer) return;
    }
    
    // Get volume from config
    const config = SFX_CONFIG[id];
    const volume = config?.volume ?? 1.0;
    
    // Create source and play
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    
    // Create individual gain for this sound
    const gainNode = this.context.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.sfxGain);
    
    source.start(0);
  }

  // ===========================================================================
  // MUSIC PLAYBACK
  // ===========================================================================

  /**
   * Play music track (with optional fade-in)
   */
  async playMusic(id: MusicId, fadeIn: boolean = true): Promise<void> {
    if (!this.context || !this.musicGain) return;
    
    // Resume context if suspended
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    // Stop current music first
    if (this.currentMusic.source) {
      await this.stopMusic(fadeIn);
    }
    
    // Get or load buffer
    let buffer = this.musicCache.get(id)?.buffer;
    if (!buffer) {
      buffer = await this.loadMusic(id);
      if (!buffer) return;
    }
    
    const config = MUSIC_CONFIG[id];
    const volume = config?.volume ?? 0.5;
    const loop = config?.loop ?? true;
    
    // Create source
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    
    // Create gain for this track
    const gainNode = this.context.createGain();
    gainNode.gain.value = fadeIn ? 0 : volume;
    
    source.connect(gainNode);
    gainNode.connect(this.musicGain);
    
    // Store reference
    this.currentMusic = { id, source, gainNode };
    
    // Start playback
    source.start(0);
    
    // Fade in if requested
    if (fadeIn) {
      gainNode.gain.linearRampToValueAtTime(
        volume,
        this.context.currentTime + AUDIO_SETTINGS.musicFadeDuration / 1000
      );
    }
    
    console.log(`[WebAudioPlayer] Playing music: ${id}`);
  }

  /**
   * Stop current music (with optional fade-out)
   */
  async stopMusic(fadeOut: boolean = true): Promise<void> {
    if (!this.context || !this.currentMusic.source || !this.currentMusic.gainNode) {
      return;
    }
    
    const { source, gainNode } = this.currentMusic;
    
    if (fadeOut) {
      // Fade out
      gainNode.gain.linearRampToValueAtTime(
        0,
        this.context.currentTime + AUDIO_SETTINGS.musicFadeDuration / 1000
      );
      
      // Stop after fade
      setTimeout(() => {
        try {
          source.stop();
        } catch (e) {
          // Already stopped
        }
      }, AUDIO_SETTINGS.musicFadeDuration);
    } else {
      // Stop immediately
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    }
    
    this.currentMusic = { id: null, source: null, gainNode: null };
  }

  // ===========================================================================
  // VOLUME CONTROL
  // ===========================================================================

  private updateVolumes(): void {
    const effectiveVolume = this.muted ? 0 : this.masterVolume;
    
    if (this.masterGain) {
      this.masterGain.gain.value = effectiveVolume;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  /**
   * Set master volume (implements AudioPlayer interface)
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set SFX volume
   */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set music volume
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Mute all audio (implements AudioPlayer interface)
   */
  mute(): void {
    this.muted = true;
    this.updateVolumes();
  }

  /**
   * Unmute all audio (implements AudioPlayer interface)
   */
  unmute(): void {
    this.muted = false;
    this.updateVolumes();
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.updateVolumes();
    return this.muted;
  }

  /**
   * Check if audio is muted
   */
  isMuted(): boolean {
    return this.muted;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopMusic(false);
    
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    
    this.sfxCache.clear();
    this.musicCache.clear();
    this.initialized = false;
    this.initPromise = null;
    
    console.log('[WebAudioPlayer] Disposed');
  }
}

// Singleton instance for global access
let globalAudioPlayer: WebAudioPlayer | null = null;

/**
 * Get the global audio player instance
 */
export function getAudioPlayer(): WebAudioPlayer {
  if (!globalAudioPlayer) {
    globalAudioPlayer = new WebAudioPlayer();
  }
  return globalAudioPlayer;
}

/**
 * Initialize audio on user interaction
 * Call this from a click/keypress handler
 */
export async function initializeAudio(): Promise<void> {
  const player = getAudioPlayer();
  await player.initialize();
}
