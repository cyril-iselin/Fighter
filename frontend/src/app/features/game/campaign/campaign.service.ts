// ============================================
// Campaign Service - State Management
// ============================================

import { Injectable, signal, computed } from '@angular/core';
import { 
  type BonusId, 
  type BonusEffects, 
  type Bonus,
  calculateBonusEffects, 
  getRandomBonus,
  BONUS_DEFINITIONS,
  getBonusDescription
} from './campaign-types';
import { getCampaignLevel, type CampaignLevel } from './campaign-levels';

const STORAGE_KEY = 'fighter_campaign_state';

export interface CampaignState {
  currentLevel: number;
  collectedBonuses: BonusId[];
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class CampaignService {
  
  // ----------------------------------------
  // Signals
  // ----------------------------------------
  
  private readonly _state = signal<CampaignState>(this.loadState());
  
  readonly state = this._state.asReadonly();
  readonly currentLevel = computed(() => this._state().currentLevel);
  readonly collectedBonuses = computed(() => this._state().collectedBonuses);
  readonly isActive = computed(() => this._state().isActive);
  
  readonly bonusEffects = computed<BonusEffects>(() => {
    return calculateBonusEffects(this._state().collectedBonuses);
  });
  
  readonly levelConfig = computed<CampaignLevel>(() => {
    return getCampaignLevel(this._state().currentLevel);
  });
  
  readonly collectedBonusDetails = computed<(Bonus & { count: number })[]>(() => {
    const bonuses = this._state().collectedBonuses;
    // Zähle wie oft jeder Bonus vorkommt
    const bonusCounts = new Map<BonusId, number>();
    for (const id of bonuses) {
      bonusCounts.set(id, (bonusCounts.get(id) || 0) + 1);
    }
    // Erstelle EINZIGARTIGE Liste mit count für Badge-Anzeige
    const uniqueBonuses: (Bonus & { count: number })[] = [];
    for (const [id, count] of bonusCounts) {
      const base = BONUS_DEFINITIONS[id];
      uniqueBonuses.push({
        ...base,
        description: getBonusDescription(id, count),
        count
      });
    }
    return uniqueBonuses;
  });
  
  // ----------------------------------------
  // Campaign Flow
  // ----------------------------------------
  
  /**
   * Start a new campaign run
   */
  startCampaign(): void {
    this._state.set({
      currentLevel: 1,
      collectedBonuses: [],
      isActive: true
    });
    this.saveState();
  }
  
  /**
   * Called when player wins current level
   * Returns 3 bonus options to choose from
   */
  onVictory(): Bonus[] {
    const collected = this._state().collectedBonuses;
    
    // Generate 3 unique bonus options
    const options: Bonus[] = [];
    const usedIds: BonusId[] = [];
    
    for (let i = 0; i < 3; i++) {
      const bonus = getRandomBonus([...collected, ...usedIds]);
      options.push(bonus);
      usedIds.push(bonus.id);
    }
    
    return options;
  }
  
  /**
   * Player selects a bonus and advances to next level
   * Bonuses can stack - same bonus can be selected multiple times!
   */
  selectBonus(bonusId: BonusId): void {
    const state = this._state();
    const newBonuses = [...state.collectedBonuses, bonusId]; // Always add - stacking is allowed!
    
    this._state.set({
      ...state,
      collectedBonuses: newBonuses,
      currentLevel: state.currentLevel + 1
    });
    this.saveState();
  }
  
  /**
   * Skip bonus selection (advance without bonus)
   */
  skipBonus(): void {
    const state = this._state();
    this._state.set({
      ...state,
      currentLevel: state.currentLevel + 1
    });
    this.saveState();
  }
  
  /**
   * Called when player loses - reset campaign
   */
  onDefeat(): void {
    this._state.set({
      currentLevel: 1,
      collectedBonuses: [],
      isActive: false
    });
    this.clearState();
  }
  
  /**
   * Check if campaign is complete - never true in endless mode
   */
  isCampaignComplete(): boolean {
    return false; // Endless mode - never complete
  }
  
  /**
   * Exit campaign mode
   */
  exitCampaign(): void {
    this._state.update(s => ({ ...s, isActive: false }));
    this.clearState();
  }
  
  // ----------------------------------------
  // Persistence
  // ----------------------------------------
  
  private loadState(): CampaignState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          currentLevel: parsed.currentLevel ?? 1,
          collectedBonuses: parsed.collectedBonuses ?? [],
          isActive: parsed.isActive ?? false
        };
      }
    } catch (e) {
      console.warn('Failed to load campaign state:', e);
    }
    
    return {
      currentLevel: 1,
      collectedBonuses: [],
      isActive: false
    };
  }
  
  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state()));
    } catch (e) {
      console.warn('Failed to save campaign state:', e);
    }
  }
  
  private clearState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear campaign state:', e);
    }
  }
}
