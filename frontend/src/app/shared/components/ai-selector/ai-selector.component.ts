import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AIOption } from '../../../ai/ai-selection.service';

/**
 * AI Selector Component
 * Displays available AI profiles for selection
 * Used in pause menu and character select screens
 */
@Component({
  selector: 'app-ai-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-2 gap-2">
      @for (ai of filteredAIs(); track ai.id) {
        <button 
          (click)="selectAI.emit(ai.id); $event.stopPropagation()"
          class="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          <!-- Selection Border -->
          <div class="absolute -inset-[1px] rounded-lg opacity-70 group-hover:opacity-100 transition-opacity"
            [class.bg-gradient-to-r]="selectedId === ai.id"
            [class.from-purple-500]="selectedId === ai.id"
            [class.via-pink-500]="selectedId === ai.id"
            [class.to-purple-500]="selectedId === ai.id"
            [class.bg-gray-700]="selectedId !== ai.id"
            [style.background-size]="selectedId === ai.id ? '200% 100%' : ''"
            [style.animation]="selectedId === ai.id ? 'gradient-shift 3s linear infinite' : ''">
          </div>
          <div class="absolute inset-[1px] bg-gradient-to-r from-dark-card via-dark-bg to-dark-card rounded-lg"></div>
          
          <!-- Content -->
          <div class="relative px-3 py-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ getDifficultyIcon(ai.difficulty) }}</span>
              <div class="flex-1 min-w-0">
                <span class="font-game text-xs font-bold block truncate" 
                  [class.text-purple-400]="selectedId === ai.id">
                  {{ ai.name }}
                </span>
              </div>
              <!-- Difficulty Stars (compact) -->
              <div class="flex gap-0.5">
                @for (star of getDifficultyStars(ai.difficulty); track $index) {
                  <span class="text-[10px]" [class.text-yellow-400]="star" [class.text-gray-600]="!star">★</span>
                }
              </div>
            </div>
          </div>
        </button>
      }
      
      @if (filteredAIs().length === 0) {
        <div class="col-span-2 text-center py-4 text-white/40 font-game text-xs">
          No AI profiles available
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class AISelectorComponent {
  @Input() availableAIs: AIOption[] = [];
  @Input() selectedId: string | null = null;
  @Input() filterCharacter: string | null = null;
  
  @Output() selectAI = new EventEmitter<string>();

  // Filter AIs based on character (if specified)
  filteredAIs = computed(() => {
    if (!this.filterCharacter) {
      return this.availableAIs;
    }
    return this.availableAIs.filter(
      ai => ai.forCharacter === this.filterCharacter || ai.forCharacter === 'any'
    );
  });

  getDifficultyIcon(difficulty: number): string {
    const icons = ['🤖', '🤖', '🤖', '👾', '💀'];
    return icons[Math.min(difficulty - 1, icons.length - 1)] ?? '🤖';
  }

  getDifficultyStars(difficulty: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < difficulty);
  }
}
