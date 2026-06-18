declare module 'playwright' {
  export const chromium: {
    launch: (options: Record<string, unknown>) => Promise<{
      newContext: (options?: Record<string, unknown>) => Promise<{
        newPage: () => Promise<{
          goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<void>;
          screenshot: (options: { type: 'png' }) => Promise<Buffer>;
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
        }>;
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };
}
