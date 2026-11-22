// Desktop / debug keyboard controls: ←/→ move, ↑ or R rotate, Space/↓ drop, 1-3 select, Esc back.
export interface KeyTarget {
  nudge(dx: number): void;
  rotate(): void;
  drop(): void;
  select(slot: number): void;
  back(): void;
}

export function bindKeyboard(t: KeyTarget): () => void {
  const fn = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        t.nudge(-2);
        break;
      case 'ArrowRight':
        t.nudge(2);
        break;
      case 'ArrowUp':
      case 'r':
      case 'R':
        t.rotate();
        break;
      case ' ':
      case 'ArrowDown':
        t.drop();
        break;
      case '1':
      case '2':
      case '3':
        t.select(Number(e.key) - 1);
        break;
      case 'Escape':
        t.back();
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  window.addEventListener('keydown', fn);
  return () => window.removeEventListener('keydown', fn);
}
