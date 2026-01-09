import { Component, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { getAudioPlayer, initializeAudio } from '../../adapters/audio';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnDestroy {
  showClickToEnter = signal(true);

  constructor(private router: Router) {}

  ngOnDestroy(): void {
    const audio = getAudioPlayer();
    audio.stopMusic(true);
  }

  async enterMenu(): Promise<void> {
    try {
      await initializeAudio();
      const audio = getAudioPlayer();
      await audio.playMusic('menu');
      console.log('[Menu] Audio initialized');
    } catch (e) {
      console.error('[Menu] Failed to initialize audio:', e);
    }
    
    this.showClickToEnter.set(false);
  }

  async startTraining(): Promise<void> {
    const audio = getAudioPlayer();
    await audio.stopMusic(true);
    this.router.navigate(['/training']);
  }

  async startEndless(): Promise<void> {
    const audio = getAudioPlayer();
    await audio.stopMusic(true);
    this.router.navigate(['/endless']);
  }

  async showLeaderboard(): Promise<void> {
    const audio = getAudioPlayer();
    await audio.stopMusic(true);
    this.router.navigate(['/leaderboard']);
  }

  async startDummyTest(): Promise<void> {
    const audio = getAudioPlayer();
    await audio.stopMusic(true);
    this.router.navigate(['/dummy-test']);
  }
}
