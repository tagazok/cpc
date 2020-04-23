import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { CoinsService } from '../coins.service';
import { Observable } from 'rxjs';
import {startWith, map} from 'rxjs/operators';

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

export const _filter = (opt: Coin[], value: string): Coin[] => {
  if(typeof(value) === 'string') {
    const filterValue = value.toLowerCase();
    return opt.filter(item => item.name.toLowerCase().indexOf(filterValue) >= 0);
  }
  return value;
};

@Component({
  selector: 'app-prime-form',
  templateUrl: './prime-form.component.html',
  styleUrls: ['./prime-form.component.scss']
})
export class PrimeFormComponent implements OnInit {
  @Input() label: string | '';
  @Input()
  set price(price: string) {
    this.form.get('spotPrice')?.setValue(price);
  }

  form: FormGroup;

  results = {
    goldWeight: 0,
    atSpotPrice: 0,
    premiumPercent: 0,
    premium: 0,
    premiumPrice: 0
  };

  coinGroups: CoinGroup[] = [];

  coinGroupOptions: Observable<CoinGroup[]>;

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

    this.coinGroupOptions = this.form.get('type')!.valueChanges
      .pipe(
        startWith(''),
        map(value => this._filterGroup(value))
      );
  }

  displayFn(coin: Coin): string {
    if (typeof(coin) !== "string") {
      return coin.name;
    }
    return '';
    // return coins[0]?.name;
  }

  private _filterGroup(value: string): CoinGroup[] {
    if (value) {
      return this.coinGroups
        .map(group => ({name: group.name, coins: _filter(group.coins, value)}))
        .filter(group => group.coins.length > 0);
    }

    return this.coinGroups;
  }

  calculate() {
    const formValues = this.form.value;
    console.log(formValues);

    this.results.premiumPercent = formValues.coinPrice / this.results.atSpotPrice * 100 - 100;
    this.results.premium = formValues.coinPrice - this.results.atSpotPrice;
  }

  shouldDisableButton() {
    return this.form.invalid;
  }

  customCoinChanged(event: any) {
    this.form.get('type')?.setValue('custom')
  }

  selectedCoinChanged(event: any) {
    if (event.option.value === 'custom') {
      return;
    }
    this.form.get('coinWeight')?.setValue(this.form.value.type.weight);
    this.form.get('coinPurity')?.setValue(this.form.value.type.titre);

    const formValues = this.form.value;
    this.results.goldWeight = formValues.coinWeight / 1000 * formValues.coinPurity;
    this.results.atSpotPrice = this.results.goldWeight * formValues.spotPrice / 31.1034768;
  }
}
