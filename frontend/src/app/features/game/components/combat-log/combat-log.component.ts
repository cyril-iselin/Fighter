// ============================================
// Combat Log Display Component
// ============================================

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getGlobalCombatLog, CombatLogEntry, WEAPON_SYMBOLS, EVENT_SYMBOLS } from '../../engine/combat-log';

@Component({
  selector: 'app-combat-log',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #4b5563;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #6b7280;
    }
  `],
  template: `
    <div class="bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-4 w-full">
      <h3 class="text-sm font-orbitron text-gray-400 mb-3 uppercase tracking-wider">Kampf-Log</h3>
      
      <!-- Stats Summary -->
      <div class="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div class="bg-neon-green/10 rounded p-2 text-center">
          <div class="text-neon-green font-bold text-lg">{{ stats.playerHits }}</div>
          <div class="text-gray-400">Treffer</div>
        </div>
        <div class="bg-neon-red/10 rounded p-2 text-center">
          <div class="text-neon-red font-bold text-lg">{{ stats.enemyHits }}</div>
          <div class="text-gray-400">Erhalten</div>
        </div>
        <div class="bg-yellow-500/10 rounded p-2 text-center">
          <div class="text-yellow-400 font-bold text-lg">{{ stats.perfectBlocks }}</div>
          <div class="text-gray-400">Perfect Blocks</div>
        </div>
        <div class="bg-purple-500/10 rounded p-2 text-center">
          <div class="text-purple-400 font-bold text-lg">{{ stats.headshots }}</div>
          <div class="text-gray-400">Kopftreffer</div>
        </div>
      </div>
      
      <!-- Log Entries -->
      @if (showLog) {
        <div class="space-y-1 max-h-96 overflow-y-auto text-xs font-mono custom-scrollbar pr-1">
          @for (entry of entries; track entry.timestamp) {
            <div 
              class="flex items-center gap-2 py-1 px-2 rounded"
              [class.bg-neon-green/10]="entry.attacker === 1 && entry.type !== 'blocked' && entry.type !== 'perfect-block'"
              [class.bg-neon-red/10]="entry.attacker === 2 && entry.type !== 'blocked' && entry.type !== 'perfect-block'"
              [class.bg-yellow-500/20]="entry.type === 'perfect-block'"
              [class.bg-gray-700/30]="entry.type === 'blocked'"
            >
              <span>{{ getEventIcon(entry) }}</span>
              <span>{{ getWeaponIcon(entry) }}</span>
              <span class="flex-1" [class.text-neon-green]="entry.attacker === 1" [class.text-neon-red]="entry.attacker === 2">
                {{ formatEntry(entry) }}
              </span>
              @if (entry.damage > 0) {
                <span 
                  class="font-bold"
                  [class.text-neon-green]="entry.attacker === 1"
                  [class.text-neon-red]="entry.attacker === 2"
                >
                  {{ entry.attacker === 1 ? '+' : '-' }}{{ entry.damage }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class CombatLogComponent {
  @Input() showLog = true;
  @Input() maxEntries = 20;
  
  get entries(): CombatLogEntry[] {
    return getGlobalCombatLog().getRecent(this.maxEntries);
  }
  
  get stats() {
    return getGlobalCombatLog().getStats();
  }
  
  getEventIcon(entry: CombatLogEntry): string {
    return EVENT_SYMBOLS[entry.type];
  }
  
  getWeaponIcon(entry: CombatLogEntry): string {
    return WEAPON_SYMBOLS[entry.weapon];
  }
  
  formatEntry(entry: CombatLogEntry): string {
    const actor = entry.attacker === 1 ? 'Du' : 'Gegner';
    
    switch (entry.type) {
      case 'perfect-block':
        return 'PERFECT BLOCK!';
      case 'blocked':
        return entry.defender === 1 ? 'Du blockst' : 'Gegner blockt';
      case 'headshot':
        return `${actor} KOPF!`;
      case 'stomp':
        return `${actor} Kick`;
      default:
        return `${actor} trifft`;
    }
  }
}
