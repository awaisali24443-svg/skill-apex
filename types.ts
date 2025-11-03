export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export type QuizData = Question[];

declare global {
  interface Window {
      process: {
          env: {
              API_KEY: string;
          }
      }
  }
}
