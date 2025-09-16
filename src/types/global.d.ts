// Global type declarations for the chat application

declare global {
  interface Window {
    webSocketService?: {
      isConnected(): boolean;
      sendTypingIndicator(sender: string, recipient: string): void;
      sendPrivateMessage(content: string, sender: string, recipient: string, conversationId: string): void;
      disconnect(): void;
    };
  }
}

export {};
