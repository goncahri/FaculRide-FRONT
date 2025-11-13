// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'https://projeto-faculride.onrender.com/api/usuario';

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  /** Faz login e armazena token e dados do usuário */
  login(email: string, senha: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/login`, { email, senha }).pipe(
      tap((res) => {
        const token = res?.token;
        const usuario = res?.usuario;

        if (token && usuario) {
          localStorage.setItem('token', token);
          localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
          this.notificationService.init(token);
        } else {
          console.error('Resposta inválida do servidor: faltando token ou usuário.');
        }
      })
    );
  }

  /** Reativa sessão ao recarregar a página */
  bootstrapSession() {
    const token = localStorage.getItem('token');
    if (token) {
      this.notificationService.init(token);
    }
  }

  /** Faz logout limpando token, dados locais e desconectando socket */
  logout() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('usuarioLogado'); 
    } catch {}

    // encerra socket e limpa notificações em memória
    this.notificationService.clear();
  }

  /** Retorna o token atual (para uso eventual) */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /** Verifica se há sessão ativa */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
}
