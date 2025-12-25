// ============================================
// Audio Service - Game Sound Effects & Music
// ============================================

import { Injectable, signal } from '@angular/core';

export interface SoundEffect {
  name: string;
  url: string;
  volume?: number;
}

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioContext: AudioContext | null = null;
  private sounds = new Map<string, AudioBuffer>();
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Reactive state
  readonly isMuted = signal(false);
  readonly musicVolume = signal(0.5);
  readonly sfxVolume = signal(0.7);
  
  async initialize(): Promise<void> {
    this.audioContext = new AudioContext();
    
    // Create gain nodes
    this.musicGain = this.audioContext.createGain();
    this.musicGain.connect(this.audioContext.destination);
    this.musicGain.gain.value = this.musicVolume();
    
    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.connect(this.audioContext.destination);
    this.sfxGain.gain.value = this.sfxVolume();
  }
  
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext) await this.initialize();
    
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
    } catch (error) {
      console.warn(`[AudioService] Failed to load sound: ${name}`, error);
    }
  }
  
  playSfx(name: string): void {
    if (this.isMuted() || !this.audioContext || !this.sfxGain) return;
    
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`[AudioService] Sound not found: ${name}`);
      return;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain);
    source.start();
  }
  
  setMusicVolume(volume: number): void {
    this.musicVolume.set(Math.max(0, Math.min(1, volume)));
    if (this.musicGain) {
      this.musicGain.gain.value = this.isMuted() ? 0 : this.musicVolume();
    }
  }
  
  setSfxVolume(volume: number): void {
    this.sfxVolume.set(Math.max(0, Math.min(1, volume)));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.isMuted() ? 0 : this.sfxVolume();
    }
  }
  
  toggleMute(): void {
    this.isMuted.set(!this.isMuted());
    if (this.musicGain) {
      this.musicGain.gain.value = this.isMuted() ? 0 : this.musicVolume();
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.isMuted() ? 0 : this.sfxVolume();
    }
  }
}
