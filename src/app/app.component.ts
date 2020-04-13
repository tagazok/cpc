import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

interface Coin {
  name: string;
  weight: number;
  titre: number;
}

interface CoinGroup {
  name: string;
  coins: Coin[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  coinPrice = 0;
  goldPrice = 0;
  form: FormGroup;
  customGold = false;

  results = {
    goldWeight: 0,
    atSpotPrice: 0,
    premiumPercent: 0,
    premiumPrice: 0
  };

  constructor(
    private formBuilder: FormBuilder
  ) {
    this.getGoldPrice();
    this.form = this.formBuilder.group({
      type: ['', Validators.required],
      coinPrice: ['', Validators.required],
      goldSpotPrice: ['', Validators.required],
      coinWeight: ['0', Validators.required],
      coinPurity: ['0', Validators.required]
    });
  }

  selected: Coin;
  coinGroups: CoinGroup[] = [
    {
      name: 'French',
      coins: [
        {
          name: 'Coq 10 Fr',
          weight: 3.225,
          titre: 900
        },
        {
          name: 'Coq 20 Fr',
          weight: 6.45161,
          titre: 900
        },
        {
          name: 'Napoléon 10 Fr',
          weight: 3.225,
          titre: 900
        },
        {
          name: 'Napoléon 20 Fr',
          weight: 6.4516,
          titre: 900
        },
        {
          name: 'Krugerrand',
          weight: 33.93,
          titre: 916.667
        }
      ]
    },
    {
      name: 'USA',
      coins: [
        {
          name: '$5 Liberty / Indian head',
          weight: 8.359,
          titre: 900
        },
        {
          name: '$10 Liberty / Indian head',
          weight: 16.7185,
          titre: 900
        },
        {
          name: '$20 Liberty',
          weight: 33.437,
          titre: 900
        }
      ]
    },
    {
    name: 'Bullion',
    coins: [
      {
        name: 'American Buffalo 1/2oz',
        weight: 15.552,
        titre: 999.9
      },
      {
        name: 'American Eagle 1oz',
        weight: 33.930,
        titre: 916.7
      },
      {
        name: 'American Eagle 1/2oz',
        weight: 16.965,
        titre: 916.7
      },
      {
        name: 'Krugerrand 1oz',
        weight: 33.930,
        titre: 916.7
      },
      {
        name: 'Krugerrand 1/2oz',
        weight: 16.965,
        titre: 916.7
      },
      {
        name: 'Mapple Leaf 1oz',
        weight: 31.10,
        titre: 999.0
      },
      {
        name: 'Mapple Leaf 1/2oz',
        weight: 15.55,
        titre: 999.0
      }
    ]
    },
    {
      name: 'Bars',
      coins: [
        {
          name: '5 grams',
          weight: 5,
          titre: 999.9
        },
        {
          name: '10 grams',
          weight: 10,
          titre: 999.9
        },
        {
          name: '20 grams',
          weight: 20,
          titre: 999.9
        }
      ]
    }
  ];

  calculate() {
    if (this.customGold) {
      this.calculateCustom();
    } else {
      this.calculateSelectedCoin();
    }
  }

  calculateSelectedCoin() {
    const formValues = this.form.value;
    console.log(formValues);

    this.results.goldWeight = formValues.type.weight / 1000 * formValues.type.titre;
    this.results.atSpotPrice = this.results.goldWeight * formValues.goldSpotPrice / 31.1034768;
    this.results.premiumPercent = formValues.coinPrice / this.results.atSpotPrice * 100 - 100;
  }

  calculateCustom() {
    const formValues = this.form.value;
    console.log(formValues);

    this.results.goldWeight = formValues.coinWeight / 1000 * formValues.coinPurity;
    this.results.atSpotPrice = this.results.goldWeight * formValues.goldSpotPrice / 31.1034768;
    this.results.premiumPercent = formValues.coinPrice / this.results.atSpotPrice * 100 - 100;
  }

  shouldDisableButton() {
    return this.form.invalid;
  }

  goldSelectionChanged(event) {
    this.customGold = !this.customGold;
  }

  async getGoldPrice() {
    const response = await fetch('https://livegoldfeed.com/goldfeed/profile/frame/a4ab436762daa5ecf9c490fec32de84f/price?currency=eur');
    const data = await response.json();
    this.form.get('goldSpotPrice').setValue(data.ask.gold);
  }
}
