import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PixPagamentoResponse {
  idPagamento: string | number;
  status: string;
  qr_code_base64: string | null;
  qr_code: string | null;
  valor: number;
  descricao: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApoioService {

  // base em /api (igual ao app.use("/api", pagamentoRoutes))
  private readonly API_URL = 'https://projeto-faculride.onrender.com/api';

  constructor(private http: HttpClient) {}

  doarPix(descricao: string, valor: number): Observable<PixPagamentoResponse> {
    return this.http.post<PixPagamentoResponse>(
      `${this.API_URL}/pagamento`,   
      {
        descricao,
        valor
        // idUsuario e idViagem podem entrar aqui depois, se você quiser
      }
    );
  }
}
