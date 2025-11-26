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

private baseUrl = 'https://projeto-faculride.onrender.com/api'; 

  constructor(private http: HttpClient) {}

  doarPix(descricao: string | null, valor: number): Observable<PixPagamentoResponse> {
    return this.http.post<PixPagamentoResponse>(
      `${this.baseUrl}/pagamentos/pagamento`,   
      {
        descricao,
        valor,
        // idUsuario e idViagem são opcionais no back, pode mandar depois
      }
    );
  }
}

