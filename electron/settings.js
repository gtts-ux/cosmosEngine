export const defaults = Object.freeze({
  quality: 'medium', bloom: 0.45, stars: 6000, orbitLines: false,
  labels: true, shadows: true, balanced: false, exposure: 1.1,
});
export function sanitizeSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...defaults };
  const result = { ...defaults };
  for (const key of ['orbitLines', 'labels', 'shadows', 'balanced']) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  if (['low', 'medium', 'high'].includes(input.quality)) result.quality = input.quality;
  for (const [key, min, max] of [['bloom', 0, 1.5], ['stars', 0, 16000], ['exposure', 0.5, 2]]) {
    if (Number.isFinite(input[key])) result[key] = Math.max(min, Math.min(max, input[key]));
  }
  result.stars = Math.round(result.stars);
  return result;
}
