import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FighterState } from '../../../core/types';

@Component({
  selector: 'app-player-healthbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-healthbar.component.html',
  styleUrl: './player-healthbar.component.css'
})
export class PlayerHealthbarComponent {
  @Input() health: number = 100;
  @Input() maxHealth: number = 100;
  @Input() specialMeter: number = 0;
  @Input() maxSpecial: number = 100;
  @Input() state: FighterState = 'idle';
  @Input() parryWindowActive: boolean = false;
  @Input() characterName: string = 'Player';
  @Input() loadoutType: string = 'bare';

  get healthPercent(): number {
    return Math.max(0, Math.min(100, (this.health / this.maxHealth) * 100));
  }

  get specialPercent(): number {
    return Math.max(0, Math.min(100, (this.specialMeter / this.maxSpecial) * 100));
  }

  getStateDisplay(): string {
    const stateNames: Record<FighterState, string> = {
      idle: '🧘 Idle',
      move: '🏃 Moving',
      jump: '🦘 Airborne',
      attack: '⚔️ Attacking',
      telegraph: '⚡ Telegraph',
      block: '🛡️ Blocking',
      hurt: '💥 Hit',
      dead: '☠️ Defeated'
    };
    return stateNames[this.state] || this.state;
  }

  getStateColor(): string {
    const colors: Record<FighterState, string> = {
      idle: 'text-cyan-400',
      move: 'text-green-400',
      jump: 'text-yellow-400',
      attack: 'text-orange-500',
      telegraph: 'text-orange-400',
      block: 'text-blue-400',
      hurt: 'text-red-500',
      dead: 'text-gray-500'
    };
    return colors[this.state] || 'text-white';
  }

  getHealthColor(): string {
    const percent = this.healthPercent;
    if (percent > 60) return 'bg-gradient-to-r from-green-500 to-green-400';
    if (percent > 30) return 'bg-gradient-to-r from-yellow-500 to-yellow-400';
    return 'bg-gradient-to-r from-red-600 to-red-500';
  }
}
