// ============================================
// Angular 21 Main Entry Point
// ============================================

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { AppComponent } from './app.component';
import { initializeCharacters } from './app/characters/registry';
import { initializeDummies } from './app/dummies';

// Initialize registries before bootstrapping Angular
async function bootstrap() {
  // Initialize character registry
  await initializeCharacters();
  
  // Initialize dummy registry
  await initializeDummies();
  
  // Bootstrap Angular app
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err) => console.error(err));



