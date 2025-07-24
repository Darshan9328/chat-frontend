import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { WebSocketService, ChatMessage } from './services/WebSocketService';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://172.20.10.3:8080/api' ;

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  
  const webSocketService = useRef<WebSocketService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to WebSocket when user logs in
  useEffect(() => {
    if (currentUser) {
      connectToWebSocket();
    }
    
    return () => {
      if (webSocketService.current) {
        webSocketService.current.disconnect();
      }
    };
  }, [currentUser]);

  const connectToWebSocket = async () => {
    try {
      setConnectionStatus('Connecting...');
      webSocketService.current = new WebSocketService();
      
      await webSocketService.current.connect(currentUser!, (message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
      });
      
      setConnectionStatus('Connected');
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const handleAuth = async () => {
    try {
      const endpoint = isRegistering ? '/register' : '/login';
      alert(API_BASE_URL);
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, {
        username,
        password
      });
      
      if (response.data.username || response.data.message.includes('registered')) {
        setCurrentUser(username);
        setUsername('');
        setPassword('');
        // Load recent messages from database
        await loadRecentMessages();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Authentication failed');
    }
  };

  const loadRecentMessages = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/messages`);
      const dbMessages: ChatMessage[] = response.data.map((msg: any) => ({
        content: msg.content,
        sender: msg.senderUsername,
        type: 'CHAT' as const,
        timestamp: msg.createdAt
      })).reverse();
      
      setMessages(dbMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !webSocketService.current?.isConnected()) return;

    webSocketService.current.sendMessage(newMessage, currentUser!);
    setNewMessage('');
  };

  const logout = () => {
    if (webSocketService.current) {
      webSocketService.current.disconnect();
    }
    setCurrentUser(null);
    setMessages([]);
    setConnectionStatus('Disconnected');
  };

  const getMessageStyle = (message: ChatMessage) => {
    switch (message.type) {
      case 'JOIN':
        return { backgroundColor: '#d4edda', color: '#155724' };
      case 'LEAVE':
        return { backgroundColor: '#f8d7da', color: '#721c24' };
      default:
        return {};
    }
  };

  if (!currentUser) {
    return (
      <div className="App">
        <div className="auth-container">
          <h1>Real-time Chat</h1>
          <div className="auth-form">
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
      <div className="chat-container">
        <div className="chat-header">
          <h1>Real-time Chat</h1>
          <div className="header-info">
            <span className={`status ${connectionStatus.toLowerCase().replace(' ', '-')}`}>
              {connectionStatus}
            </span>
            <span>Welcome, {currentUser}!</span>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
        
        <div className="messages-container">
          {messages.map((message, index) => (
            <div key={index} className="message" style={getMessageStyle(message)}>
              <strong>{message.sender}:</strong> {message.content}
              <span className="timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="input-container">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={connectionStatus !== 'Connected'}
          />
          <button 
            onClick={sendMessage}
            disabled={connectionStatus !== 'Connected'}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;