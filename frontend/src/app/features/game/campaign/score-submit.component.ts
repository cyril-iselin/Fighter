// ============================================
// Score Submit Component - Nach dem Tod Namen eingeben
// ============================================

import { Component, input, output, signal, computed, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService } from './leaderboard.service';
import { CombatLogComponent } from '../components/combat-log/combat-log.component';

@Component({
  selector: 'app-score-submit',
  standalone: true,
  imports: [CommonModule, CombatLogComponent],
  templateUrl: './score-submit.component.html'
})
export class ScoreSubmitComponent implements AfterViewInit, OnInit, OnDestroy {
  // Inputs
  level = input.required<number>();
  enemyHealthPercent = input.required<number>();
  
  // Outputs
  submitted = output<{ playerName: string; rank: number; score: number }>();
  skipped = output<void>();
  
  // State
  playerName = signal('');
  submitting = signal(false);
  
  // Computed
  levelPoints = computed(() => this.level() * 100);
  bonusPoints = computed(() => Math.round(100 - Math.max(0, Math.min(100, this.enemyHealthPercent()))));
  totalScore = computed(() => this.levelPoints() + this.bonusPoints());
  canSubmit = computed(() => this.playerName().trim().length > 0 && !this.submitting());
  
  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;
  
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  constructor(private leaderboard: LeaderboardService) {}
  
  ngOnInit(): void {
    // Add keyboard listener for submit/skip
    this.keyHandler = (e: KeyboardEvent) => {
      // Don't intercept Enter when typing in input - let form submit naturally
      if (e.code === 'Enter' && this.canSubmit()) {
        e.preventDefault();
        this.onSubmit();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.onSkip();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }
  
  ngOnDestroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
  }
  
  ngAfterViewInit(): void {
    // Focus input after render
    setTimeout(() => this.nameInput?.nativeElement?.focus(), 100);
  }
  
  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.playerName.set(input.value);
  }
  
  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    
    this.submitting.set(true);
    
    try {
      const result = await this.leaderboard.submitScore({
        playerName: this.playerName().trim(),
        level: this.level(),
        enemyHealthPercent: this.enemyHealthPercent()
      });
      
      if (result) {
        this.submitted.emit({
          playerName: this.playerName().trim(),
          rank: result.rank,
          score: result.score
        });
      } else {
        // API failed, still emit with calculated score
        this.submitted.emit({
          playerName: this.playerName().trim(),
          rank: 0,
          score: this.totalScore()
        });
      }
    } catch (err) {
      console.error('Failed to submit score:', err);
      this.submitted.emit({
        playerName: this.playerName().trim(),
        rank: 0,
        score: this.totalScore()
      });
    } finally {
      this.submitting.set(false);
    }
  }
  
  onSkip(): void {
    this.skipped.emit();
  }
}
