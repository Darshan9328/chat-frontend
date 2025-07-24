import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface ChatMessage {
  content: string;
  sender: string;
  type: 'CHAT' | 'JOIN' | 'LEAVE';
  timestamp: string;
}

export class WebSocketService {
  private stompClient: Client | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;

  connect(username: string, onMessageReceived: (message: ChatMessage) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create WebSocket connection
      const wsUrl = process.env.REACT_APP_WS_URL || 'http://172.20.10.3:8080/ws';
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
          
          // Subscribe to public topic to receive messages
          this.stompClient?.subscribe('/topic/public', (message) => {
            const chatMessage: ChatMessage = JSON.parse(message.body);
            onMessageReceived(chatMessage);
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

  sendMessage(content: string, sender: string): void {
    if (this.stompClient && this.connected) {
      const chatMessage: ChatMessage = {
        content,
        sender,
        type: 'CHAT',
        timestamp: new Date().toISOString()
      };
      
      this.stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(chatMessage)
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