import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { BuffDefinition, ActiveBuff } from '../../endless-types';
import { getRarityColorClass, getRarityGlowClass, getBuffById } from '../../endless-config';

@Component({
  selector: 'app-buff-selection',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h2 class="text-2xl text-white/50 tracking-widest mb-2">WÄHLE DEINE</h2>
        <h1 class="text-5xl font-game text-neon-green tracking-wider animate-glow">BUFFS</h1>
        <p class="text-white/60 mt-3 text-lg">
          Wähle <span class="text-neon-green font-bold">{{ maxSelections }}</span> von <span class="text-white">{{ buffs.length }}</span> Buffs
        </p>
      </div>
      
      <!-- Selection Counter -->
      <div class="flex items-center justify-center gap-3 mb-8">
        @for (i of selectionSlots; track i) {
          <div class="w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl transition-all duration-300"
               [class]="i < selectedBuffs().length 
                 ? 'border-neon-green bg-neon-green/20 shadow-[0_0_15px_rgba(57,255,20,0.5)]' 
                 : 'border-white/30 bg-white/5'">
            @if (selectedBuffs()[i]; as buff) {
              <span>{{ buff.icon }}</span>
            } @else {
              <span class="text-white/20">?</span>
            }
          </div>
        }
      </div>
      
      <!-- Buff Cards -->
      <div class="flex justify-center gap-3">
        @for (buff of buffs; track buff.id) {
          <button 
            (click)="toggleBuff(buff)"
            [disabled]="isDisabled(buff)"
            class="group relative w-44 p-4 rounded-xl border-2 transition-all duration-300
                   cursor-pointer
                   {{ getColorClass(buff.rarity) }}
                   {{ isSelected(buff.id) ? 'ring-4 ring-neon-green ring-offset-2 ring-offset-black scale-105' : '' }}
                   {{ isDisabled(buff) ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 hover:-translate-y-2' }}
                   shadow-lg {{ getGlowClass(buff.rarity) }}">
            
            <!-- Selected checkmark -->
            @if (isSelected(buff.id)) {
              <div class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-neon-green text-black 
                          flex items-center justify-center font-bold text-lg z-10 shadow-lg">
                ✓
              </div>
            }
            
            <!-- Rarity indicator -->
            <div class="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                        {{ getRarityBadgeClass(buff.rarity) }}">
              {{ getRarityLabel(buff.rarity) }}
            </div>
            
            <!-- Icon -->
            <div class="text-4xl mb-2 transform group-hover:scale-110 transition-transform">
              {{ buff.icon }}
            </div>
            
            <!-- Name -->
            <h3 class="text-sm font-game text-white mb-1">{{ buff.name }}</h3>
            
            <!-- Description -->
            <p class="text-[10px] text-white/70 leading-relaxed">{{ buff.description }}</p>
            
            <!-- Stack indicator if already owned -->
            @if (getExistingStacks(buff.id) > 0) {
              <div class="absolute -bottom-2 -left-2 w-7 h-7 rounded-full bg-blue-500 text-white 
                          flex items-center justify-center font-bold text-xs">
                x{{ getExistingStacks(buff.id) }}
              </div>
            }
            
            <!-- Non-stackable warning -->
            @if (!buff.stackable && getExistingStacks(buff.id) > 0) {
              <div class="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center">
                <span class="text-red-500 font-bold text-sm">BEREITS AKTIV</span>
              </div>
            }
          </button>
        }
      </div>
      
      <!-- Confirm Button -->
      <div class="mt-10">
        <button 
          (click)="confirmSelection()"
          [disabled]="selectedBuffs().length < maxSelections"
          class="px-12 py-4 text-2xl font-game rounded-lg transition-all duration-300
                 {{ selectedBuffs().length >= maxSelections 
                   ? 'bg-neon-green text-black hover:scale-105 shadow-[0_0_30px_rgba(57,255,20,0.5)]' 
                   : 'bg-white/20 text-white/40 cursor-not-allowed' }}">
          @if (selectedBuffs().length >= maxSelections) {
            BESTÄTIGEN
          } @else {
            Noch {{ maxSelections - selectedBuffs().length }} wählen
          }
        </button>
      </div>
      
      <!-- Current buffs preview -->
      @if (currentBuffs.length > 0) {
        <div class="mt-8 text-center">
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
  @Input() maxSelections = 2;
  @Output() buffsSelected = new EventEmitter<BuffDefinition[]>();
  
  // Track selected buffs internally
  selectedBuffs = signal<BuffDefinition[]>([]);
  
  // For template iteration
  get selectionSlots(): number[] {
    return Array.from({ length: this.maxSelections }, (_, i) => i);
  }
  
  toggleBuff(buff: BuffDefinition): void {
    // Don't allow selecting non-stackable buffs that are already owned
    if (!buff.stackable && this.getExistingStacks(buff.id) > 0) {
      return;
    }
    
    const current = this.selectedBuffs();
    const index = current.findIndex(b => b.id === buff.id);
    
    if (index >= 0) {
      // Deselect
      this.selectedBuffs.set(current.filter(b => b.id !== buff.id));
    } else if (current.length < this.maxSelections) {
      // Select
      this.selectedBuffs.set([...current, buff]);
    }
  }
  
  isSelected(buffId: string): boolean {
    return this.selectedBuffs().some(b => b.id === buffId);
  }
  
  isDisabled(buff: BuffDefinition): boolean {
    // Disabled if non-stackable and already owned
    if (!buff.stackable && this.getExistingStacks(buff.id) > 0) {
      return true;
    }
    // Disabled if max selections reached and not already selected
    if (this.selectedBuffs().length >= this.maxSelections && !this.isSelected(buff.id)) {
      return true;
    }
    return false;
  }
  
  confirmSelection(): void {
    if (this.selectedBuffs().length >= this.maxSelections) {
      this.buffsSelected.emit(this.selectedBuffs());
      this.selectedBuffs.set([]); // Reset for next time
    }
  }
  
  getExistingStacks(buffId: string): number {
    const existing = this.currentBuffs.find(b => b.id === buffId);
    return existing?.stacks ?? 0;
  }
  
  getBuffIcon(buffId: string): string {
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
