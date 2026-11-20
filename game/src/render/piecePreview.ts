// Small canvas preview of a tray piece.
import { JOKER } from '../engine/grid';
import { blockColor, pieceShape, type Piece } from '../engine/pieces';
import { sandCss } from './theme';

/** Draw a piece's blocks with top-left at (ox, oy) and `cell` px per block. */
export function drawPieceBlocks(c: CanvasRenderingContext2D, piece: Piece, ox: number, oy: number, cell: number): void {
  const s = pieceShape(piece);
  for (let i = 0; i < s.cells.length; i++) {
    const [bx, by] = s.cells[i];
    const x = ox + bx * cell;
    const y = oy + by * cell;
    const col = blockColor(piece, i);
    if (col === JOKER) {
      // Joker block: diagonal stripes of the cycle colours.
      const n = 4;
      for (let k = 0; k < n; k++) {
        c.fillStyle = sandCss(JOKER, k);
        c.fillRect(x + 1 + ((cell - 2) * k) / n, y + 1, (cell - 2) / n + 0.5, cell - 2);
      }
      c.fillStyle = '#ffffff';
      c.font = `${Math.round(cell * 0.55)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('★', x + cell / 2, y + cell / 2 + 1);
      continue;
    }
    c.fillStyle = sandCss(col, 0);
    c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    c.fillStyle = sandCss(col, 1);
    c.fillRect(x + 1, y + 1, cell - 2, Math.max(2, cell * 0.2));
    c.fillStyle = sandCss(col, 2);
    c.fillRect(x + 1, y + cell - 1 - Math.max(2, cell * 0.15), cell - 2, Math.max(2, cell * 0.15));
    if (piece.special === 'bomb' && i === piece.specialCell) {
      c.fillStyle = '#1a1a1a';
      c.beginPath();
      c.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2);
      c.fill();
    }
  }
}

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
  drawPieceBlocks(c, piece, ox, oy, cell);
}
