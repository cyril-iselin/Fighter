// ============================================
// Combat Log - Track fight events for display
// ============================================

export type CombatEventType = 
  | 'hit'           // Normal hit landed
  | 'blocked'       // Hit was blocked (normal)
  | 'perfect-block' // Perfect block!
  | 'headshot'      // Headshot landed
  | 'stomp';        // Jump stomp

export type WeaponType = 'bare' | 'sword';

export interface CombatLogEntry {
  timestamp: number;
  type: CombatEventType;
  attacker: 1 | 2;      // Player 1 or 2
  defender: 1 | 2;
  damage: number;
  weapon: WeaponType;
  attackName?: string;  // e.g. "uppercut", "slash_heavy"
}

// Symbols for display
export const WEAPON_SYMBOLS: Record<WeaponType, string> = {
  bare: '👊',
  sword: '⚔️'
};

export const EVENT_SYMBOLS: Record<CombatEventType, string> = {
  'hit': '💥',
  'blocked': '🛡️',
  'perfect-block': '✨',
  'headshot': '🎯',
  'stomp': '👟'
};

/**
 * Format a combat log entry for display
 */
export function formatLogEntry(entry: CombatLogEntry, playerName: string = 'Du'): string {
  const weaponIcon = WEAPON_SYMBOLS[entry.weapon];
  const eventIcon = EVENT_SYMBOLS[entry.type];
  
  const isPlayerAttacker = entry.attacker === 1;
  const isPlayerDefender = entry.defender === 1;
  
  switch (entry.type) {
    case 'perfect-block':
      return `${eventIcon} ${playerName} PERFECT BLOCK!`;
    
    case 'blocked':
      if (isPlayerDefender) {
        return `🛡️ ${playerName} blockt ${weaponIcon} (-${entry.damage})`;
      } else {
        return `🛡️ Gegner blockt ${weaponIcon}`;
      }
    
    case 'headshot':
      if (isPlayerAttacker) {
        return `${eventIcon} ${playerName} ${weaponIcon} KOPFTREFFER! (${entry.damage})`;
      } else {
        return `${eventIcon} Gegner ${weaponIcon} KOPFTREFFER! (-${entry.damage})`;
      }
    
    case 'stomp':
      if (isPlayerAttacker) {
        return `${eventIcon} ${playerName} Sprung-Kick! (${entry.damage})`;
      } else {
        return `${eventIcon} Gegner Sprung-Kick! (-${entry.damage})`;
      }
    
    case 'hit':
    default:
      if (isPlayerAttacker) {
        return `${weaponIcon} ${playerName} trifft (${entry.damage})`;
      } else {
        return `${weaponIcon} Gegner trifft (-${entry.damage})`;
      }
  }
}

/**
 * Combat Log class - stores and manages combat events
 */
export class CombatLog {
  private entries: CombatLogEntry[] = [];
  private maxEntries: number = 50; // Keep last 50 entries
  
  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
  }
  
  /**
   * Add a new entry to the log
   */
  add(entry: Omit<CombatLogEntry, 'timestamp'>): void {
    const fullEntry: CombatLogEntry = {
      ...entry,
      timestamp: performance.now()
    };
    
    this.entries.push(fullEntry);
    
    // Trim if too many entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }
  
  /**
   * Get all entries
   */
  getAll(): CombatLogEntry[] {
    return [...this.entries];
  }
  
  /**
   * Get last N entries (most recent first)
   */
  getRecent(count: number = 10): CombatLogEntry[] {
    return this.entries.slice(-count).reverse();
  }
  
  /**
   * Get formatted entries for display
   */
  getFormattedRecent(count: number = 10, playerName: string = 'Du'): string[] {
    return this.getRecent(count).map(e => formatLogEntry(e, playerName));
  }
  
  /**
   * Get stats summary
   */
  getStats(): {
    playerHits: number;
    playerDamageDealt: number;
    enemyHits: number;
    enemyDamageDealt: number;
    perfectBlocks: number;
    headshots: number;
  } {
    let playerHits = 0;
    let playerDamageDealt = 0;
    let enemyHits = 0;
    let enemyDamageDealt = 0;
    let perfectBlocks = 0;
    let headshots = 0;
    
    for (const entry of this.entries) {
      if (entry.type === 'perfect-block') {
        perfectBlocks++;
        continue;
      }
      
      if (entry.type === 'blocked') {
        continue; // Don't count blocked hits
      }
      
      if (entry.attacker === 1) {
        playerHits++;
        playerDamageDealt += entry.damage;
        if (entry.type === 'headshot') headshots++;
      } else {
        enemyHits++;
        enemyDamageDealt += entry.damage;
      }
    }
    
    return {
      playerHits,
      playerDamageDealt,
      enemyHits,
      enemyDamageDealt,
      perfectBlocks,
      headshots
    };
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }
}

// Singleton instance for global access
let globalCombatLog: CombatLog | null = null;

export function getGlobalCombatLog(): CombatLog {
  if (!globalCombatLog) {
    globalCombatLog = new CombatLog();
  }
  return globalCombatLog;
}

export function resetGlobalCombatLog(): void {
  if (globalCombatLog) {
    globalCombatLog.clear();
  }
}
