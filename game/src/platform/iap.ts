// In-app purchases (GDD §11.3). The game talks to IapService only.
//
// Today: FakeIap — no store, no money. purchase() shows a "Deneme satın alma" confirmation
// (ui/adOverlay.ts) and succeeds when confirmed. Later: a store implementation (RevenueCat
// `@revenuecat/purchases-capacitor` or a Google Play Billing plugin) with the same interface:
// it returns store prices from products(), finishes/acknowledges purchases and restores
// non-consumables. Delivery of the content (gold, "remove ads") stays in the game
// (Economy.deliverProduct) so both implementations share it.

export type ProductId = 'remove_ads' | 'gold_small' | 'gold_large';

export interface ProductDef {
  id: ProductId;
  /** Consumables can be bought again; non-consumables are owned forever (restore). */
  consumable: boolean;
  gold: number;
  /** Turns interstitials off. */
  noAds?: boolean;
  /** Fallback display price (the real store returns a localised price). */
  price: string;
}

/** Store catalogue (MVP rows of GDD §11.3). Store product ids must match these. */
export const PRODUCTS: readonly ProductDef[] = [
  { id: 'remove_ads', consumable: false, gold: 500, noAds: true, price: '$2,99' },
  { id: 'gold_small', consumable: true, gold: 1000, price: '$0,99' },
  { id: 'gold_large', consumable: true, gold: 6000, price: '$4,99' },
];

export function productDef(id: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export interface PurchaseResult {
  ok: boolean;
  productId: ProductId;
  /** The player closed the store sheet. */
  cancelled?: boolean;
  error?: string;
}

export interface IapService {
  /** True for the development stand-in (UI shows "Deneme sürümü: gerçek ödeme yok"). */
  readonly fake: boolean;
  /** Connect to the store; never throws. */
  init(): Promise<void>;
  /** Display price (store-localised when available). */
  price(id: ProductId): string;
  /** Start a purchase. Content is delivered by the caller when ok. */
  purchase(id: ProductId): Promise<PurchaseResult>;
  /** Non-consumables the account owns (deliver each again; delivery is idempotent). */
  restore(): Promise<ProductId[]>;
}

/** Asks the player to confirm a fake purchase. */
export type FakePurchasePresenter = (product: ProductDef) => Promise<boolean>;

export class FakeIap implements IapService {
  readonly fake = true;
  private busy = false;

  /**
   * @param confirm shows the fake confirmation
   * @param owned   non-consumables already delivered (restore source: the local save)
   */
  constructor(
    private readonly confirm: FakePurchasePresenter,
    private readonly owned: () => readonly string[] = () => [],
  ) {}

  async init(): Promise<void> {}

  price(id: ProductId): string {
    return productDef(id)?.price ?? '';
  }

  async purchase(id: ProductId): Promise<PurchaseResult> {
    const p = productDef(id);
    if (!p) return { ok: false, productId: id, error: 'unknown_product' };
    if (this.busy) return { ok: false, productId: id, error: 'busy' };
    this.busy = true;
    try {
      const ok = await this.confirm(p).catch(() => false);
      return ok ? { ok: true, productId: id } : { ok: false, productId: id, cancelled: true };
    } finally {
      this.busy = false;
    }
  }

  async restore(): Promise<ProductId[]> {
    const own = this.owned();
    return PRODUCTS.filter((p) => !p.consumable && own.includes(p.id)).map((p) => p.id);
  }
}
