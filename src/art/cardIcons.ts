// Spell icons for the card frames, one per spell, in two sizes: assets/cards/<id>.png is the 40x40 HD PixelLab art
// (tools/pixellab/build_card_icons.py), drawn at the 48px fighters' density; assets/cards/small/<id>.png is the
// 20x20 icon (drawn to the fighter sprite rules, project files art/card-icons/) for small thumbnails.
import { assetImage } from '../engine/assets';

export const ICON_SIZE = 20;
/** HD icon pixels per small icon pixel. */
export const CARD_ART_RES = 2;

/** The spell's 20px icon, or null if it has none. */
export const cardIconCanvas = (id: string): HTMLImageElement | null => assetImage(`cards/small/${id}.png`);

/** The spell's HD icon (ICON_SIZE * CARD_ART_RES square), or null if it has none. */
export const cardIconHd = (id: string): HTMLImageElement | null => assetImage(`cards/${id}.png`);

/** Draw the spell's icon in an ICON_SIZE * z box at (x, y): the HD art where z is a whole multiple of its density
 *  (it is never scaled down or stretched), the 20px icon otherwise. False if the spell has neither. */
export function drawIconAt(c: CanvasRenderingContext2D, id: string, x: number, y: number, z: number): boolean {
  const hd = z % CARD_ART_RES === 0 ? cardIconHd(id) : null, img = hd ?? cardIconCanvas(id);
  if (!img) return false;
  c.imageSmoothingEnabled = false;
  c.drawImage(img, x, y, ICON_SIZE * z, ICON_SIZE * z);
  return true;
}
