import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface DoacaoResponse {
  init_point: string; 
}

@Injectable({
  providedIn: 'root'
})
export class ApoioService {

  private baseUrl = 'https://projeto-faculride.onrender.com/api';

  constructor(private http: HttpClient) {}

  doar(nome: string, email: string, valor: number): Observable<DoacaoResponse> {
    return this.http.post<DoacaoResponse>(
      `${this.baseUrl}/pagamentos/doar`, 
      { nome, email, valor }
    );
  }
}
