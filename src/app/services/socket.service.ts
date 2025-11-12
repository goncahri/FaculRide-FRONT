import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

interface NotificationPayload {
  id?: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  isRead?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;

  // stream para quem quiser ouvir notificações em tempo real
  private notificationSubject = new BehaviorSubject<NotificationPayload | null>(null);
  notification$ = this.notificationSubject.asObservable();

  // ajuste de URL pro backend:
  private readonly SOCKET_URL = 'https://projeto-faculride.onrender.com';

  connect(token: string) {
    if (this.socket && this.socket.connected) {
      return;
    }

    this.socket = io(this.SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token }, 
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('[Socket] conectado ✅');
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('[Socket] erro na conexão', err.message || err);
    });

    // ouve notificações do backend
    this.socket.on('notification:new', (notification: NotificationPayload) => {
      console.log('[Socket] notification:new', notification);
      this.notificationSubject.next(notification);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket] desconectado');
    }
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
