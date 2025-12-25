// ============================================
// Angular 21 Routes Configuration
// ============================================

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app/features/menu').then(m => m.MainMenuComponent)
  },
  {
    path: 'play/:mode',
    loadComponent: () => import('./app/features/game').then(m => m.FightGameComponent)
  },
  {
    path: 'campaign',
    loadComponent: () => import('./app/features/game/campaign').then(m => m.CampaignComponent)
  },
  {
    // Redirect /play without mode to online (backward compatible)
    path: 'play',
    redirectTo: 'play/online',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
