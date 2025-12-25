// ============================================
// Main Menu Component - Game Entry Point
// ============================================

import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.css'
})
export class MainMenuComponent {
  private router: Router;
  
  hoveredButton = signal<'campaign' | 'single' | 'multi' | null>(null);
  
  constructor(router: Router) {
    this.router = router;
  }
  
  startCampaign(): void {
    this.router.navigate(['/campaign']);
  }
  
  startSinglePlayer(): void {
    this.router.navigate(['/play', 'local']);
  }
  
  startMultiplayer(): void {
    this.router.navigate(['/play', 'online']);
  }
}
