import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { CoinsService } from '../coins.service';

interface Coin {
  id: string;
  name: string;
  weight: number;
  titre: number;
}

interface CoinGroup {
  name: string;
  coins: Coin[];
}
@Component({
  selector: 'app-prime-form',
  templateUrl: './prime-form.component.html',
  styleUrls: ['./prime-form.component.scss']
})
export class PrimeFormComponent implements OnInit {
  @Input() label: string;
  @Input()
  set price(price: string) {
    this.form.get('spotPrice').setValue(price);
  }

  form: FormGroup;

  results = {
    goldWeight: 0,
    atSpotPrice: 0,
    premiumPercent: 0,
    premiumPrice: 0
  };

  coinGroups: CoinGroup[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private coinsService: CoinsService
  ) {
    this.form = this.formBuilder.group({
      type: ['', Validators.required],
      coinPrice: ['', Validators.required],
      spotPrice: ['', Validators.required],
      coinWeight: ['', Validators.required],
      coinPurity: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.coinsService.getCoinsList(this.label)
    .subscribe((data: any) => {
      console.log(data);
      this.coinGroups = data.coins;
    });
  }

  calculate() {
    const formValues = this.form.value;
    console.log(formValues);

    this.results.goldWeight = formValues.coinWeight / 1000 * formValues.coinPurity;
    this.results.atSpotPrice = this.results.goldWeight * formValues.spotPrice / 31.1034768;
    this.results.premiumPercent = formValues.coinPrice / this.results.atSpotPrice * 100 - 100;
  }

  shouldDisableButton() {
    return this.form.invalid;
  }

  customCoinChanged(event) {
    this.form.get('type').setValue('custom')
  }

  selectedCoinChanged(event) {
    if (event.value === 'custom') {
      return;
    }
    this.form.get('coinWeight').setValue(this.form.value.type.weight);
    this.form.get('coinPurity').setValue(this.form.value.type.titre);
  }
}
