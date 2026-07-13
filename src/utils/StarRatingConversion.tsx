export function calculateStarRating(
  value: number,
  max = 100,
): number {
  return Math.max(
    0,
    Math.min(5, Math.round((value / max) * 10) / 2),
  );
}