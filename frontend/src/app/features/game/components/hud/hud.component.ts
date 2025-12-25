// ============================================
// HUD Component - Game Heads-Up Display
// ============================================

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthBarComponent } from '../../../../shared/components/health-bar/health-bar.component';
import { StunBarComponent } from '../../../../shared/components/stun-bar/stun-bar.component';

@Component({
  selector: 'app-hud',
  standalone: true,
  imports: [CommonModule, HealthBarComponent, StunBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hud.component.html'
})
export class HudComponent {
  @Input() player1Health = 100;
  @Input() player2Health = 100;
  @Input() player1SpecialMeter = 0;  // Player special meter
  @Input() player2StunMeter = 0;     // AI stun meter
  @Input() player1Stunned = false;   // Not used
  @Input() player2Stunned = false;
  @Input() player1Name = 'Player 1';
  @Input() player2Name = 'Player 2';
  @Input() isPlayer1 = true;
  @Input() hasOpponent = false;
  
  get specialReady(): boolean {
    return this.player1SpecialMeter >= 100;
  }
}
