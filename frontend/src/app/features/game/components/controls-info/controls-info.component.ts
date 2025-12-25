// ============================================
// Controls Info Component
// ============================================

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ControlBinding {
  keys: string;
  action: string;
}

@Component({
  selector: 'app-controls-info',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './controls-info.component.html'
})
export class ControlsInfoComponent {
  readonly player1Controls: ControlBinding[] = [
    { keys: 'A/D', action: 'Bewegen' },
    { keys: 'LEERTASTE', action: 'Springen' },
    { keys: 'SHIFT', action: 'Rennen' },
    { keys: 'LMB', action: 'Leichter Angriff' },
    { keys: 'LMB halten', action: 'Schwerer Angriff' },
    { keys: 'RMB', action: 'Blocken' },
    { keys: 'RMB+↑', action: 'Kopf Block' },
    { keys: 'F', action: 'Spezial' }
  ];
}
