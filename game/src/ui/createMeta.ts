// Builds App.meta with the current ad / purchase implementations.
// Today both are development stand-ins (fake ad layer, fake store sheet) on every platform.
// To ship real ones: implement AdProvider (platform/ads.ts) with AdMob and IapService
// (platform/iap.ts) with RevenueCat / Play Billing, and choose them here when
// Capacitor.isNativePlatform() (see README "Ekonomi, reklam ve satın alma").
import { FakeAdProvider } from '../platform/ads';
import { FakeIap } from '../platform/iap';
import type { SaveStore } from '../platform/storage';
import { presentFakeAd, presentFakePurchase } from './adOverlay';
import { Meta } from '../game/meta';

export function createMeta(save: SaveStore): Meta {
  const ads = new FakeAdProvider(presentFakeAd);
  const iap = new FakeIap(presentFakePurchase, () => save.economy.owned);
  void ads.init();
  void iap.init();
  return new Meta(save, ads, iap);
}
