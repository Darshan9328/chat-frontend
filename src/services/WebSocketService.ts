import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface ChatMessage {
  content: string;
  sender: string;
  recipient?: string;
  conversationId?: string;
  type: 'CHAT' | 'JOIN' | 'LEAVE' | 'TYPING' | 'ONLINE' | 'OFFLINE';
  timestamp: string;
  status?: string;
}

export class WebSocketService {
  private stompClient: Client | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;

  connect(username: string, onMessageReceived: (message: ChatMessage) => void, onTyping?: (message: ChatMessage) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create WebSocket connection
      const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:8080/ws';
      const socket = new SockJS(wsUrl);
      
      this.stompClient = new Client({
        webSocketFactory: () => socket,
        debug: (str) => {
          console.log('STOMP Debug:', str);
        },
        onConnect: (frame) => {
          console.log('Connected to WebSocket:', frame);
          this.connected = true;
          this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          
          // Subscribe to user-specific queues resolved by broker (no username in path)
          this.stompClient?.subscribe(`/user/queue/messages`, (message) => {
            const chatMessage: ChatMessage = JSON.parse(message.body);
            onMessageReceived(chatMessage);
          });

          // Fallback subscription: user-specific topic broadcast by server
          this.stompClient?.subscribe(`/topic/user/${username}/queue/messages`, (message) => {
            const chatMessage: ChatMessage = JSON.parse(message.body);
            onMessageReceived(chatMessage);
          });
          
          // Subscribe to typing indicators
          this.stompClient?.subscribe(`/user/queue/typing`, (message) => {
            const chatMessage: ChatMessage = JSON.parse(message.body);
            if (onTyping) {
              onTyping(chatMessage);
            }
          });
          
          // Subscribe to status updates
          this.stompClient?.subscribe(`/user/queue/status`, (message) => {
            console.log('Status update:', message.body);
          });
          
          // Send user join message
          this.sendJoinMessage(username);
          resolve();
        },
        onStompError: (frame) => {
          console.error('STOMP Error:', frame);
          this.connected = false;
          reject(new Error(`WebSocket connection failed: ${frame.headers?.message || 'Unknown error'}`));
        },
        onDisconnect: () => {
          console.log('Disconnected from WebSocket');
          this.connected = false;
        }
      });

      this.stompClient.activate();
    });
  }

  sendPrivateMessage(content: string, sender: string, recipient: string, conversationId: string): void {
    if (this.stompClient && this.connected) {
      const chatMessage: ChatMessage = {
        content,
        sender,
        recipient,
        conversationId,
        type: 'CHAT',
        timestamp: new Date().toISOString(),
        status: 'SENT'
      };
      
      this.stompClient.publish({
        destination: '/app/chat.sendPrivateMessage',
        body: JSON.stringify(chatMessage)
      });
    }
  }

  sendTypingIndicator(sender: string, recipient: string): void {
    if (this.stompClient && this.connected) {
      const typingMessage: ChatMessage = {
        content: '',
        sender,
        recipient,
        type: 'TYPING',
        timestamp: new Date().toISOString()
      };
      
      this.stompClient.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify(typingMessage)
      });
    }
  }

  markAsRead(sender: string, conversationId: string): void {
    if (this.stompClient && this.connected) {
      const readMessage: ChatMessage = {
        content: '',
        sender,
        conversationId,
        type: 'CHAT',
        timestamp: new Date().toISOString()
      };
      
      this.stompClient.publish({
        destination: '/app/chat.markAsRead',
        body: JSON.stringify(readMessage)
      });
    }
  }

  private sendJoinMessage(username: string): void {
    if (this.stompClient && this.connected) {
      const joinMessage: ChatMessage = {
        content: '',
        sender: username,
        type: 'JOIN',
        timestamp: new Date().toISOString()
      };
      
      this.stompClient.publish({
        destination: '/app/chat.addUser',
        body: JSON.stringify(joinMessage)
      });
    }
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}