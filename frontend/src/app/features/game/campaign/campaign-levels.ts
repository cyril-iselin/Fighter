// ============================================
// Campaign Level Definitions - Endless Mode
// ============================================

import type { AIDifficulty } from '../engine/fighter-ai';

export interface CampaignLevel {
  level: number;
  title: string;
  storyText: string;
  background: string;
  aiDifficulty: AIDifficulty;
  aiHealth: number;
  aiReactionTime: number; // Custom reaction time in ms (lower = harder)
}

// Story titles and texts that cycle
const LEVEL_TITLES = [
  'START',
  'ÜBUNGSPLATZ', 
  'MACHT',
  'UNFAIRE MITTEL',
  'SCHATTENREICH',
  'ENDLOSE NACHT',
  'DÄMMERUNG DES BLUTES',
  'BUNDESHAUS',
  'TODESMARSCH',
  'WEISSES HAUS',
  'KARTELL',
  'LEGENDE'
];

const LEVEL_STORIES = [
  'Als unwissender betrittst du die gefährlichste Stadt weltweit.',
  'Gerüchte verbreiten sich schnell. Ein Herausforderer naht.',
  'Hast du die Macht oder bist du machtlos?',
  'Deine Feinde haben ein rostiges Schwert gefunden!',
  'Schatten bewegen sich. Steven Segal taucht auf!',
  'Die Nacht dehnt sich aus. Kein Ende in Sicht.',
  'Die Ruhe vor dem Sturm. Blut wird vergossen.',
  'Christoph droht damit wieder in den Bundesrat zu gehen.',
  'Jeder Schritt vorwärts ist ein Tanz mit dem Tod.',
  'Selbst Donald spricht nun über Dich. Pass auf.',
  'Vladi und Ping sind nicht erfreut. Sie schicken Killer.',
  'Man sagte, es sei unmöglich. Beweise das Gegenteil.'
];

const BACKGROUNDS = ['CITY1', 'CITY2', 'CITY3', 'CITY4'];

/**
 * Generate a campaign level dynamically based on level number.
 * AI gets progressively harder with no upper limit.
 */
export function getCampaignLevel(levelNumber: number): CampaignLevel {
  // After level 12, always use last title/story (LEGEND)
  const titleIndex = Math.min(levelNumber - 1, LEVEL_TITLES.length - 1);
  const storyIndex = Math.min(levelNumber - 1, LEVEL_STORIES.length - 1);
  
  // Cycle through backgrounds
  const bgIndex = (levelNumber - 1) % BACKGROUNDS.length;
  
  // AI Difficulty: easy (1-3), medium (4-7), hard (8+)
  let aiDifficulty: AIDifficulty;
  if (levelNumber <= 3) {
    aiDifficulty = 'hard'; // no sword
  } else if (levelNumber == 4) {
    aiDifficulty = 'easy'; // first sword level
  }else if (levelNumber <= 7) {
    aiDifficulty = 'medium';
  } else {
    aiDifficulty = 'hard';
  }
  
  // AI Health scales: starts at 120, +25 per level, caps at 1000
  const aiHealth = Math.min(1000, 120 + (levelNumber - 1) * 25);
  
  // AI Reaction time: starts at 500ms, decreases by 35ms per level, minimum 50ms
  // This makes AI progressively faster and more aggressive
  const aiReactionTime = Math.max(50, 500 - (levelNumber - 1) * 35);
  
  return {
    level: levelNumber,
    title: LEVEL_TITLES[titleIndex],
    storyText: LEVEL_STORIES[storyIndex],
    background: BACKGROUNDS[bgIndex],
    aiDifficulty,
    aiHealth,
    aiReactionTime
  };
}
