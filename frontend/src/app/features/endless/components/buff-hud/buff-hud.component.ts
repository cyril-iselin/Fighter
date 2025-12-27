import { Component, Input } from '@angular/core';
import { ActiveBuff } from '../../endless-types';
import { getBuffById } from '../../endless-config';

@Component({
  selector: 'app-buff-hud',
  standalone: true,
  template: `
    <div class="flex gap-2 flex-wrap">
      @for (buff of activeBuffs; track buff.id) {
        <div 
          class="relative group"
          [title]="getBuffTooltip(buff)">
          
          <!-- Buff icon container -->
          <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl
                      {{ getRarityBg(buff.id) }} border {{ getRarityBorder(buff.id) }}
                      transition-transform hover:scale-110">
            {{ getBuffIcon(buff.id) }}
          </div>
          
          <!-- Stack badge -->
          @if (buff.stacks > 1) {
            <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full 
                        bg-neon-green text-black text-xs font-bold
                        flex items-center justify-center shadow-lg">
              {{ buff.stacks }}
            </div>
          }
          
          <!-- Tooltip on hover -->
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 
                      bg-black/90 rounded-lg text-sm whitespace-nowrap
                      opacity-0 group-hover:opacity-100 transition-opacity
                      pointer-events-none z-50 border border-white/20">
            <div class="font-bold text-white">{{ getBuffName(buff.id) }}</div>
            <div class="text-white/70">{{ getBuffDescription(buff.id) }}</div>
            @if (buff.stacks > 1) {
              <div class="text-neon-green mt-1">× {{ buff.stacks }} gestackt</div>
            }
            <!-- Arrow -->
            <div class="absolute top-full left-1/2 -translate-x-1/2 
                        border-4 border-transparent border-t-black/90"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class BuffHudComponent {
  @Input() activeBuffs: ActiveBuff[] = [];
  
  getBuffIcon(buffId: string): string {
    return getBuffById(buffId)?.icon ?? '?';
  }
  
  getBuffName(buffId: string): string {
    return getBuffById(buffId)?.name ?? 'Unbekannt';
  }
  
  getBuffDescription(buffId: string): string {
    return getBuffById(buffId)?.description ?? '';
  }
  
  getBuffTooltip(buff: ActiveBuff): string {
    const def = getBuffById(buff.id);
    if (!def) return '';
    return `${def.name}: ${def.description}${buff.stacks > 1 ? ` (×${buff.stacks})` : ''}`;
  }
  
  getRarityBg(buffId: string): string {
    const rarity = getBuffById(buffId)?.rarity;
    switch (rarity) {
      case 'normal': return 'bg-gray-800/80';
      case 'rare': return 'bg-blue-900/80';
      case 'legendary': return 'bg-yellow-900/80';
      default: return 'bg-gray-800/80';
    }
  }
  
  getRarityBorder(buffId: string): string {
    const rarity = getBuffById(buffId)?.rarity;
    switch (rarity) {
      case 'normal': return 'border-gray-500';
      case 'rare': return 'border-blue-400';
      case 'legendary': return 'border-yellow-400';
      default: return 'border-gray-500';
    }
  }
}
