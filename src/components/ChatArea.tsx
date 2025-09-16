import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';
import { WebSocketService } from '../services/WebSocketService';

interface Message {
  id?: number;
  content: string;
  senderUsername: string;
  recipientUsername: string;
  createdAt: string;
  status?: string;
}

interface ChatAreaProps {
  conversationId: string | null;
  otherParticipant: string | null;
  currentUser: string;
  onSendMessage: (message: string, recipient: string, conversationId: string) => void;
  typingUsers: string[];
  webSocketService?: WebSocketService | null;
}

export const ChatArea = React.forwardRef<any, ChatAreaProps>((
  {
    conversationId,
    otherParticipant,
    currentUser,
    onSendMessage,
    typingUsers,
    webSocketService
  },
  ref
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      setLoading(true);
      const response = await apiService.getConversationMessages(conversationId);
      setMessages(response);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !otherParticipant || !conversationId) return;

    onSendMessage(newMessage, otherParticipant, conversationId);
    setNewMessage('');
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator with debouncing
    if (otherParticipant && webSocketService?.isConnected() && e.target.value.length > 0) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Send typing indicator
      webSocketService.sendTypingIndicator(currentUser, otherParticipant);
      
      // Set timeout to stop sending typing indicators
      typingTimeoutRef.current = setTimeout(() => {
        // Could send "stopped typing" indicator here if needed
      }, 1000);
    }
  };

  // Add new message to the list (called from parent when receiving real-time messages)
  const addMessage = (message: Message) => {
  console.log('[ChatArea] addMessage called:', message);
  setMessages(prev => [...prev, message]);
  };

  // Expose addMessage method to parent component
  React.useImperativeHandle(ref, () => ({
    addMessage
  }), []);

  if (!conversationId || !otherParticipant) {
    return (
      <div className="chat-main">
        <div className="empty-chat">
          <div className="empty-chat-icon">💬</div>
          <h3>Welcome to Private Chat!</h3>
          <p>Select a conversation from the sidebar to start messaging, or search for users to begin a new chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-main">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-avatar">
            {getInitials(otherParticipant)}
          </div>
          <div className="chat-header-details">
            <h3>{otherParticipant}</h3>
            {typingUsers.includes(otherParticipant) ? (
              <div className="typing-indicator">typing...</div>
            ) : (
              <div className="chat-header-status">Online</div>
            )}
          </div>
        </div>
      </div>

      <div className="messages-container">
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: 'var(--gray-600)'
          }}>
            Loading messages...
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => {
              const isSent = message.senderUsername === currentUser;
              return (
                <div
                  key={message.id || index}
                  className={`message-bubble ${isSent ? 'sent' : 'received'}`}
                >
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-time">
                    {formatMessageTime(message.createdAt)}
                    {isSent && (
                      <span className="message-status">
                        {message.status === 'READ' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="message-input-container">
        <div className="message-input-form">
          <textarea
            ref={inputRef}
            className="message-input"
            placeholder={`Message ${otherParticipant}...`}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            rows={1}
            style={{
              resize: 'none',
              overflow: 'hidden',
              minHeight: '44px',
              maxHeight: '120px'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <span style={{ fontSize: '18px' }}>➤</span>
          </button>
        </div>
      </div>
    </div>
  );
});
