import { calculateStarRating } from "../../utils/StarRatingConversion";

interface StarRatingProps {
  value: number; // raw value on a 0..max scale
  max?: number;
}

/**
 * Renders a 0-100 (or any 0..max) value as a 5-star rating with half-star
 * granularity - 10 effective levels, same resolution as a blunt "1-10"
 * scale would give, but read at a glance instead of parsed as a number.
 * A raw score like 73 reads as fairly meaningless precision; "3.5 stars"
 * reads as an actual opinion. Rendered as two stacked star strings (a muted
 * track and a clipped, colored fill) rather than swapping character glyphs,
 * so partial stars are a clean width clip instead of relying on a half-star
 * character that not every font renders well.
 */
export function StarRating({ value, max = 100 }: StarRatingProps) {
  const stars = calculateStarRating(value, max);
  const fillPercent = (stars / 5) * 100;

  return (
    <span className="star-rating" title={`${stars} / 5`}>
      <span className="star-rating-track">★★★★★</span>
      <span
        className="star-rating-fill"
        style={{ width: `${fillPercent}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}