import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { SocketService } from './socket.service';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly API_URL = 'https://projeto-faculride.onrender.com/api/notifications';

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  private initialized = false; // controla se já inicializou

  get unreadCount() {
    return this.notificationsSubject.value.filter(n => !n.isRead).length;
  }

  constructor(
    private http: HttpClient,
    private socketService: SocketService 
  ) {}

  /** Chamar após login / bootstrap com token válido */
  init(token: string) {
    if (!token) return;

    if (this.initialized) return; // evita inicializar 2x
    this.initialized = true;

    this.socketService.connect(token);
    this.loadNotifications();

    this.socketService.notification$.subscribe((nova) => {
      if (!nova) return;
      const atual = this.notificationsSubject.value;
      this.notificationsSubject.next([nova as Notification, ...atual]);
    });
  }

  loadNotifications() {
    this.http.get<Notification[]>(this.API_URL).subscribe({
      next: (data) => this.notificationsSubject.next(data),
      error: (err) =>
        console.error('[NotificationService] erro ao carregar notificações', err),
    });
  }

  markAsRead(id: number) {
    this.http.patch(`${this.API_URL}/${id}/read`, {}).subscribe({
      next: () => {
        const atual = this.notificationsSubject.value.map(n =>
          n.id === id ? { ...n, isRead: true } : n
        );
        this.notificationsSubject.next(atual);
      },
      error: (err) =>
        console.error('[NotificationService] erro ao marcar como lida', err),
    });
  }

  markAllAsRead() {
    this.http.patch(`${this.API_URL}/read-all`, {}).subscribe({
      next: () => {
        const atual = this.notificationsSubject.value.map(n => ({
          ...n,
          isRead: true,
        }));
        this.notificationsSubject.next(atual);
      },
      error: (err) =>
        console.error('[NotificationService] erro ao marcar todas como lidas', err),
    });
  }

  /** Usado no logout */
  clear() {
    this.socketService.disconnect();          // encerra socket
    this.notificationsSubject.next([]);      // limpa lista
    this.initialized = false;                // permite init de novo no próximo login
  }
}
