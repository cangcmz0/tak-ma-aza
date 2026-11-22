// Tray pieces drawn as small spice pouches ("kese"): one stitched cloth silhouette per
// tetromino with rounded outer corners, spice speckles, a twine tie, the colour-blind
// symbol on every block (GDD §3.2; bomb blocks too, with a small chili beside it). Joker blocks get rainbow
// stripes and a star. Used by the tray slots and by the dragged piece (board scale).
import { JOKER } from '../engine/grid';
import { blockColor, pieceShape, type Piece } from '../engine/pieces';
import { drawSymbol } from './symbols';
import { mixHex, sandCss, theme } from './theme';

type RoundRectCtx = CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number[]) => void };

function blockPath(c: RoundRectCtx, x: number, y: number, s: number, r: [number, number, number, number]): void {
  c.beginPath();
  if (typeof c.roundRect === 'function') c.roundRect(x, y, s, s, r);
  else c.rect(x, y, s, s);
}

function chili(c: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  c.save();
  c.translate(cx, cy);
  c.rotate(-0.5);
  c.fillStyle = '#2a0a04';
  c.beginPath();
  c.ellipse(0, s * 0.06, s * 0.2, s * 0.36, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ff3b1f';
  c.beginPath();
  c.moveTo(-s * 0.15, -s * 0.22);
  c.quadraticCurveTo(-s * 0.22, s * 0.2, s * 0.02, s * 0.4);
  c.quadraticCurveTo(s * 0.16, s * 0.12, s * 0.14, -s * 0.22);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,230,200,0.7)';
  c.fillRect(-s * 0.09, -s * 0.12, s * 0.05, s * 0.22);
  c.fillStyle = '#5dae4b';
  c.fillRect(-s * 0.12, -s * 0.32, s * 0.24, s * 0.1);
  c.fillRect(-s * 0.03, -s * 0.42, s * 0.06, s * 0.12);
  c.restore();
  c.fillStyle = '#ffe066';
  c.beginPath();
  c.arc(cx + s * 0.28, cy - s * 0.3, s * 0.06, 0, Math.PI * 2);
  c.fill();
}

/** Draw a piece's blocks with top-left at (ox, oy) and `cell` px per block. */
export function drawPieceBlocks(c: CanvasRenderingContext2D, piece: Piece, ox: number, oy: number, cell: number, symbols = true): void {
  const rc = c as RoundRectCtx;
  const s = pieceShape(piece);
  const occ = new Set<number>();
  for (const [bx, by] of s.cells) occ.add(by * 8 + bx);
  const has = (bx: number, by: number) => bx >= 0 && by >= 0 && occ.has(by * 8 + bx);
  const r = cell * 0.24;
  const lw = Math.max(1.2, cell * 0.085);
  const radii = (bx: number, by: number): [number, number, number, number] => {
    const u = !has(bx, by - 1);
    const d = !has(bx, by + 1);
    const l = !has(bx - 1, by);
    const rt = !has(bx + 1, by);
    return [u && l ? r : 0, u && rt ? r : 0, d && rt ? r : 0, d && l ? r : 0];
  };
  const tw = theme().twine;

  // 1) soft drop shadow, 2) dark outline (inflated silhouette).
  for (const pass of [0, 1]) {
    for (let i = 0; i < s.cells.length; i++) {
      const [bx, by] = s.cells[i];
      const rr = radii(bx, by).map((v) => (v ? v + lw : 0)) as [number, number, number, number];
      const col = blockColor(piece, i);
      const x = ox + bx * cell - lw;
      const y = oy + by * cell - lw + (pass === 0 ? cell * 0.1 : 0);
      blockPath(rc, x, y, cell + lw * 2, rr);
      c.fillStyle = pass === 0 ? 'rgba(0,0,0,0.35)' : col === JOKER ? '#3b2414' : mixHex(sandCss(col, 2), '#1a0a04', 0.55);
      c.fill();
    }
  }

  // 3) cloth fill per block.
  for (let i = 0; i < s.cells.length; i++) {
    const [bx, by] = s.cells[i];
    const x = ox + bx * cell;
    const y = oy + by * cell;
    const col = blockColor(piece, i);
    const rr = radii(bx, by);
    c.save();
    blockPath(rc, x, y, cell, rr);
    c.clip();
    if (col === JOKER) {
      const n = 6;
      for (let k = -n; k < n * 2; k++) {
        c.fillStyle = sandCss(JOKER, ((k % n) + n) % n);
        c.beginPath();
        const w = cell / 4;
        c.moveTo(x + k * w, y);
        c.lineTo(x + k * w + w, y);
        c.lineTo(x + k * w + w - cell, y + cell);
        c.lineTo(x + k * w - cell, y + cell);
        c.fill();
      }
    } else {
      c.fillStyle = sandCss(col, 0);
      c.fillRect(x, y, cell, cell);
      // Light from the top, folds at the bottom.
      c.fillStyle = sandCss(col, 1);
      c.globalAlpha = 0.7;
      c.fillRect(x, y, cell, cell * 0.2);
      c.globalAlpha = 0.55;
      c.fillStyle = sandCss(col, 2);
      c.fillRect(x, y + cell * 0.82, cell, cell * 0.18);
      c.globalAlpha = 1;
      // Spice speckles (deterministic per block).
      let h = (bx * 73 + by * 151 + col * 31) | 0;
      for (let k = 0; k < 7; k++) {
        h = (Math.imul(h, 1103515245) + 12345) | 0;
        const sx = x + cell * (0.12 + ((h >>> 8) % 76) / 100);
        h = (Math.imul(h, 1103515245) + 12345) | 0;
        const sy = y + cell * (0.22 + ((h >>> 8) % 58) / 100);
        c.fillStyle = k % 2 ? sandCss(col, 2) : sandCss(col, 1);
        c.fillRect(sx, sy, Math.max(1, cell * 0.06), Math.max(1, cell * 0.06));
      }
    }
    c.restore();
    // Seam between blocks of different colours (two-colour pouch).
    c.fillStyle = 'rgba(30,12,4,0.7)';
    if (has(bx + 1, by) && blockColor(piece, s.cells.findIndex(([a, b]) => a === bx + 1 && b === by)) !== col)
      c.fillRect(x + cell - lw / 2, y, lw, cell);
    if (has(bx, by + 1) && blockColor(piece, s.cells.findIndex(([a, b]) => a === bx && b === by + 1)) !== col)
      c.fillRect(x, y + cell - lw / 2, cell, lw);
  }

  // 4) stitches along the outer edges.
  c.save();
  c.setLineDash([Math.max(1.5, cell * 0.1), Math.max(1.5, cell * 0.09)]);
  c.lineWidth = Math.max(1, cell * 0.045);
  c.strokeStyle = 'rgba(255,244,220,0.5)';
  const ins = cell * 0.15;
  c.beginPath();
  for (const [bx, by] of s.cells) {
    const x = ox + bx * cell;
    const y = oy + by * cell;
    const a = ins;
    if (!has(bx, by - 1)) {
      c.moveTo(x + (has(bx - 1, by) ? 0 : a + r * 0.4), y + a);
      c.lineTo(x + cell - (has(bx + 1, by) ? 0 : a + r * 0.4), y + a);
    }
    if (!has(bx, by + 1)) {
      c.moveTo(x + (has(bx - 1, by) ? 0 : a + r * 0.4), y + cell - a);
      c.lineTo(x + cell - (has(bx + 1, by) ? 0 : a + r * 0.4), y + cell - a);
    }
    if (!has(bx - 1, by)) {
      c.moveTo(x + a, y + (has(bx, by - 1) ? 0 : a + r * 0.4));
      c.lineTo(x + a, y + cell - (has(bx, by + 1) ? 0 : a + r * 0.4));
    }
    if (!has(bx + 1, by)) {
      c.moveTo(x + cell - a, y + (has(bx, by - 1) ? 0 : a + r * 0.4));
      c.lineTo(x + cell - a, y + cell - (has(bx, by + 1) ? 0 : a + r * 0.4));
    }
  }
  c.stroke();
  c.restore();

  // 5) symbols / chili per block.
  for (let i = 0; i < s.cells.length; i++) {
    const [bx, by] = s.cells[i];
    const cx = ox + bx * cell + cell / 2;
    const cy = oy + by * cell + cell / 2 + cell * 0.03;
    const col = blockColor(piece, i);
    const bomb = piece.special === 'bomb' && i === piece.specialCell;
    if (symbols) {
      // Bomb blocks keep their colour symbol (QA-020), nudged left so the chili fits beside it.
      const sx = bomb ? cx - cell * 0.13 : cx;
      const sy = bomb ? cy + cell * 0.08 : cy;
      const sr = bomb ? cell * 0.19 : cell * 0.23;
      if (col === JOKER) {
        drawSymbol(c, JOKER, sx, sy + cell * 0.01, sr * 1.12, 'rgba(59,36,20,0.6)');
        drawSymbol(c, JOKER, sx, sy - cell * 0.02, sr, '#fff8e6');
      } else {
        // Light halo + dark glyph: readable on every spice colour (QA-020).
        drawSymbol(c, col, sx, sy + cell * 0.015, sr * 1.16, 'rgba(255,246,226,0.55)');
        drawSymbol(c, col, sx, sy, sr, mixHex(sandCss(col, 2), '#1a0a04', 0.55));
      }
    }
    if (bomb) chili(c, symbols ? cx + cell * 0.2 : cx, symbols ? cy - cell * 0.1 : cy, symbols ? cell * 0.62 : cell);
  }

  // 6) twine tie on the top-left block of the top row.
  let top = s.cells[0];
  for (const cc of s.cells) if (cc[1] < top[1] || (cc[1] === top[1] && cc[0] < top[0])) top = cc;
  const tx = ox + top[0] * cell + cell / 2;
  const ty = oy + top[1] * cell + cell * 0.04;
  c.lineCap = 'round';
  c.strokeStyle = tw[1];
  c.lineWidth = Math.max(1.4, cell * 0.11);
  c.beginPath();
  c.moveTo(tx - cell * 0.18, ty - cell * 0.14);
  c.lineTo(tx, ty);
  c.lineTo(tx + cell * 0.2, ty - cell * 0.12);
  c.stroke();
  c.strokeStyle = tw[0];
  c.lineWidth = Math.max(1, cell * 0.06);
  c.stroke();
  c.fillStyle = tw[0];
  c.beginPath();
  c.arc(tx, ty, Math.max(1.4, cell * 0.08), 0, Math.PI * 2);
  c.fill();
  c.lineCap = 'butt';
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
  const cell = Math.floor((cssSize - 12) / Math.max(s.w, s.h, 3));
  const ox = (cssSize - s.w * cell) / 2;
  const oy = (cssSize - s.h * cell) / 2;
  drawPieceBlocks(c, piece, ox, oy, cell);
}
