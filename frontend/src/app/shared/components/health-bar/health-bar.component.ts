// ============================================
// Health Bar Component - Reusable Health Display
// ============================================

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-health-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-bar.component.html',
  styleUrl: './health-bar.component.css'
})
export class HealthBarComponent {
  @Input() value = 100;
  @Input() reverse = false;
  
  get critical(): boolean {
    return this.value <= 25;
  }
}
