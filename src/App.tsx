import React, { useState, useEffect, useRef } from 'react';
import { WebSocketService, ChatMessage } from './services/WebSocketService';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatArea } from './components/ChatArea';
import { apiService } from './services/apiService';
import authService from './services/authService';
import './styles/ChatApp.css';
import './styles/ModernChat.css';
import './App.css'; // Keep for any remaining legacy styles

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.78:8080/api';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');

  // Theme (light/dark)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('theme') === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', theme);
    } catch {}
    document.documentElement.setAttribute('data-theme', theme);
  }, [isDark]);
  
  // Private messaging state
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [refreshConversations, setRefreshConversations] = useState(0); // Counter to trigger sidebar refresh
  
  const webSocketService = useRef<WebSocketService | null>(null);
  const chatAreaRef = useRef<any>(null);
  const sidebarRef = useRef<any>(null);
  const selectedConversationRef = useRef<string | null>(null);
  const otherParticipantRef = useRef<string | null>(null);

  // Check for existing authentication on app start
  useEffect(() => {
    const savedUsername = authService.getUsername();
    if (savedUsername && authService.isAuthenticated()) {
      setCurrentUser(savedUsername);
    }
  }, []);

  // Connect to WebSocket when user logs in
  useEffect(() => {
    if (currentUser) {
      connectToWebSocket();
    }

    // keep refs in sync when state changes
    selectedConversationRef.current = selectedConversation;
    otherParticipantRef.current = otherParticipant;
    
    return () => {
      if (webSocketService.current) {
        webSocketService.current.disconnect();
      }
    };
  }, [currentUser, selectedConversation, otherParticipant]);

  // Function to show browser notification for new messages
  const showMessageNotification = (message: ChatMessage) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`New message from ${message.sender}`, {
        body: message.content,
        icon: '/favicon.ico', // You can add a custom icon here
        tag: `message-${message.sender}` // This prevents duplicate notifications
      });
      
      // Auto close notification after 5 seconds
      setTimeout(() => notification.close(), 5000);
      
      // Optional: Click to focus on the conversation
      notification.onclick = () => {
        window.focus();
        // You could also automatically select the conversation here
        notification.close();
      };
    }
  };

  // Request notification permission when user logs in
  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  const connectToWebSocket = async () => {
    try {
      setConnectionStatus('Connecting...');
      webSocketService.current = new WebSocketService();

      // Simple de-dup cache for incoming messages (content+sender+timestamp+conv)
      const recentKeys = new Set<string>();
      const remember = (key: string) => {
        recentKeys.add(key);
        setTimeout(() => recentKeys.delete(key), 10000); // keep for 10s
      };

      await webSocketService.current.connect(
        currentUser!,
        (message: ChatMessage) => {
          console.log('=== WebSocket Message Received ===');
          console.log('Message:', message);
          console.log('Type:', message.type);
          console.log('Sender:', message.sender);
          console.log('Recipient:', message.recipient);
          console.log('ConversationId:', message.conversationId);

          if (message.type === 'CHAT') {
            // Skip echo of self-sent messages (we already add optimistically)
            if (message.sender === currentUser) {
              return;
            }

            // Only show messages for the active conversation (using refs to avoid stale closures)
            const activeConversationId = selectedConversationRef.current;
            if (message.conversationId !== activeConversationId) {
              // Still refresh sidebar for previews/unreads
              if (sidebarRef.current) sidebarRef.current.refreshConversations();
              else setRefreshConversations(prev => prev + 1);
              return;
            }

            const key = `${message.sender}|${message.recipient}|${message.timestamp}|${message.conversationId}|${message.content}`;
            if (recentKeys.has(key)) {
              return; // duplicate from multiple subscriptions
            }
            remember(key);

            const messageForChat = {
              content: message.content,
              senderUsername: message.sender,
              recipientUsername: message.recipient || '',
              createdAt: message.timestamp
            };

            if (chatAreaRef.current) {
              console.log('[App] Calling chatAreaRef.current.addMessage with:', messageForChat);
              chatAreaRef.current.addMessage(messageForChat);
            }

            // Mark as read immediately for active conversation and refresh sidebar counts
            if (activeConversationId && currentUser) {
              apiService.markMessagesAsRead(activeConversationId, currentUser)
                .then(() => {
                  // Also emit read receipt over WS (if supported)
                  if (webSocketService.current?.isConnected()) {
                    webSocketService.current.markAsRead(currentUser, activeConversationId);
                  }
                  if (sidebarRef.current) {
                    sidebarRef.current.refreshConversations();
                  } else {
                    setRefreshConversations(prev => prev + 1);
                  }
                })
                .catch((e) => console.error('Failed to mark messages as read:', e));
            } else {
              // Fallback: just refresh sidebar to show latest preview
              if (sidebarRef.current) {
                sidebarRef.current.refreshConversations();
              } else {
                setRefreshConversations(prev => prev + 1);
              }
            }

            showMessageNotification(message);
          }
        },
        (message: ChatMessage) => {
          // Handle typing indicators
          if (message.type === 'TYPING') {
            setTypingUsers(prev => {
              if (!prev.includes(message.sender)) {
                return [...prev, message.sender];
              }
              return prev;
            });

            // Remove typing indicator after 3 seconds
            setTimeout(() => {
              setTypingUsers(prev => prev.filter(user => user !== message.sender));
            }, 3000);
          }
        },
        // onRead receipt handler: when the other user reads messages
        (readMessage: ChatMessage) => {
          try {
            // Only process for the active conversation
            const activeConversationId = selectedConversationRef.current;
            if (readMessage.conversationId === activeConversationId) {
              if (chatAreaRef.current?.markAllSentAsRead) {
                chatAreaRef.current.markAllSentAsRead();
              }
              // Also refresh sidebar to reflect zero unread
              if (sidebarRef.current) {
                sidebarRef.current.refreshConversations();
              } else {
                setRefreshConversations(prev => prev + 1);
              }
            }
          } catch (e) {
            console.error('Failed processing READ receipt:', e);
          }
        }
      );

      setConnectionStatus('Connected');
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const handleAuth = async () => {
    try {
      if (isRegistering) {
        await authService.register(username, password);
        alert('Registration successful! Please login.');
        setIsRegistering(false);
      } else {
        const response = await authService.login(username, password);
        console.log('Login successful:', response);
        setCurrentUser(username);
        setUsername('');
        setPassword('');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      alert(error.message || 'Authentication failed');
    }
  };

  // Handle conversation selection
  const handleConversationSelect = async (conversationId: string, participant: string) => {
    setSelectedConversation(conversationId);
    setOtherParticipant(participant);
    selectedConversationRef.current = conversationId;
    otherParticipantRef.current = participant;

    // Mark messages as read for this conversation and refresh sidebar counts
    try {
      await apiService.markMessagesAsRead(conversationId, currentUser!);
    } catch (e) {
      console.error('Failed to mark messages as read:', e);
    }

    if (sidebarRef.current) {
      sidebarRef.current.refreshConversations();
    } else {
      setRefreshConversations(prev => prev + 1);
    }
  };

  // Handle sending private message
  const handleSendMessage = (message: string, recipient: string, conversationId: string) => {
    if (!webSocketService.current?.isConnected()) return;

    // Send via WebSocket
    webSocketService.current.sendPrivateMessage(message, currentUser!, recipient, conversationId);

    // Optimistically add the message to the chat area for instant display
    const optimisticMessage = {
      content: message,
      senderUsername: currentUser!,
      recipientUsername: recipient,
      createdAt: new Date().toISOString(),
      status: 'SENT'
    };
    if (chatAreaRef.current?.addMessage) {
      chatAreaRef.current.addMessage(optimisticMessage);
    }

    // Refresh conversations so sidebar shows latest preview
    if (sidebarRef.current) {
      sidebarRef.current.refreshConversations();
    } else {
      setRefreshConversations(prev => prev + 1);
    }
  };

  const logout = () => {
    if (webSocketService.current) {
      webSocketService.current.disconnect();
    }
    authService.logout(); // Clear stored auth data
    setCurrentUser(null);
    setSelectedConversation(null);
    setOtherParticipant(null);
    setTypingUsers([]);
    setConnectionStatus('Disconnected');
  };


  if (!currentUser) {
    return (
      <div className="App">
        <div className="auth-container">
          <div className="auth-form">
            <h1>Private Chat</h1>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleAuth}>
              {isRegistering ? 'Register' : 'Login'}
            </button>
            <button onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'Switch to Login' : 'Switch to Register'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="chat-app">
        <ChatSidebar
          ref={sidebarRef}
          currentUser={currentUser}
          selectedConversation={selectedConversation}
          onConversationSelect={handleConversationSelect}
          onLogout={logout}
          refreshTrigger={refreshConversations}
        />
        <ChatArea
          ref={chatAreaRef}
          conversationId={selectedConversation}
          otherParticipant={otherParticipant}
          currentUser={currentUser}
          onSendMessage={handleSendMessage}
          typingUsers={typingUsers}
          webSocketService={webSocketService.current}
        />
      </div>
      <button
        className="theme-toggle"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
        onClick={() => setIsDark(v => !v)}
      >{isDark ? '🌙' : '☀️'}</button>
    </div>
  );
}

export default App;