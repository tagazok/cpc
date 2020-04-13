import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class CoinsService {

  constructor(private http: HttpClient) { }

  getCoinsList(label) {
    return this.http.get(`assets/coins/${label}.json`);
  }
}
