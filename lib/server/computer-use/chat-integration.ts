import type { ChatTurn } from '@/lib/server/openai';
import { runComputerUseAgent, type ComputerUseRunResult } from '@/lib/server/computer-use';

export function withComputerUseMetadata(content: string, run: ComputerUseRunResult) {
  const encoded = Buffer.from(JSON.stringify({
    computerUse: {
      driver: run.driver,
      startUrl: run.startUrl,
      stepCount: run.stepCount,
      truncated: run.truncated,
      steps: run.steps.map((step) => ({
        step: step.step,
        callId: step.callId,
        actions: step.actions.map((action) => action.type),
        driver: step.driver,
      })),
    },
  })).toString('base64url');
  return `${content}\n\n<!-- relay-chat:${encoded} -->`;
}

function buildComputerUseTaskInput(params: {
  history?: ChatTurn[];
  prompt: string;
}) {
  const history = (params.history || []).slice(-6);
  if (!history.length) return params.prompt;

  const messages: Array<Record<string, unknown>> = history.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  if (history[history.length - 1]?.role !== 'user' || history[history.length - 1]?.content !== params.prompt) {
    messages.push({ role: 'user', content: params.prompt });
  }

  return messages;
}

export async function runChatComputerUse(params: {
  instructions: string;
  history?: ChatTurn[];
  prompt: string;
  model?: string;
  abortSignal?: AbortSignal;
}) {
  return runComputerUseAgent({
    instructions: [
      params.instructions,
      'The user message is a browser task. Ignore unrelated email metadata unless the user explicitly asks you to use it.',
      'Use the computer tool until you can answer from what is visible in the browser.',
    ].join('\n'),
    task: params.prompt,
    input: buildComputerUseTaskInput(params),
    model: params.model,
    abortSignal: params.abortSignal,
  });
}
