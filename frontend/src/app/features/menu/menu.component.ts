import { Component, OnDestroy, signal, HostListener } from '@angular/core';
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
  audioLoadingProgress = signal(0);
  audioLoadingText = signal('');
  showAudioLoader = signal(false);
  debugMode = signal(false);

  // Math for template
  Math = Math;

  constructor(private router: Router) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'F3') {
      event.preventDefault();
      this.debugMode.set(!this.debugMode());
    }
  }

  ngOnDestroy(): void {
    const audio = getAudioPlayer();
    audio.stopMusic(true);
  }

  async enterMenu(): Promise<void> {
    try {
      // Show loading screen
      this.showAudioLoader.set(true);
      this.audioLoadingProgress.set(0);
      this.audioLoadingText.set('Initializing audio...');
      
      const audio = getAudioPlayer();
      audio.setProgressCallback((progress, current) => {
        this.audioLoadingProgress.set(progress);
        this.audioLoadingText.set(current);
      });
      
      await initializeAudio();
      
      this.showAudioLoader.set(false);
      await audio.playMusic('menu');
      console.log('[Menu] Audio initialized');
    } catch (e) {
      console.error('[Menu] Failed to initialize audio:', e);
      this.showAudioLoader.set(false);
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
