export {};

declare global {
  interface Window {
    mushu: {
      invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
      on(eventName: string, callback: (payload: unknown) => void): () => void;
      emitAudioChunk(chunk: {
        bytes?: ArrayBuffer;
        done?: boolean;
        error?: string;
        level?: number;
        mimeType?: string;
        text?: string;
        ts?: number;
      }): void;
    };
  }
}
