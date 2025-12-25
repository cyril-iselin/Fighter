// ============================================
// Stun Bar Component - Stun Meter Display
// ============================================

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stun-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative h-2 bg-dark-bg/50 rounded-full overflow-hidden">
      <div 
        class="absolute inset-y-0 rounded-full transition-all duration-150 ease-out"
        [class.left-0]="!reverse"
        [class.right-0]="reverse"
        [class.bg-gradient-to-r]="!reverse"
        [class.bg-gradient-to-l]="reverse"
        [class.from-yellow-400]="!dangerous"
        [class.to-orange-400]="!dangerous"
        [class.from-orange-500]="dangerous"
        [class.to-red-500]="dangerous"
        [class.animate-pulse]="dangerous"
        [style.width.%]="value">
      </div>
      <!-- Lightning icon when stunned -->
      @if (isStunned) {
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-yellow-300 text-xs animate-pulse">⚡ BETÄUBT ⚡</span>
        </div>
      }
    </div>
  `
})
export class StunBarComponent {
  @Input() value = 0;
  @Input() reverse = false;
  @Input() isStunned = false;
  
  get dangerous(): boolean {
    return this.value >= 70;
  }
}
