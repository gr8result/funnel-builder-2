import type { TakeoffVectorPath } from "../state/takeoffTypes";

export async function extractVectorPaths(pdfPage: any): Promise<TakeoffVectorPath[]> {
  try {
    const operatorList = await pdfPage.getOperatorList();
    const paths: TakeoffVectorPath[] = [];
    for (let index = 0; index < Math.min(operatorList.fnArray?.length || 0, 1200); index += 1) {
      const args = operatorList.argsArray?.[index];
      if (!Array.isArray(args)) continue;
      const numbers = args.flat(Infinity).filter((value: unknown) => Number.isFinite(Number(value))).map(Number);
      if (numbers.length >= 4) {
        paths.push({
          id: `path-${index}`,
          type: "path",
          points: [
            { x: numbers[0], y: numbers[1] },
            { x: numbers[2], y: numbers[3] },
          ],
        });
      }
    }
    return paths;
  } catch {
    return [];
  }
}
