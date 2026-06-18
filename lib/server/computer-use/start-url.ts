export function inferComputerUseStartUrl(task: string, configuredStartUrl?: string): string {
  if (configuredStartUrl && configuredStartUrl !== 'about:blank') {
    return configuredStartUrl;
  }

  const explicit = task.match(/https?:\/\/[^\s)'"]+/i)?.[0]?.replace(/[,.;]+$/, '');
  if (explicit) return explicit;

  const lower = task.toLowerCase();
  if (lower.includes('weather.com') || /\bweather\b/.test(lower)) return 'https://weather.com/';
  if (lower.includes('google')) return 'https://www.google.com/';
  if (lower.includes('bing')) return 'https://www.bing.com/';
  if (lower.includes('duckduckgo')) return 'https://duckduckgo.com/';

  return 'https://www.google.com/';
}
