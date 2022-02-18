import { Component } from '@angular/core';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  prices: any;
  basket = [];

  constructor() {
    this.getPrices();
  }

  async getPrices() {
    const response = await fetch('https://livegoldfeed.com/goldfeed/profile/frame/a4ab436762daa5ecf9c490fec32de84f/price?currency=eur');
    const data = await response.json();
    this.prices = data;
  }

  addtoBasket(coin: any) {
    debugger;
    console.log(coin);
    this.basket.push(coin);
  }
}
