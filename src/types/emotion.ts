export enum InputMode {
  TEXT = 'TEXT',
  WEBCAM = 'WEBCAM',
  VOICE = 'VOICE',
}

export enum AppStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface AnalysisResult {
  emotion: string;
  confidence: number;
  explanation: string;
  emoji: string;
  color: string;
}
