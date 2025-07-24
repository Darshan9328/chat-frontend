import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import apiClient from '../services/apiService';
import './App.css';

interface Message {
  id: number;
  content: string;
  senderUsername: string;
  createdAt: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    if (authService.isAuthenticated()) {
      setCurrentUser(authService.getUsername());
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchMessages = async () => {
    try {
      const response = await apiClient.get('/messages');
      setMessages(response.data.reverse());
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        await authService.register(username, password);
        setError(null);
        alert('Registration successful! Please login.');
        setIsRegistering(false);
      } else {
        await authService.login(username, password);
        setCurrentUser(username);
      }
      
      setUsername('');
      setPassword('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await apiClient.post('/messages', {
        content: newMessage
      });
      
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const logout = () => {
    authService.logout();
    setCurrentUser(null);
    setMessages([]);
  };

  if (!currentUser) {
    return (
      <div className="App">
        <div className="auth-container">
          <h1>Simple Chat</h1>
          <div className="auth-form">
            {error && <div className="error-message">{error}</div>}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleAuth()}
              disabled={loading}
            />
            <button onClick={handleAuth} disabled={loading}>
              {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
            </button>
            <button onClick={() => setIsRegistering(!isRegistering)} disabled={loading}>
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
          <h1>Simple Chat</h1>
          <div>
            <span>Welcome, {currentUser}!</span>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
        
        <div className="messages-container">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.senderUsername === currentUser ? 'own-message' : ''}`}>
              <strong>{message.senderUsername}:</strong> {message.content}
              <span className="timestamp">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
        
        <div className="input-container">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;