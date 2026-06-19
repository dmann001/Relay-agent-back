export function normalizePlaywrightKey(key: string): string {
  switch (key) {
    case 'ENTER':
    case 'RETURN':
      return 'Enter';
    case 'ESC':
    case 'ESCAPE':
      return 'Escape';
    case 'TAB':
      return 'Tab';
    case 'SPACE':
      return 'Space';
    case 'BACKSPACE':
      return 'Backspace';
    case 'DELETE':
    case 'DEL':
      return 'Delete';
    case 'HOME':
      return 'Home';
    case 'END':
      return 'End';
    case 'PAGEUP':
      return 'PageUp';
    case 'PAGEDOWN':
      return 'PageDown';
    case 'UP':
    case 'ARROWUP':
      return 'ArrowUp';
    case 'DOWN':
    case 'ARROWDOWN':
      return 'ArrowDown';
    case 'LEFT':
    case 'ARROWLEFT':
      return 'ArrowLeft';
    case 'RIGHT':
    case 'ARROWRIGHT':
      return 'ArrowRight';
    case 'CTRL':
    case 'CONTROL':
      return 'Control';
    case 'SHIFT':
      return 'Shift';
    case 'OPTION':
    case 'ALT':
      return 'Alt';
    case 'META':
    case 'CMD':
    case 'COMMAND':
      return 'Meta';
    default:
      return key;
  }
}

export function normalizeDragPath(path: unknown): Array<[number, number]> {
  if (!Array.isArray(path)) {
    throw new Error('drag action requires a path array');
  }

  return path.map((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      return [Number(point[0]), Number(point[1])] as [number, number];
    }
    if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
      const record = point as { x: number; y: number };
      return [Number(record.x), Number(record.y)] as [number, number];
    }
    throw new Error('drag path entries must be coordinate pairs or {x, y} objects');
  });
}
