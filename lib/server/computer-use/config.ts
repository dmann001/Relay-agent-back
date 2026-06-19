export type ComputerUseDriver = 'auto' | 'simulated' | 'playwright';

export interface ComputerUseConfig {
  driver: ComputerUseDriver;
  model: string;
  maxSteps: number;
  viewportWidth: number;
  viewportHeight: number;
  startUrl: string;
  requestTimeoutMs: number;
}

export function resolveComputerUseModel(requested?: string): string {
  if (process.env.COMPUTER_USE_MODEL?.trim()) {
    return process.env.COMPUTER_USE_MODEL.trim();
  }

  const fallback = process.env.OPENAI_MODEL || 'gpt-5.5';
  if (!requested) return fallback;

  // Mini/nano chat models are a poor fit for multi-step browser control.
  if (/mini|nano/i.test(requested)) return fallback;
  return requested;
}

export function getComputerUseConfig(): ComputerUseConfig {
  const configured = process.env.COMPUTER_USE_DRIVER;
  const driver: ComputerUseDriver =
    configured === 'playwright' ? 'playwright'
      : configured === 'simulated' ? 'simulated'
        : 'auto';

  return {
    driver,
    model: process.env.COMPUTER_USE_MODEL || process.env.OPENAI_MODEL || 'gpt-5.5',
    maxSteps: Math.max(1, Math.min(30, Number.parseInt(process.env.COMPUTER_USE_MAX_STEPS || '16', 10) || 16)),
    viewportWidth: Number.parseInt(process.env.COMPUTER_USE_VIEWPORT_WIDTH || '1280', 10) || 1280,
    viewportHeight: Number.parseInt(process.env.COMPUTER_USE_VIEWPORT_HEIGHT || '720', 10) || 720,
    startUrl: process.env.COMPUTER_USE_START_URL || 'about:blank',
    requestTimeoutMs: Number.parseInt(process.env.COMPUTER_USE_TIMEOUT_MS || '120000', 10) || 120_000,
  };
}

export function computerUseToolDefinition() {
  return { type: 'computer' } as const;
}
