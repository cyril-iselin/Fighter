// ============================================
// Angular 21 Routes Configuration
// ============================================

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app/features/menu/menu.component').then(m => m.MenuComponent)
  },
  {
    path: 'training',
    loadComponent: () => import('./app/features/training/training.component').then(m => m.TrainingComponent)
  },
  {
    path: 'endless',
    loadComponent: () => import('./app/features/endless/endless.component').then(m => m.EndlessComponent)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./app/features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
