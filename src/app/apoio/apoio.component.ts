import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApoioService, PixPagamentoResponse } from '../services/apoio.service';

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

  // dados do PIX gerado (quando quiser exibir na tela)
  qrCodeBase64: string | null = null;
  qrCode: string | null = null;
  statusPagamento: string | null = null;

  planos = [
    { label: 'Apoiador Bronze', valor: 10 },
    { label: 'Apoiador Prata',  valor: 25 },
    { label: 'Apoiador Ouro',   valor: 50 }
  ];

  constructor(private apoioService: ApoioService) {}

  selecionarPlano(plano: { label: string; valor: number }): void {
    this.tipoApoioSelecionado = plano.label;
    this.valorSelecionado = plano.valor;
  }

  iniciarDoacao(): void {
    if (!this.valorSelecionado || this.valorSelecionado <= 0) {
      alert('Escolha um valor de doação para apoiar a ideia 💙');
      return;
    }

    this.carregando = true;
    this.qrCodeBase64 = null;
    this.qrCode = null;
    this.statusPagamento = null;

    const descricao =
      this.tipoApoioSelecionado
        ? `Apoio: ${this.tipoApoioSelecionado}`
        : 'Apoio ao projeto FaculRide';

    this.apoioService.doarPix(descricao, this.valorSelecionado).subscribe({
      next: (res: PixPagamentoResponse) => {
        this.carregando = false;
        console.log('PIX gerado:', res);

        this.qrCodeBase64 = res.qr_code_base64;
        this.qrCode = res.qr_code;
        this.statusPagamento = res.status;
      },
      error: (err: any) => {
        console.error(err);
        this.carregando = false;
        alert('Erro ao iniciar sua doação. Tente novamente.');
      }
    });
  }
}
