import { Component } from '@angular/core';
import { StorageService } from './storage.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  prices: any;
  history = [];

  constructor(
    private localStore: StorageService
  ) {
    this.getPrices();
    this.getHistory();
  }

  async getPrices() {
    const response = await fetch('https://livegoldfeed.com/goldfeed/profile/frame/a4ab436762daa5ecf9c490fec32de84f/price?currency=eur');
    const data = await response.json();
    this.prices = data;
  }

  getHistory() {
    this.history = JSON.parse(this.localStore.getData("history") || "[]");
  }

  addToHistory(coin: any) {
    this.history.unshift(coin);
    this.localStore.saveData("history", JSON.stringify(this.history));
  }
  deleteFromHistory(coin: any) {
    // this.history.splice(coin, 1);
  }
}
