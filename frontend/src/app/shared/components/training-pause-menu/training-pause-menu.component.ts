import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Loadout } from '../../../core/types';
import type { BackgroundId } from '../../../adapters/spine-stage';
import type { AIOption } from '../../../ai/ai-selection.service';
import { AISelectorComponent } from '../ai-selector/ai-selector.component';

export interface TrainingPauseMenuActions {
  onResume: () => void;
  onResetMatch: () => void;
  onToggleEventLog: () => void;
  onToggleDebug: () => void;
  onToggleAI: () => void;
  onSetPlayerLoadout: (loadout: Loadout) => void;
  onSetAILoadout: (loadout: Loadout) => void;
  onCycleTimeScale: () => void;
  onSetBackground: (backgroundId: BackgroundId) => void;
  onExit: () => void;
}

@Component({
  selector: 'app-training-pause-menu',
  standalone: true,
  imports: [CommonModule, AISelectorComponent],
  templateUrl: './training-pause-menu.component.html',
  styleUrl: './training-pause-menu.component.css'
})
export class TrainingPauseMenuComponent {
  @Input() playerLoadout: Loadout = 'bare';
  @Input() aiLoadout: Loadout = 'bare';
  @Input() aiEnabled: boolean = false;
  @Input() debugActive: boolean = false;
  @Input() timeScale: number = 1.0;
  @Input() tickCount: number = 0;
  @Input() fps: number = 60;
  @Input() currentBackground: BackgroundId = 'city1';
  
  // AI Selection
  @Input() availableAIs: AIOption[] = [];
  @Input() selectedAIId: string | null = null;

  @Output() resume = new EventEmitter<void>();
  @Output() resetMatch = new EventEmitter<void>();
  @Output() toggleEventLog = new EventEmitter<void>();
  @Output() toggleDebug = new EventEmitter<void>();
  @Output() toggleAI = new EventEmitter<void>();
  @Output() setPlayerLoadout = new EventEmitter<Loadout>();
  @Output() setAILoadout = new EventEmitter<Loadout>();
  @Output() cycleTimeScale = new EventEmitter<void>();
  @Output() setBackground = new EventEmitter<BackgroundId>();
  @Output() selectAI = new EventEmitter<string>();  // New: AI selection
  @Output() exit = new EventEmitter<void>();

  /**
   * Handle resume button click - stop propagation and add delay to prevent click from being registered as attack
   */
  onResumeClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Add small delay before emitting resume to ensure click doesn't propagate
    setTimeout(() => {
      this.resume.emit();
    }, 50);
  }
}
