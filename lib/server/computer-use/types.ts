export type ComputerActionType =
  | 'click'
  | 'double_click'
  | 'scroll'
  | 'type'
  | 'wait'
  | 'keypress'
  | 'drag'
  | 'move'
  | 'screenshot';

export interface ComputerAction {
  type: ComputerActionType | string;
  x?: number;
  y?: number;
  button?: string;
  text?: string;
  keys?: string[];
  path?: Array<[number, number] | { x: number; y: number }>;
  scrollX?: number;
  scrollY?: number;
}

export interface ComputerCallItem {
  type: 'computer_call';
  call_id: string;
  actions: ComputerAction[];
  status?: string;
}

export interface ComputerUseStepLog {
  step: number;
  callId: string;
  actions: ComputerAction[];
  driver: string;
}

export interface ComputerUseRunResult {
  answer: string;
  model: string;
  responseId?: string;
  driver: string;
  startUrl?: string;
  steps: ComputerUseStepLog[];
  stepCount: number;
  truncated: boolean;
}

export interface ComputerUseHarness {
  readonly driver: string;
  readonly startUrl?: string;
  executeActions(actions: ComputerAction[]): Promise<void>;
  captureScreenshot(): Promise<Buffer>;
  dispose(): Promise<void>;
}
