import type { SpineSkeleton } from '../adapters/spine-adapter';
import type { AudioPlayer } from '../adapters/sound-adapter';

// ============================================================================
// STUB IMPLEMENTATIONS (for development without Spine/Audio libraries)
// ============================================================================

/**
 * Stub Spine Skeleton for testing without actual Spine library
 */
export class StubSpineSkeleton implements SpineSkeleton {
  private currentAnim: string = 'idle';
  private x = 0;
  private y = 0;
  private flipped = false;
  private timeScale = 1.0;
  private loadout = 'bare';

  setAnimation(name: string, loop: boolean): void {
    if (this.currentAnim !== name) {
      console.log(`[Spine Stub] Animation: ${name} (loop: ${loop})`);
      this.currentAnim = name;
    }
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    // Don't log position updates every frame (too spammy)
  }

  setFlip(facingRight: boolean): void {
    if (this.flipped !== !facingRight) {
      console.log(`[Spine Stub] Flip: ${facingRight ? 'right' : 'left'}`);
      this.flipped = !facingRight;
    }
  }
  
  setTimeScale(scale: number): void {
    if (Math.abs(this.timeScale - scale) > 0.01) {
      console.log(`[Spine Stub] TimeScale: ${scale}x`);
      this.timeScale = scale;
    }
  }
  
  setLoadout(loadout: string): void {
    if (this.loadout !== loadout) {
      console.log(`[Spine Stub] Loadout changed: ${loadout}`);
      this.loadout = loadout;
    }
  }
}

/**
 * Stub Audio Player for testing without audio library
 */
export class StubAudioPlayer implements AudioPlayer {
  private muted = false;
  private volume = 1.0;

  play(key: string): void {
    if (!this.muted) {
      console.log(`[Audio Stub] Play: ${key} (volume: ${this.volume})`);
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`[Audio Stub] Volume: ${this.volume}`);
  }

  mute(): void {
    this.muted = true;
    console.log(`[Audio Stub] Muted`);
  }

  unmute(): void {
    this.muted = false;
    console.log(`[Audio Stub] Unmuted`);
  }
}
