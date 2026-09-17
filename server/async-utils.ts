// Sequential helpers preserve ordering and transaction ownership when validation needs I/O.
export async function mapAsync<T, R>(
  items: T[],
  fn: (item: T, index: number, items: T[]) => R | Promise<R>,
): Promise<R[]> {
  const result: R[] = [];
  for (let i = 0; i < items.length; i++)
    result.push(await fn(items[i], i, items));
  return result;
}
export async function filterAsync<T>(
  items: T[],
  fn: (item: T, index: number, items: T[]) => unknown,
): Promise<T[]> {
  const result: T[] = [];
  for (let i = 0; i < items.length; i++)
    if (await fn(items[i], i, items)) result.push(items[i]);
  return result;
}
export async function flatMapAsync<T, R>(
  items: T[],
  fn: (item: T, index: number, items: T[]) => R | R[] | Promise<R | R[]>,
): Promise<R[]> {
  return (await mapAsync(items, fn)).flat() as R[];
}
export async function reduceAsync<T, R>(
  items: T[],
  fn: (sum: R, item: T, index: number, items: T[]) => R | Promise<R>,
  initial: R,
): Promise<R> {
  let result = initial;
  for (let i = 0; i < items.length; i++)
    result = await fn(result, items[i], i, items);
  return result;
}
