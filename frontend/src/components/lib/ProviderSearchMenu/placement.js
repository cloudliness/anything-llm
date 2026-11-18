/** Preferred menu height, matching the previous fixed max-height. */
export const PROVIDER_MENU_MAX_HEIGHT = 310;
/** Keep the menu off the very edge of the viewport. */
export const PROVIDER_MENU_GUTTER = 8;

/**
 * Place the provider menu so its box stays inside the viewport.
 *
 * The menu prefers the historical layout: top-aligned with the trigger and
 * growing downward. When that side cannot fit the preferred height and there
 * is more room above the trigger, the menu anchors to the trigger's bottom
 * and grows upward. `maxHeight` is capped to the space on the chosen side
 * (and to the preferred height) so the option list scrolls inside the menu
 * instead of running off screen.
 *
 * Anchor edges are clamped into the visible viewport first, so a trigger that
 * is only partly on screen still produces a menu that fits.
 *
 * @param {{top: number, bottom: number, left: number, width: number}} anchor
 * @param {{width: number, height: number}} viewport
 * @returns {{
 *   openUpward: boolean,
 *   top: number | undefined,
 *   bottom: number | undefined,
 *   left: number,
 *   width: number,
 *   maxHeight: number,
 * }}
 */
export function getProviderMenuPlacement(anchor, viewport) {
  const gutter = PROVIDER_MENU_GUTTER;
  const viewTop = gutter;
  const viewBottom = Math.max(viewTop, viewport.height - gutter);
  const viewLeft = gutter;
  const viewRight = Math.max(viewLeft, viewport.width - gutter);

  const anchorTop = clamp(anchor.top, viewTop, viewBottom);
  const anchorBottom = clamp(anchor.bottom, viewTop, viewBottom);
  const spaceBelow = viewBottom - anchorTop;
  const spaceAbove = anchorBottom - viewTop;
  const openUpward =
    spaceBelow < PROVIDER_MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    0,
    Math.min(PROVIDER_MENU_MAX_HEIGHT, openUpward ? spaceAbove : spaceBelow)
  );

  const width = Math.max(0, Math.min(anchor.width, viewRight - viewLeft));
  let left = anchor.left;
  if (left < viewLeft) left = viewLeft;
  if (left + width > viewRight) left = Math.max(viewLeft, viewRight - width);

  if (openUpward) {
    return {
      openUpward: true,
      top: undefined,
      bottom: Math.max(gutter, viewport.height - anchorBottom),
      left,
      width,
      maxHeight,
    };
  }

  return {
    openUpward: false,
    top: anchorTop,
    bottom: undefined,
    left,
    width,
    maxHeight,
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
