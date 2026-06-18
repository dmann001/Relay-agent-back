import type { ComputerAction } from '@/lib/server/computer-use/types';
import { normalizeDragPath, normalizePlaywrightKey } from '@/lib/server/computer-use/normalize-keys';

export type PlaywrightComputerPage = {
  mouse: {
    click: (x: number, y: number, options?: { button?: string }) => Promise<void>;
    dblclick: (x: number, y: number, options?: { button?: string }) => Promise<void>;
    move: (x: number, y: number) => Promise<void>;
    down: () => Promise<void>;
    up: () => Promise<void>;
    wheel: (deltaX: number, deltaY: number) => Promise<void>;
  };
  keyboard: {
    press: (key: string, options?: { delay?: number }) => Promise<void>;
    type: (text: string, options?: { delay?: number }) => Promise<void>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
  waitForLoadState: (state?: 'load' | 'domcontentloaded' | 'networkidle') => Promise<void>;
  bringToFront: () => Promise<void>;
};

const TYPE_DELAY_MS = 35;
const SETTLE_MS = 500;
const WAIT_ACTION_MS = 2000;

async function settlePage(page: PlaywrightComputerPage) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
}

export async function executePlaywrightComputerActions(page: PlaywrightComputerPage, actions: ComputerAction[]) {
  await page.bringToFront().catch(() => {});

  for (const action of actions) {
    switch (action.type) {
      case 'click':
        await page.mouse.click(action.x ?? 0, action.y ?? 0, {
          button: action.button ?? 'left',
        });
        await settlePage(page);
        break;
      case 'double_click':
        await page.mouse.dblclick(action.x ?? 0, action.y ?? 0, {
          button: action.button ?? 'left',
        });
        await settlePage(page);
        break;
      case 'drag': {
        const path = normalizeDragPath(action.path);
        if (path.length < 2) {
          throw new Error('drag action requires at least two path points');
        }
        const [[startX, startY], ...rest] = path;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        for (const [x, y] of rest) {
          await page.mouse.move(x, y);
        }
        await page.mouse.up();
        await settlePage(page);
        break;
      }
      case 'move':
        await page.mouse.move(action.x ?? 0, action.y ?? 0);
        break;
      case 'scroll':
        await page.mouse.move(action.x ?? 0, action.y ?? 0);
        await page.mouse.wheel(action.scrollX ?? 0, action.scrollY ?? 0);
        await page.waitForTimeout(300);
        break;
      case 'keypress':
        for (const key of action.keys || []) {
          await page.keyboard.press(normalizePlaywrightKey(key), { delay: TYPE_DELAY_MS });
        }
        await settlePage(page);
        break;
      case 'type':
        await page.keyboard.type(action.text ?? '', { delay: TYPE_DELAY_MS });
        await settlePage(page);
        break;
      case 'wait':
        await page.waitForTimeout(WAIT_ACTION_MS);
        break;
      case 'screenshot':
        break;
      default:
        throw new Error(`Unsupported computer action: ${action.type}`);
    }
  }
}

export function summarizeComputerActions(actions: ComputerAction[]) {
  return actions.map((action) => {
    switch (action.type) {
      case 'click':
        return `click (${action.x}, ${action.y})`;
      case 'double_click':
        return `double_click (${action.x}, ${action.y})`;
      case 'type':
        return `type "${(action.text || '').slice(0, 40)}"`;
      case 'scroll':
        return `scroll (${action.scrollX ?? 0}, ${action.scrollY ?? 0})`;
      case 'keypress':
        return `keypress ${(action.keys || []).join('+')}`;
      case 'drag':
        return 'drag';
      case 'move':
        return `move (${action.x}, ${action.y})`;
      case 'wait':
        return 'wait';
      case 'screenshot':
        return 'screenshot';
      default:
        return String(action.type);
    }
  });
}
