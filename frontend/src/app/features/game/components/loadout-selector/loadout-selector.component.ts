// ============================================
// Loadout Selector Component
// ============================================

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Loadout } from '../../models/game.types';

interface LoadoutOption {
  id: Loadout;
  name: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-loadout-selector',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loadout-selector.component.html'
})
export class LoadoutSelectorComponent {
  @Input() selected: Loadout = 'bare';
  @Input() label: string = 'AUSRÜSTUNG';
  @Output() loadoutChange = new EventEmitter<Loadout>();
  
  readonly loadouts: LoadoutOption[] = [
    { id: 'bare', name: 'FAUST', icon: '👊', color: 'neon-green' },
    { id: 'sword', name: 'SCHWERT', icon: '⚔️', color: 'neon-blue' }
  ];
  
  selectLoadout(loadout: Loadout): void {
    this.loadoutChange.emit(loadout);
  }
}
