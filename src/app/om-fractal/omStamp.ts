// Turns the source Om image (a black glyph on a white background) into a
// reusable "stamp": white becomes transparent and black becomes a solid
// tint color, based on each pixel's luminance. This lets many copies of the
// glyph be composited on top of each other (and on a dark background)
// without their white backgrounds covering one another.
export function buildOmStamp(image: HTMLImageElement, tint: [number, number, number]): HTMLCanvasElement {
  // Rasterize close to the source SVG's native resolution (1100x1100) so
  // the root/largest generation of the fractal — which can be drawn at
  // several hundred px on a resized, high-DPI canvas — isn't visibly
  // upscaled from a low-res cached bitmap. This only runs once per page
  // load, not per frame, so the extra resolution costs nothing noticeable.
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Fill with white first: the traced SVG has a transparent background (no
  // white rect), and without this, untouched/transparent pixels read back
  // as rgb(0,0,0) with alpha 0 — the same RGB as the black glyph fill —
  // making the luminance check below unable to tell background from glyph.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = tint[0];
    data[i + 1] = tint[1];
    data[i + 2] = tint[2];
    data[i + 3] = 255 - luminance;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export interface GlyphBlob {
  // Center and radius of one connected ink region, as a fraction (0..1) of
  // the glyph's own bounding square — so it can be scaled to any later
  // drawing size.
  cx: number;
  cy: number;
  r: number;
  area: number;
}

// Finds the glyph's own disconnected ink regions (for the Om glyph, this is
// the main curve, the crescent, and the dot, each floating separately from
// the others) via flood fill, sorted smallest-area first. This lets a
// recursive generator anchor itself to features the shape actually has,
// the same way the Apex Fractal's generator falls out of a segment's own
// midpoint, rather than picking arbitrary offsets by eye.
export function findGlyphBlobs(image: HTMLImageElement): GlyphBlob[] {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const ink = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    ink[i] = lum < 128 ? 1 : 0;
  }

  const visited = new Uint8Array(size * size);
  const blobs: GlyphBlob[] = [];
  const stack: number[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const start = y * size + x;
      if (!ink[start] || visited[start]) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      stack.length = 0;
      stack.push(start);
      visited[start] = 1;

      while (stack.length > 0) {
        const cur = stack.pop() as number;
        const curX = cur % size;
        const curY = (cur / size) | 0;
        count++;
        if (curX < minX) minX = curX;
        if (curX > maxX) maxX = curX;
        if (curY < minY) minY = curY;
        if (curY > maxY) maxY = curY;

        if (curX > 0 && !visited[cur - 1] && ink[cur - 1]) {
          visited[cur - 1] = 1;
          stack.push(cur - 1);
        }
        if (curX < size - 1 && !visited[cur + 1] && ink[cur + 1]) {
          visited[cur + 1] = 1;
          stack.push(cur + 1);
        }
        if (curY > 0 && !visited[cur - size] && ink[cur - size]) {
          visited[cur - size] = 1;
          stack.push(cur - size);
        }
        if (curY < size - 1 && !visited[cur + size] && ink[cur + size]) {
          visited[cur + size] = 1;
          stack.push(cur + size);
        }
      }

      // Ignore specks from JPEG/trace artifacts.
      if (count < 8) continue;
      blobs.push({
        cx: (minX + maxX) / 2 / size,
        cy: (minY + maxY) / 2 / size,
        r: Math.max(maxX - minX, maxY - minY) / 2 / size,
        area: count,
      });
    }
  }

  return blobs.sort((a, b) => a.area - b.area);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
