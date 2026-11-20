// Small canvas preview of a tray piece.
import { pieceShape, type Piece } from '../engine/pieces';
import { sandCss } from './theme';

export function drawPiecePreview(cv: HTMLCanvasElement, piece: Piece | null, cssSize: number, dpr: number): void {
  const px = Math.round(cssSize * dpr);
  if (cv.width !== px || cv.height !== px) {
    cv.width = px;
    cv.height = px;
  }
  const c = cv.getContext('2d');
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cssSize, cssSize);
  if (!piece) return;
  const s = pieceShape(piece);
  const cell = Math.floor((cssSize - 8) / Math.max(s.w, s.h, 3));
  const ox = (cssSize - s.w * cell) / 2;
  const oy = (cssSize - s.h * cell) / 2;
  for (let i = 0; i < s.cells.length; i++) {
    const [bx, by] = s.cells[i];
    const x = ox + bx * cell;
    const y = oy + by * cell;
    c.fillStyle = sandCss(piece.color, 0);
    c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    c.fillStyle = sandCss(piece.color, 1);
    c.fillRect(x + 1, y + 1, cell - 2, Math.max(2, cell * 0.2));
    c.fillStyle = sandCss(piece.color, 2);
    c.fillRect(x + 1, y + cell - 1 - Math.max(2, cell * 0.15), cell - 2, Math.max(2, cell * 0.15));
    if (piece.special === 'bomb' && i === piece.specialCell) {
      c.fillStyle = '#1a1a1a';
      c.beginPath();
      c.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2);
      c.fill();
    }
  }
}
