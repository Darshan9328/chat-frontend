import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface Conversation {
  id: string;
  otherParticipant: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageSender: string;
  unreadCount: number;
}

interface User {
  username: string;
  id: number;
}

interface ChatSidebarProps {
  currentUser: string;
  selectedConversation: string | null;
  onConversationSelect: (conversationId: string, otherParticipant: string) => void;
  onLogout: () => void;
  refreshTrigger?: number;
}

export const ChatSidebar = React.forwardRef<any, ChatSidebarProps>((
  {
    currentUser,
    selectedConversation,
    onConversationSelect,
    onLogout,
    refreshTrigger
  },
  ref
) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  // Refresh conversations when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadConversations();
    }
  }, [refreshTrigger]);

  // Expose refresh method to parent component
  React.useImperativeHandle(ref, () => ({
    refreshConversations: loadConversations
  }), []);

  const loadConversations = async () => {
    try {
      const response = await apiService.getUserConversations(currentUser);
      setConversations(response);
      // Show notification in console and optionally UI
      console.log('[ChatSidebar] Conversations refreshed:', response);
      // Optionally, show a toast or UI message here
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleSearch = async (query: string) => {
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const results = await apiService.searchUsers(currentUser, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async (otherUser: string) => {
    try {
      const response = await apiService.startConversation(currentUser, otherUser);
      setShowUserSearch(false);
      setSearchQuery('');
      onConversationSelect(response.conversationId, otherUser);
      await loadConversations(); // Refresh conversations list
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateMessage = (message: string, maxLength: number = 30) => {
    if (!message) return '';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <div className="user-info">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="user-avatar">
              {getInitials(currentUser)}
            </div>
            <div className="user-details" style={{ marginLeft: '12px' }}>
              <h3>{currentUser}</h3>
              <div className="user-status">Online</div>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="search-bar">
          <div style={{ position: 'relative' }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search conversations or start new chat..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              onFocus={() => setShowUserSearch(true)}
            />
          </div>
        </div>
      </div>

      {showUserSearch && (searchQuery || searchResults.length > 0) ? (
        <div className="conversations-list">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--gray-700)' }}>
              {searchQuery ? 'Search Results' : 'All Users'}
            </h4>
          </div>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-600)' }}>
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((user) => (
              <div
                key={user.id}
                className="user-result-item"
                onClick={() => startConversation(user.username)}
              >
                <div className="user-result-avatar">
                  {getInitials(user.username)}
                </div>
                <div className="user-result-name">
                  {user.username}
                </div>
              </div>
            ))
          ) : searchQuery ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-600)' }}>
              No users found
            </div>
          ) : null}
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${selectedConversation === conversation.id ? 'active' : ''}`}
                onClick={() => onConversationSelect(conversation.id, conversation.otherParticipant)}
              >
                <div className="conversation-avatar">
                  {getInitials(conversation.otherParticipant)}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">
                    {conversation.otherParticipant}
                  </div>
                  <div className="conversation-preview">
                    {conversation.lastMessageSender === currentUser ? 'You: ' : ''}
                    {truncateMessage(conversation.lastMessage)}
                  </div>
                </div>
                <div className="conversation-meta">
                  <div className="conversation-time">
                    {formatTime(conversation.lastMessageTime)}
                  </div>
                  {conversation.unreadCount > 0 && (
                    <div className="unread-badge">
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ 
              padding: '40px 20px', 
              textAlign: 'center', 
              color: 'var(--gray-600)',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>💬</div>
              <p>No conversations yet</p>
              <p>Search for users to start chatting!</p>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close search */}
      {showUserSearch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1
          }}
          onClick={() => {
            setShowUserSearch(false);
            setSearchQuery('');
          }}
        />
      )}
    </div>
  );
});
