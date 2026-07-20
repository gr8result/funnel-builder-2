export async function processPlanPage<T>(work: () => Promise<T>) {
  return work();
}
