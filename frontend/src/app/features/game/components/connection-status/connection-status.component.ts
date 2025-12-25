// ============================================
// Connection Status Component
// ============================================

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionState } from '../../models/network.types';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './connection-status.component.html'
})
export class ConnectionStatusComponent {
  @Input() state: ConnectionState = ConnectionState.Disconnected;
  @Input() ping = 0;
  @Input() opponentName = '';
  @Output() retry = new EventEmitter<void>();
  
  readonly ConnectionState = ConnectionState;
}
