import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';
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

  // emite SOMENTE a notificação que acabou de chegar via socket (para toast/scroll)
  private newNotificationSubject = new Subject<Notification>();
  public newNotification$ = this.newNotificationSubject.asObservable();

  private initialized = false;

  get unreadCount() {
    return this.notificationsSubject.value.filter(n => !n.isRead).length;
  }

  constructor(
    private http: HttpClient,
    private socketService: SocketService
  ) {}

  /** Chamar após login / bootstrap com token válido */
  init(token: string) {
    if (!token || this.initialized) return;
    this.initialized = true;

    this.socketService.connect(token);
    this.loadNotifications();

    // push na lista + emite evento para o toast
    this.socketService.notification$.subscribe((nova) => {
      if (!nova) return;
      const atual = this.notificationsSubject.value;
      const noti = nova as Notification;

      this.notificationsSubject.next([noti, ...atual]);
      this.newNotificationSubject.next(noti);
    });
  }

  loadNotifications() {
    this.http.get<Notification[]>(this.API_URL).subscribe({
      next: (data) => this.notificationsSubject.next(data || []),
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
    this.socketService.disconnect();
    this.notificationsSubject.next([]);
    this.initialized = false;
  }
}
