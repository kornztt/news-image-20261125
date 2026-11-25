// THE WORLD TODAY — front page for Wednesday, 25 November 2026.
// Hand-written from scratch: a tiny software rasterizer, a 5x7 bitmap font,
// and a hand-rolled PNG encoder. Node 22+ stdlib only, no network, fully
// deterministic (same bytes on every run).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [20, 20, 20];
const RED: RGB = [176, 30, 36];
const NAVY: RGB = [18, 38, 74];
const NAVY2: RGB = [28, 58, 110];
const GOLD: RGB = [200, 155, 60];
const SKY1: RGB = [10, 18, 46];
const SKY2: RGB = [38, 74, 138];
const EARTH: RGB = [52, 110, 190];
const LAND: RGB = [74, 140, 84];
const SEA: RGB = [178, 214, 232];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [120, 120, 118];
const SMOKE: RGB = [168, 168, 164];
const ORANGE: RGB = [232, 116, 32];
const YELLOW: RGB = [248, 196, 64];
const CREAM2: RGB = [238, 231, 214];

// ------------------------------------------------------------- CRC32 / PNG
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ canvas
interface Clip { x: number; y: number; w: number; h: number }

class Canvas {
  data = new Uint8Array(W * H * 3);
  clip: Clip = { x: 0, y: 0, w: W, h: H };

  constructor() {
    this.fill(PAPER);
  }

  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = c[0];
      this.data[i * 3 + 1] = c[1];
      this.data[i * 3 + 2] = c[2];
    }
  }

  setClip(x: number, y: number, w: number, h: number): void {
    this.clip = { x, y, w, h };
  }

  resetClip(): void {
    this.clip = { x: 0, y: 0, w: W, h: H };
  }

  px(x: number, y: number, c: RGB): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < this.clip.x || iy < this.clip.y) return;
    if (ix >= this.clip.x + this.clip.w || iy >= this.clip.y + this.clip.h) return;
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const o = (iy * W + ix) * 3;
    this.data[o] = c[0];
    this.data[o + 1] = c[1];
    this.data[o + 2] = c[2];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(Math.floor(x), this.clip.x);
    const y0 = Math.max(Math.floor(y), this.clip.y);
    const x1 = Math.min(Math.ceil(x + w), this.clip.x + this.clip.w, W);
    const y1 = Math.min(Math.ceil(y + h), this.clip.y + this.clip.h, H);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const o = (yy * W + xx) * 3;
        this.data[o] = c[0];
        this.data[o + 1] = c[1];
        this.data[o + 2] = c[2];
      }
    }
  }

  vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
    for (let yy = 0; yy < h; yy++) {
      const t = h <= 1 ? 0 : yy / (h - 1);
      const c: RGB = [
        Math.round(top[0] + (bot[0] - top[0]) * t),
        Math.round(top[1] + (bot[1] - top[1]) * t),
        Math.round(top[2] + (bot[2] - top[2]) * t),
      ];
      this.rect(x, y + yy, w, 1, c);
    }
  }

  hline(x: number, y: number, w: number, c: RGB, th = 1): void {
    this.rect(x, y, w, th, c);
  }

  vline(x: number, y: number, h: number, c: RGB, th = 1): void {
    this.rect(x, y, th, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + dx * t;
      const cy = y0 + dy * t;
      const r = Math.floor(th / 2);
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++) this.px(cx + a, cy + b, c);
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.round(r);
    for (let dy = -rr; dy <= rr; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
      for (let xx = -dx; xx <= dx; xx++) this.px(cx + xx, cy + dy, c);
    }
  }

  ring(cx: number, cy: number, r: number, c: RGB, th = 2): void {
    const rr = Math.round(r);
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      for (let t = 0; t < th; t++)
        this.px(cx + Math.cos(rad) * (rr + t), cy + Math.sin(rad) * (rr + t), c);
    }
  }

  // Scanline-filled polygon; every vertex is clipped by the canvas clip.
  poly(pts: Array<[number, number]>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k]);
        const xb = Math.floor(xs[k + 1]);
        for (let x = xa; x <= xb; x++) this.px(x, y, c);
      }
    }
  }

  // Ellipse filled, clipped like everything else.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    const rxi = Math.round(rx);
    const ryi = Math.round(ry);
    for (let dy = -ryi; dy <= ryi; dy++) {
      const t = 1 - (dy * dy) / (ryi * ryi);
      if (t < 0) continue;
      const dx = Math.floor(rxi * Math.sqrt(t));
      for (let xx = -dx; xx <= dx; xx++) this.px(cx + xx, cy + dy, c);
    }
  }

  frame(x: number, y: number, w: number, h: number, c: RGB, th = 2): void {
    this.rect(x, y, w, th, c);
    this.rect(x, y + h - th, w, th, c);
    this.rect(x, y, th, h, c);
    this.rect(x + w - th, y, th, h, c);
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 cells, "#" = ink. Uppercase + digits + punctuation.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(cv: Canvas, x: number, y: number, text: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          cv.rect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(cv: Canvas, cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cv, cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap for the bitmap font.
function wrapText(text: string, maxW: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(cv: Canvas, x: number, y: number, text: string, scale: number, c: RGB, maxW: number, lh: number): number {
  const lines = wrapText(text, maxW, scale);
  let yy = y;
  for (const ln of lines) {
    drawText(cv, x, yy, ln, scale, c);
    yy += lh;
  }
  return yy;
}

// Deterministic pseudo-random (LCG) for stars — same output every run.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------ hero: launch
// Panel x 20..1004, y 140..520. Everything drawn inside the clip.
function drawHero(cv: Canvas): void {
  const px = 20;
  const py = 140;
  const pw = 984;
  const ph = 380;
  cv.setClip(px, py, pw, ph);
  cv.vgrad(px, py, pw, ph, SKY1, SKY2);

  // Stars (fixed seed: identical every run).
  const rnd = lcg(20261125);
  for (let i = 0; i < 90; i++) {
    const sx = px + 8 + Math.floor(rnd() * (pw - 16));
    const sy = py + 8 + Math.floor(rnd() * (ph - 190));
    const s = rnd() < 0.15 ? 3 : 2;
    cv.rect(sx, sy, s, s, rnd() < 0.2 ? GOLD : WHITE);
  }
  // A few brighter stars with a cross sparkle.
  const bright: Array<[number, number]> = [
    [140, 185], [880, 205], [700, 175], [330, 215], [950, 300],
  ];
  for (const [bx, by] of bright) {
    cv.rect(bx - 1, by, 3, 1, WHITE);
    cv.rect(bx, by - 1, 1, 3, WHITE);
    cv.rect(bx - 3, by, 7, 1, WHITE);
    cv.rect(bx, by - 3, 1, 7, WHITE);
  }

  // Earth: huge disc rising from below the panel; only its top arc shows.
  cv.circle(512, 830, 430, EARTH);
  cv.ellipse(380, 430, 150, 20, LAND);
  cv.ellipse(640, 440, 120, 16, LAND);
  cv.ellipse(250, 448, 70, 11, LAND);
  cv.ellipse(800, 428, 90, 13, LAND);
  // Cloud wisps on the Earth.
  cv.ellipse(470, 418, 90, 6, WHITE);
  cv.ellipse(700, 426, 70, 5, WHITE);
  cv.ellipse(300, 434, 60, 5, WHITE);
  // Thin atmosphere rim.
  cv.ring(512, 830, 430, [120, 180, 235], 3);

  // Space station, top right: core module + two solar wings.
  const sx0 = 700;
  const sy0 = 205;
  cv.rect(sx0, sy0 + 8, 120, 14, [210, 214, 220]); // core
  cv.rect(sx0 + 54, sy0, 12, 30, [160, 164, 172]); // hub
  cv.rect(sx0 - 78, sy0 + 4, 72, 22, [46, 92, 180]); // left wing
  cv.rect(sx0 + 126, sy0 + 4, 72, 22, [46, 92, 180]); // right wing
  cv.vline(sx0 - 42, sy0 + 4, 22, GOLD, 2);
  cv.vline(sx0 - 6, sy0 + 4, 22, GOLD, 2);
  cv.vline(sx0 + 162, sy0 + 4, 22, GOLD, 2);
  cv.vline(sx0 + 192, sy0 + 4, 22, GOLD, 2);
  cv.rect(sx0 + 12, sy0 + 10, 10, 10, YELLOW); // docking light

  // Rocket climbing left of centre, nose up.
  const rx = 430;
  const ry = 300;
  // Flame (layered, below the tail).
  cv.poly([[rx - 16, ry + 62], [rx + 16, ry + 62], [rx, ry + 128]], ORANGE);
  cv.poly([[rx - 9, ry + 62], [rx + 9, ry + 62], [rx, ry + 104]], YELLOW);
  cv.poly([[rx - 4, ry + 62], [rx + 4, ry + 62], [rx, ry + 84]], WHITE);
  // Smoke puffs trailing down-left, all inside the panel.
  cv.circle(392, 440, 22, SMOKE);
  cv.circle(360, 460, 26, SMOKE);
  cv.circle(322, 476, 18, SMOKE);
  cv.circle(408, 466, 14, [190, 190, 186]);
  // Fins.
  cv.poly([[rx - 18, ry + 34], [rx - 18, ry + 62], [rx - 40, ry + 66]], RED);
  cv.poly([[rx + 18, ry + 34], [rx + 18, ry + 62], [rx + 40, ry + 66]], RED);
  // Body.
  cv.rect(rx - 18, ry - 28, 36, 90, WHITE);
  cv.rect(rx - 18, ry + 56, 36, 6, RED);
  // Nose cone.
  cv.poly([[rx - 18, ry - 28], [rx + 18, ry - 28], [rx, ry - 62]], RED);
  // Window.
  cv.circle(rx, ry - 6, 9, NAVY2);
  cv.ring(rx, ry - 6, 9, INK, 2);
  // Body stripe + flag band.
  cv.rect(rx - 18, ry + 18, 36, 6, RED);
  drawText(cv, rx - 15, ry + 30, "SZ-24", 1, INK);

  // Banner strip pinned to the bottom of the panel (inside it).
  cv.rect(px, py + ph - 52, pw, 52, NAVY);
  cv.rect(px, py + ph - 52, pw, 3, GOLD);
  drawTextCentered(cv, 512, py + ph - 38, "FIRST FOREIGNER ABOARD TIANGONG", 3, WHITE);
  cv.resetClip();
  cv.frame(px, py, pw, ph, INK, 3);
}

// ------------------------------------------------- column art: Pacific map
function drawPacificMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.rect(x, y, w, h, SEA);
  // Island chain blobs (positions relative to the panel).
  cv.ellipse(x + Math.floor(w * 0.15), y + Math.floor(h * 0.30), 34, 9, LAND);
  cv.ellipse(x + Math.floor(w * 0.31), y + Math.floor(h * 0.55), 44, 11, LAND);
  cv.ellipse(x + Math.floor(w * 0.52), y + Math.floor(h * 0.32), 30, 8, LAND);
  cv.ellipse(x + Math.floor(w * 0.69), y + Math.floor(h * 0.58), 48, 10, LAND);
  cv.ellipse(x + Math.floor(w * 0.87), y + Math.floor(h * 0.34), 32, 8, LAND);
  // Dashed route: Honiara -> Canberra (south-east corner).
  const hx = x + Math.floor(w * 0.31);
  const hy = y + Math.floor(h * 0.55);
  const cxp = x + Math.floor(w * 0.82);
  const cyp = y + Math.floor(h * 0.80);
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    if (i % 2 === 0) continue;
    const t = i / steps;
    const dx = hx + (cxp - hx) * t;
    const dy = hy + (cyp - hy) * t + 10 * Math.sin(t * Math.PI);
    cv.rect(dx - 2, dy - 2, 4, 4, NAVY);
  }
  // Markers.
  cv.circle(hx, hy, 7, RED);
  cv.ring(hx, hy, 7, WHITE, 2);
  cv.circle(cxp, cyp, 7, NAVY);
  cv.ring(cxp, cyp, 7, WHITE, 2);
  drawText(cv, hx - 26, hy - 24, "HONIARA", 1, INK);
  drawText(cv, cxp - 48, cyp - 22, "CANBERRA", 1, INK);
  drawText(cv, x + 10, y + 8, "THE PACIFIC", 1, NAVY);
  cv.resetClip();
  cv.frame(x, y, w, h, INK, 2);
}

// --------------------------------------------------- column art: the tower
function drawTower(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  // Dusk sky.
  cv.vgrad(x, y, w, h, [214, 150, 96], [246, 214, 170]);
  // Ground line.
  cv.rect(x, y + h - 18, w, 18, [96, 84, 72]);
  // City blocks at the base, kept low.
  cv.rect(x + 16, y + h - 42, 60, 24, [70, 66, 78]);
  cv.rect(x + w - 82, y + h - 38, 66, 20, [70, 66, 78]);
  // The PIF tower: tall, tapering, glassy.
  const tx = x + Math.floor(w / 2) - 26;
  const tw = 52;
  const ty = y + 20;
  const th = h - 38;
  cv.poly([[tx, ty + th], [tx + 5, ty], [tx + tw - 5, ty], [tx + tw, ty + th]], [52, 78, 120]);
  // Glass bands.
  for (let i = 0; i < 6; i++) {
    const by = ty + 10 + i * ((th - 20) / 6);
    cv.hline(tx + 4, by, tw - 8, [140, 180, 220], 2);
  }
  // Impact burst halfway up the tower.
  const ix = x + Math.floor(w / 2);
  const iy = ty + Math.floor(th * 0.45);
  cv.circle(ix, iy, 17, ORANGE);
  cv.circle(ix, iy, 10, YELLOW);
  cv.circle(ix, iy, 5, WHITE);
  // Smoke curling up, kept well inside the panel.
  cv.circle(ix - 6, iy - 18, 9, SMOKE);
  cv.circle(ix + 7, iy - 28, 11, SMOKE);
  // Small flame licks on the facade below the burst.
  cv.poly([[ix - 11, iy + 20], [ix - 3, iy + 20], [ix - 7, iy + 5]], ORANGE);
  cv.poly([[ix + 5, iy + 22], [ix + 13, iy + 22], [ix + 9, iy + 8]], ORANGE);
  drawText(cv, x + 10, y + 8, "RIYADH", 1, INK);
  cv.resetClip();
  cv.frame(x, y, w, h, INK, 2);
}

// ------------------------------------------------------------------- page
function drawPage(): Canvas {
  const cv = new Canvas();
  const M = 20; // margin
  const CW = W - 2 * M; // 984

  // ---- masthead
  drawTextCentered(cv, 512, 26, "THE WORLD TODAY", 7, INK);
  cv.hline(M, 88, CW, INK, 4);
  cv.hline(M, 96, CW, INK, 2);
  drawText(cv, M, 108, "WEDNESDAY, 25 NOVEMBER 2026", 2, INK);
  drawText(cv, W - M - textWidth("WORLD EDITION", 2), 108, "WORLD EDITION", 2, RED);
  cv.hline(M, 132, CW, INK, 2);

  // ---- hero image
  drawHero(cv);

  // ---- main headline + deck
  drawText(cv, M, 536, "PAKISTAN'S FIRST ASTRONAUT", 4, INK);
  drawText(cv, M, 568, "REACHES CHINA'S SPACE STATION", 4, INK);
  drawPara(
    cv, M, 606,
    "SHENZHOU-24 LIFTS OFF 08:18, DOCKS 11:56; ZEESHAN ALI, 40, TO STAY 5-10 DAYS",
    2, INK, CW, 18,
  );

  // ---- divider
  cv.hline(M, 648, CW, INK, 3);

  // ---- two columns
  const colW = 482;
  const colY = 662;
  const artH = 100;
  const lx = M;
  const rx = M + colW + 20;

  // Left column: the Pacific treaty.
  drawText(cv, lx, colY, "THE PACIFIC", 2, RED);
  drawText(cv, lx, colY + 20, "SOLOMONS PICK CANBERRA", 3, INK);
  drawText(cv, lx, colY + 44, "AS TOP SECURITY PARTNER", 3, INK);
  drawPacificMap(cv, lx, colY + 68, colW, artH);
  drawPara(
    cv, lx, colY + 68 + artH + 8,
    "TREATY SIGNED IN CANBERRA. HONIARA: NO FOREIGN BASE; CHINA PACT TO LAPSE.",
    2, INK, colW, 18,
  );

  // Right column: the Gulf.
  drawText(cv, rx, colY, "THE GULF", 2, RED);
  drawText(cv, rx, colY + 20, "HOUTHIS CLAIM NEW STRIKES", 3, INK);
  drawText(cv, rx, colY + 44, "ON SAUDI OIL AND RIYADH", 3, INK);
  drawTower(cv, rx, colY + 68, colW, artH);
  drawPara(
    cv, rx, colY + 68 + artH + 8,
    "GROUP CLAIMS RAS TANURA REFINERY HIT. A DAY EARLIER, 11 HURT AT PIF TOWER.",
    2, INK, colW, 18,
  );

  // ---- bottom ticker: IN BRIEF
  const ty = 892;
  const th = 112;
  cv.rect(M, ty, CW, th, NAVY);
  cv.rect(M, ty, CW, 3, GOLD);
  drawText(cv, M + 16, ty + 12, "IN BRIEF", 2, GOLD);
  drawText(cv, M + 16, ty + 36, "• NORTH KOREA ORDERS SWITZERLAND'S ENVOY OUT WITHIN 48 HOURS", 2, WHITE);
  drawText(cv, M + 16, ty + 58, "• WASHINGTON POISED TO UNVEIL NEW TARIFFS ON 16 TRADING PARTNERS", 2, WHITE);
  drawText(cv, M + 16, ty + 80, "• NOR'EASTER THREATENS THANKSGIVING PARADE; CHINA PROBES SHANGHAI CHIEF", 2, WHITE);

  // ---- outer frame
  cv.frame(8, 8, W - 16, H - 16, INK, 3);
  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  const cv = drawPage();
  const png = encodePNG(W, H, cv.data);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
  console.log(`wrote ${path.join(outDir, "entry.png")} (${png.length} bytes)`);
}

main();
