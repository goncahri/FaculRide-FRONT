// src/app/apoio/apoio.component.ts
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

  // dados do PIX gerado
  qrCodeBase64: string | null = null;
  qrCode: string | null = null;
  statusPagamento: string | null = null;

  // controle do modal PIX
  exibirModalPix = false;
  copiado = false;

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

    // (por enquanto nome/email são apenas informativos;
    // se quiser podemos mandar depois para o backend)
    this.carregando = true;
    this.qrCodeBase64 = null;
    this.qrCode = null;
    this.statusPagamento = null;
    this.exibirModalPix = false;
    this.copiado = false;

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

        // abre modal com o QR Code
        this.exibirModalPix = true;
      },
      error: (err: any) => {
        console.error(err);
        this.carregando = false;
        alert('Erro ao iniciar sua doação. Tente novamente.');
      }
    });
  }

  fecharModalPix(): void {
    this.exibirModalPix = false;
    this.copiado = false;
  }

  copiarCodigoPix(): void {
    if (!this.qrCode) return;

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this.qrCode)
        .then(() => {
          this.copiado = true;
          setTimeout(() => (this.copiado = false), 2500);
        })
        .catch(err => console.error('Erro ao copiar código PIX:', err));
    } else {
      // fallback simples
      alert('Copie o código manualmente na caixa de texto.');
    }
  }
}
