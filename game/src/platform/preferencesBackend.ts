// KeyValueBackend on Capacitor Preferences (native SharedPreferences / UserDefaults).
// The plugin is loaded lazily so web builds and unit tests never touch it.
import { Capacitor } from '@capacitor/core';
import { LocalStorageBackend, type KeyValueBackend } from './storage';

/** The subset of the Preferences plugin API we use (injectable for tests). */
export interface PreferencesApi {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

export class PreferencesBackend implements KeyValueBackend {
  private api: Promise<PreferencesApi>;

  constructor(
    api?: PreferencesApi | Promise<PreferencesApi>,
    /** Read-only fallback for keys Preferences does not have yet (migrates old WebView localStorage saves). */
    private readonly fallback: KeyValueBackend | null = new LocalStorageBackend(),
  ) {
    this.api = Promise.resolve(api ?? import('@capacitor/preferences').then((m) => m.Preferences as PreferencesApi));
  }

  async get(key: string): Promise<string | null> {
    const { value } = await (await this.api).get({ key });
    if (value !== null && value !== undefined) return value;
    return this.fallback ? this.fallback.get(key) : null;
  }

  async set(key: string, value: string): Promise<void> {
    await (await this.api).set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await (await this.api).remove({ key });
  }
}

/** Preferences on a native Capacitor platform, localStorage on the web. */
export async function createStorageBackend(): Promise<KeyValueBackend> {
  try {
    if (Capacitor.isNativePlatform()) return new PreferencesBackend();
  } catch {
    /* not running under Capacitor */
  }
  return new LocalStorageBackend();
}
