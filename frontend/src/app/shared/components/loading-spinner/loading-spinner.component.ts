// ============================================
// Loading Spinner Component - Animated Loading Indicator
// ============================================

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-spinner.component.html'
})
export class LoadingSpinnerComponent {
  @Input() size = 80;
  @Input() text = '';
}
