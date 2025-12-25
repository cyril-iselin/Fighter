// ============================================
// Match Result Component
// ============================================

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CombatLogComponent } from '../combat-log/combat-log.component';

@Component({
  selector: 'app-match-result',
  standalone: true,
  imports: [CommonModule, CombatLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-result.component.html'
})
export class MatchResultComponent {
  @Input() isWinner = false;
  @Input() rounds = 0;
  @Input() totalRounds = 0;
  @Input() showStats = false;
  @Input() showCombatLog = true;
  @Output() playAgain = new EventEmitter<void>();
  @Output() backToMenu = new EventEmitter<void>();
  
  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.playAgain.emit();
    } else if (event.code === 'Escape') {
      event.preventDefault();
      this.backToMenu.emit();
    }
  }
}
