import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApoioService } from '../services/apoio.service';

@Component({
  selector: 'app-apoio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apoio.component.html',
  styleUrls: ['./apoio.component.css']
})
export class ApoioComponent {

  nome = '';
  email = '';
  valorSelecionado: number | null = null;
  tipoApoioSelecionado: string | null = null;
  carregando = false;

  planos = [
    { label: 'Apoiador Bronze', valor: 10 },
    { label: 'Apoiador Prata',  valor: 25 },
    { label: 'Apoiador Ouro',   valor: 50 }
  ];

  constructor(private apoioService: ApoioService) {}

  selecionarPlano(plano: { label: string; valor: number }) {
    this.tipoApoioSelecionado = plano.label;
    this.valorSelecionado = plano.valor;
  }

  iniciarDoacao() {
    if (!this.nome || !this.email) {
      alert('Preencha seu nome e e-mail para gerar o link de apoio.');
      return;
    }

    if (!this.valorSelecionado || this.valorSelecionado <= 0) {
      alert('Escolha um valor de doação para apoiar a ideia 💙');
      return;
    }

    this.carregando = true;

    this.apoioService.doar(this.nome, this.email, this.valorSelecionado).subscribe({
      next: (res) => {
        this.carregando = false;

        if (!res.init_point) {
          alert('Erro ao gerar o link de doação. Tente novamente.');
          return;
        }

        window.location.href = res.init_point;
      },
      error: (err) => {
        console.error(err);
        this.carregando = false;
        alert('Erro ao iniciar sua doação. Tente novamente.');
      }
    });
  }
}
