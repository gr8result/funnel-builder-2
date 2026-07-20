export function getRelativePoint(event: { clientX: number; clientY: number }, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
