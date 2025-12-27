import { Component, Input, Output, EventEmitter } from '@angular/core';
import { BuffDefinition, ActiveBuff } from '../../endless-types';
import { getRarityColorClass, getRarityGlowClass, getBuffById } from '../../endless-config';

@Component({
  selector: 'app-buff-selection',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-8">
      <!-- Header -->
      <div class="text-center mb-12">
        <h2 class="text-2xl text-white/50 tracking-widest mb-2">WÄHLE DEINEN</h2>
        <h1 class="text-5xl font-game text-neon-green tracking-wider animate-glow">BUFF</h1>
      </div>
      
      <!-- Buff Cards -->
      <div class="flex flex-wrap justify-center gap-6 max-w-4xl">
        @for (buff of buffs; track buff.id) {
          <button 
            (click)="selectBuff(buff)"
            class="group relative w-64 p-6 rounded-xl border-2 transition-all duration-300
                   hover:scale-105 hover:-translate-y-2 cursor-pointer
                   {{ getColorClass(buff.rarity) }}
                   shadow-lg {{ getGlowClass(buff.rarity) }}
                   hover:shadow-xl">
            
            <!-- Rarity indicator -->
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        {{ getRarityBadgeClass(buff.rarity) }}">
              {{ getRarityLabel(buff.rarity) }}
            </div>
            
            <!-- Icon -->
            <div class="text-6xl mb-4 transform group-hover:scale-110 transition-transform">
              {{ buff.icon }}
            </div>
            
            <!-- Name -->
            <h3 class="text-xl font-game text-white mb-2">{{ buff.name }}</h3>
            
            <!-- Description -->
            <p class="text-sm text-white/70">{{ buff.description }}</p>
            
            <!-- Stack indicator if already owned -->
            @if (getExistingStacks(buff.id) > 0) {
              <div class="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-neon-green text-black 
                          flex items-center justify-center font-bold text-sm">
                +{{ getExistingStacks(buff.id) + 1 }}
              </div>
            }
            
            <!-- Non-stackable warning -->
            @if (!buff.stackable && getExistingStacks(buff.id) > 0) {
              <div class="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center">
                <span class="text-red-500 font-bold">BEREITS AKTIV</span>
              </div>
            }
          </button>
        }
      </div>
      
      <!-- Current buffs preview -->
      @if (currentBuffs.length > 0) {
        <div class="mt-12 text-center">
          <p class="text-white/50 text-sm mb-3">Aktive Buffs:</p>
          <div class="flex gap-2 justify-center flex-wrap">
            @for (buff of currentBuffs; track buff.id) {
              <div class="relative px-3 py-1 bg-white/10 rounded-full text-lg">
                {{ getBuffIcon(buff.id) }}
                @if (buff.stacks > 1) {
                  <span class="absolute -top-1 -right-1 w-5 h-5 bg-neon-green text-black 
                               rounded-full text-xs flex items-center justify-center font-bold">
                    {{ buff.stacks }}
                  </span>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes glow {
      0%, 100% { text-shadow: 0 0 20px rgba(57, 255, 20, 0.5); }
      50% { text-shadow: 0 0 40px rgba(57, 255, 20, 0.8); }
    }
    
    .animate-glow {
      animation: glow 2s ease-in-out infinite;
    }
  `]
})
export class BuffSelectionComponent {
  @Input() buffs: BuffDefinition[] = [];
  @Input() currentBuffs: ActiveBuff[] = [];
  @Output() buffSelected = new EventEmitter<BuffDefinition>();
  
  selectBuff(buff: BuffDefinition): void {
    // Don't allow selecting non-stackable buffs that are already owned
    if (!buff.stackable && this.getExistingStacks(buff.id) > 0) {
      return;
    }
    this.buffSelected.emit(buff);
  }
  
  getExistingStacks(buffId: string): number {
    const existing = this.currentBuffs.find(b => b.id === buffId);
    return existing?.stacks ?? 0;
  }
  
  getBuffIcon(buffId: string): string {
    // Use global buff lookup to find any buff, not just the current choices
    return getBuffById(buffId)?.icon ?? '?';
  }
  
  getColorClass(rarity: string): string {
    return getRarityColorClass(rarity as any);
  }
  
  getGlowClass(rarity: string): string {
    return getRarityGlowClass(rarity as any);
  }
  
  getRarityLabel(rarity: string): string {
    switch (rarity) {
      case 'normal': return 'Normal';
      case 'rare': return 'Selten';
      case 'legendary': return 'Legendär';
      default: return '';
    }
  }
  
  getRarityBadgeClass(rarity: string): string {
    switch (rarity) {
      case 'normal': return 'bg-gray-600 text-gray-200';
      case 'rare': return 'bg-blue-600 text-blue-100';
      case 'legendary': return 'bg-yellow-500 text-yellow-900';
      default: return '';
    }
  }
}
