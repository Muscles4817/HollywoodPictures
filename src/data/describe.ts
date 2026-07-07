/** Pulls just the `description` field out of a profile map, keyed the same way. */
export function pluckDescriptions<T extends string, P extends { description: string }>(
  profiles: Record<T, P>,
): Record<T, string> {
  return Object.fromEntries(Object.entries(profiles).map(([key, profile]) => [key, (profile as P).description])) as Record<
    T,
    string
  >;
}
