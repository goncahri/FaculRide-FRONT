import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  recoverEmail: string = '';
  errorMsg: string = '';
  recoverMsg: string = '';
  loginAttempts: number = 0;
  showRecoverPasswordSection: boolean = false;

  constructor(
    private authService: AuthService, 
    private router: Router
  ) {}

  login() {
    if (!this.email || !this.password) {
      this.errorMsg = 'Preencha e-mail e senha.';
      return;
    }

    const loginData = {
      email: this.email,
      senha: this.password,
    };

    this.authService.login(loginData.email, loginData.senha).subscribe({
      next: (res: any) => {
        // AuthService já salva token, inicializa socket e notificações
        alert('✅ Login efetuado com sucesso!');
        this.router.navigate(['/usuario']);
      },
      error: (err) => {
        console.error('Erro no login:', err);
        this.loginAttempts++;
        this.errorMsg = err?.error?.erro || 'E-mail ou senha inválidos.';
        alert(this.errorMsg);

        if (this.loginAttempts >= 1) {
          this.showRecoverPasswordSection = true;
        }
      },
    });
  }

  toggleRecoverPassword() {
    this.showRecoverPasswordSection = !this.showRecoverPasswordSection;
  }

  sendRecoverEmail() {
    if (this.recoverEmail.trim() === this.email.trim()) {
      this.recoverMsg = 'E-mail de recuperação de senha enviado com sucesso!';
    } else {
      this.recoverMsg = 'E-mail não encontrado.';
    }

    this.errorMsg = '';
    this.showRecoverPasswordSection = false;
  }
}
