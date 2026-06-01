/**
 * Runs `fn` over `items` with a bounded number of concurrent lanes.
 *
 * Never rejects: each item resolves to a PromiseSettledResult so a single failure
 * (e.g. one LLM/API error) doesn't abort the whole batch. Same spirit as the bounded
 * standings fan-out in computeFeaturedMatches.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const total = items.length;
  const results = new Array<PromiseSettledResult<R>>(total);
  const lanes = Math.max(1, Math.min(limit, total));
  let cursor = 0;

  const runLane = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= total) return;
      try {
        const value = await fn(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: lanes }, () => runLane()));
  return results;
}
