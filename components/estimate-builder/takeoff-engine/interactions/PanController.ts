export function isPanGesture(event: { button: number; buttons: number }, activeTool: string, spacePressed: boolean) {
  return activeTool === "pan" || spacePressed || event.button === 1 || event.buttons === 4;
}
