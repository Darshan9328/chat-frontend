import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // Emoji picker state
  const [showEmoji, setShowEmoji] = useState(false);
  const emojis = ['😀','😂','😊','😍','😎','😢','😡','👍','🙏','🎉','🔥','❤️','😉','😭','🤔','🙌','✨','🥳','😴','🤖'];
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? newMessage.length;
    const end = el.selectionEnd ?? newMessage.length;
    const updated = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(updated);
    // restore caret position and trigger auto-resize
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

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
    setShowEmoji(false);
    
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
  const addMessage = useCallback((message: Message) => {
    console.log('[ChatArea] addMessage called:', message);
    setMessages(prev => [...prev, message]);
  }, []);

  // Mark all sent messages as READ in the current conversation
  const markAllSentAsRead = useCallback(() => {
    setMessages(prev => prev.map(m => (
      m.senderUsername === currentUser ? { ...m, status: 'READ' } : m
    )));
  }, [currentUser]);

  // Expose methods to parent component
  React.useImperativeHandle(ref, () => ({
    addMessage,
    markAllSentAsRead
  }), [addMessage, markAllSentAsRead]);

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
        <div className="chat-header-actions">
          <button
            className="icon-button"
            title="Search in conversation"
            aria-label="Search in conversation"
            onClick={() => inputRef.current?.focus()}
          >
            🔎
          </button>
          <button
            className="icon-button"
            title="Details"
            aria-label="Conversation details"
            onClick={() => alert(`Conversation with ${otherParticipant}`)}
          >
            ℹ️
          </button>
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
            {(() => {
              // Group messages by day and by consecutive sender to create clean clusters
              const groups: Array<{
                key: string;
                dateKey: string;
                messages: Message[];
              }> = [];

              const getDateKey = (ts: string) => {
                const d = new Date(ts);
                return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
              };

              let currentDateKey: string | null = null;
              let buffer: Message[] = [];

              const flush = (dateKey: string) => {
                if (buffer.length) {
                  groups.push({ key: `${dateKey}-${groups.length}`, dateKey, messages: buffer });
                  buffer = [];
                }
              };

              messages.forEach((m, idx) => {
                const dk = getDateKey(m.createdAt);
                if (currentDateKey === null) currentDateKey = dk;
                if (dk !== currentDateKey) {
                  flush(currentDateKey);
                  currentDateKey = dk;
                }
                buffer.push(m);
                if (idx === messages.length - 1) {
                  flush(currentDateKey!);
                }
              });

              // Render per-date groups with separators and sender clusters
              return groups.map((g, gi) => (
                <React.Fragment key={g.key}>
                  <div className="date-separator"><span>{new Date(g.messages[0].createdAt).toLocaleDateString()}</span></div>
                  {(() => {
                    const rows: React.ReactElement[] = [];
                    let cluster: Message[] = [];
                    const flushCluster = () => {
                      if (!cluster.length) return;
                      const isSent = cluster[0].senderUsername === currentUser;
                      rows.push(
                        <div className={`message-row ${isSent ? 'sent' : 'received'}`} key={`row-${gi}-${rows.length}`}>
                          {!isSent && (
                            <div className="message-avatar">{getInitials(cluster[0].senderUsername)}</div>
                          )}
                          <div className="message-group">
                            {cluster.map((cm, ci) => {
                              const first = ci === 0;
                              const last = ci === cluster.length - 1;
                              const cls = `message-bubble ${isSent ? 'sent' : 'received'} ${first ? 'first-in-group' : last ? 'last-in-group' : 'middle-in-group'}`;
                              return (
                                <div className={cls} key={`bubble-${gi}-${rows.length}-${ci}`}>
                                  <div className="message-content">{cm.content}</div>
                                  <div className="message-time">
                                    {formatMessageTime(cm.createdAt)}
                                    {isSent && (
                                      <span className="message-status">{cm.status === 'READ' ? '✓✓' : '✓'}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                      cluster = [];
                    };

                    for (let i = 0; i < g.messages.length; i++) {
                      const m = g.messages[i];
                      if (!cluster.length) {
                        cluster.push(m);
                      } else {
                        const sameSender = cluster[cluster.length - 1].senderUsername === m.senderUsername;
                        if (sameSender) cluster.push(m);
                        else { flushCluster(); cluster.push(m); }
                      }
                    }
                    flushCluster();

                    return rows;
                  })()}
                </React.Fragment>
              ));
            })()}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="message-input-container">
        {showEmoji && (
          <div className="emoji-panel">
            {emojis.map((e, i) => (
              <div key={i} className="emoji-item" onClick={() => insertEmoji(e)}>{e}</div>
            ))}
          </div>
        )}
        <div className="message-input-form">
          <div className="input-actions">
            <button
              className="emoji-toggle"
              title="Emoji"
              aria-label="Open emoji picker"
              onClick={() => setShowEmoji(v => !v)}
            >😊</button>
          </div>
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
