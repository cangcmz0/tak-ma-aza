// Minimal typed event emitter.
export class Emitter<E extends { type: string }> {
  private listeners: Array<(e: E) => void> = [];

  on(fn: (e: E) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(e: E): void {
    for (const l of this.listeners) l(e);
  }

  clear(): void {
    this.listeners = [];
  }
}
