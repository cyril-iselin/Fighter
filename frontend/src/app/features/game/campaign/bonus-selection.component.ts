// ============================================
// Bonus Selection Component - Post-Victory
// ============================================

import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Bonus, RARITY_COLORS, type BonusRarity } from './campaign-types';

@Component({
  selector: 'app-bonus-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bonus-selection.component.html',
  styleUrl: './bonus-selection.component.css'
})
export class BonusSelectionComponent implements OnInit, OnDestroy {
  bonusOptions = input.required<Bonus[]>();
  bonusSelected = output<Bonus>();
  skipped = output<void>();
  
  selectedBonus = signal<Bonus | null>(null);
  
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  
  ngOnInit(): void {
    // Add keyboard listener for confirm/skip
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const bonus = this.selectedBonus();
        if (bonus) {
          this.bonusSelected.emit(bonus);
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.skipped.emit();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }
  
  ngOnDestroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
  }
  
  selectBonus(bonus: Bonus): void {
    this.selectedBonus.set(bonus);
  }
  
  confirmSelection(): void {
    const bonus = this.selectedBonus();
    if (bonus) {
      this.bonusSelected.emit(bonus);
    }
  }
  
  skipSelection(): void {
    this.skipped.emit();
  }
  
  getCardClasses(rarity: BonusRarity, isSelected: boolean): string {
    const colors = RARITY_COLORS[rarity];
    const baseClasses = `${colors.bg} ${colors.border} shadow-lg ${colors.glow} animate-card-appear`;
    
    if (isSelected) {
      return `${baseClasses} ring-2 ring-neon-green scale-105`;
    }
    
    return baseClasses;
  }
  
  getRarityLabelClasses(rarity: BonusRarity): string {
    switch (rarity) {
      case 'common':
        return 'bg-gray-700 text-gray-300';
      case 'uncommon':
        return 'bg-blue-900 text-blue-300';
      case 'rare':
        return 'bg-yellow-900 text-yellow-300';
    }
  }

  getRarityLabel(rarity: BonusRarity): string {
    switch (rarity) {
      case 'common':
        return 'GEWÖHNLICH';
      case 'uncommon':
        return 'UNGEWÖHNLICH';
      case 'rare':
        return 'SELTEN';
    }
  }
}
