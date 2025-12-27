import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FighterState } from '../../../core/types';

@Component({
  selector: 'app-ai-healthbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-healthbar.component.html',
  styleUrl: './ai-healthbar.component.css'
})
export class AiHealthbarComponent {
  @Input() health: number = 100;
  @Input() maxHealth: number = 100;
  @Input() stunMeter: number = 0;
  @Input() maxStun: number = 100;
  @Input() state: FighterState = 'idle';
  @Input() characterName: string = 'AI';
  @Input() loadoutType: string = 'bare';
  @Input() aiEnabled: boolean = true;
  @Input() superArmorActive: boolean = false;  // Phase-based super armor

  get healthPercent(): number {
    return Math.max(0, Math.min(100, (this.health / this.maxHealth) * 100));
  }

  get stunPercent(): number {
    return Math.max(0, Math.min(100, (this.stunMeter / this.maxStun) * 100));
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

  getStunColor(): string {
    const percent = this.stunPercent;
    if (percent > 70) return 'from-red-600 to-orange-500';
    if (percent > 40) return 'from-orange-500 to-yellow-500';
    return 'from-yellow-500 to-yellow-400';
  }

  getBorderClass(): string {
    if (this.superArmorActive) {
      return 'border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.7)]';
    }
    return 'border-2 border-red-500/50';
  }
}
