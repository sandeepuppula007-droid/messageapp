import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  List, 
  ListItem, 
  ListItemText,
  IconButton,
  Input
} from '@mui/material';
import { Send, AttachFile } from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../services/api';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import './Chat.css';

const Chat = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState({ type: 'general', name: 'General', id: 'general' });
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [directMessageUsers, setDirectMessageUsers] = useState(() => {
    const saved = localStorage.getItem(`directMessages_${user.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const typingTimeoutRef = useRef(null);

  const onMessageReceived = (message) => {
    const currentUserId = user.userId || user.id;
    const selectedUserId = selectedChat.userId || selectedChat.id;
    
    // For general chat, show messages without recipientId
    if (selectedChat.type === 'general' && !message.recipientId) {
      setMessages(prev => [...prev, message]);
    }
    // For direct messages, show messages between current user and selected user
    else if (selectedChat.type === 'direct' && message.recipientId && 
             ((message.senderId === selectedUserId && message.recipientId === currentUserId) ||
              (message.senderId === currentUserId && message.recipientId === selectedUserId))) {
      setMessages(prev => [...prev, message]);
    }
    // Handle notifications for direct messages
    else if (message.recipientId === currentUserId && message.senderId !== currentUserId) {
      // Auto-add sender to direct messages if not already there
      const senderUser = allUsers.find(u => (u.userId || u.id) === message.senderId);
      
      if (senderUser) {
        setDirectMessageUsers(prev => {
          if (!prev.find(u => u.id === message.senderId)) {
            const newUser = {
              id: senderUser.userId || senderUser.id,
              name: senderUser.userName || senderUser.name
            };
            const newDirectMessages = [...prev, newUser];
            localStorage.setItem(`directMessages_${currentUserId}`, JSON.stringify(newDirectMessages));
            return newDirectMessages;
          }
          return prev;
        });
      }
      
      // Update unread count if not currently viewing this chat
      if (selectedChat.type !== 'direct' || selectedUserId !== message.senderId) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.senderId]: (prev[message.senderId] || 0) + 1
        }));
      }
    }
  };

  const onTypingReceived = (typingData) => {
    try {
      const data = JSON.parse(typingData);
      const currentUserId = user.userId || user.id;
      const selectedUserId = selectedChat.userId || selectedChat.id;
      
      // Don't show typing indicator for current user
      if (data.userId === currentUserId) return;
      
      // For direct messages, only show typing if it's from the selected user
      if (selectedChat.type === 'direct' && data.userId !== selectedUserId) return;
      
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        if (data.isTyping) {
          newMap.set(data.userId, data.userName);
        } else {
          newMap.delete(data.userId);
        }
        return newMap;
      });
    } catch (error) {
      // Handle old format for backward compatibility
      if (typeof typingData === 'string' && typingData.includes('is typing')) {
        const userName = typingData.replace(' is typing...', '');
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set('unknown', userName);
          return newMap;
        });
        setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete('unknown');
            return newMap;
          });
        }, 3000);
      }
    }
  };

  const onStatusReceived = (status) => {
    setOnlineUsers(prev => {
      if (status.online) {
        return [...prev.filter(id => id !== status.userId), status.userId];
      } else {
        return prev.filter(id => id !== status.userId);
      }
    });
  };

  const { sendMessage, sendTyping, sendStopTyping } = useWebSocket(onMessageReceived, onTypingReceived, onStatusReceived, user.id);

  useEffect(() => {
    loadMessages();
  }, [selectedChat]);

  useEffect(() => {
    // Load all users for notification system
    api.getAllUsers().then(setAllUsers).catch(console.error);
  }, []);

  useEffect(() => {
    // Load online users periodically
    const loadOnlineUsers = () => {
      api.getOnlineUsers().then(setOnlineUsers).catch(() => {});
    };
    
    loadOnlineUsers();
    const interval = setInterval(loadOnlineUsers, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadMessages = () => {
    const currentUserId = user.userId || user.id;
    const selectedUserId = selectedChat.userId || selectedChat.id;
    
    if (selectedChat.type === 'general') {
      api.getMessages(50).then(data => {
        setMessages(data.reverse());
      }).catch(console.error);
    } else if (selectedChat.type === 'direct') {
      api.getDirectMessages(currentUserId, selectedUserId, 50).then(data => {
        setMessages(data.reverse());
      }).catch(console.error);
    }
  };



  const handleSendMessage = (content) => {
    const currentUserId = user.userId || user.id;
    const selectedUserId = selectedChat.userId || selectedChat.id;
    
    // Stop typing indicator immediately
    handleStopTyping();
    
    const messageData = {
      senderId: currentUserId,
      content,
      messageType: 'TEXT',
      sentAt: new Date().toISOString()
    };

    if (selectedChat.type === 'direct') {
      messageData.recipientId = selectedUserId;
    }

    sendMessage(messageData);
  };

  const handleTyping = () => {
    const currentUserId = user.userId || user.id;
    const recipientId = selectedChat.type === 'direct' ? (selectedChat.userId || selectedChat.id) : null;
    
    sendTyping(currentUserId, recipientId);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping(currentUserId, recipientId);
    }, 2000);
  };
  
  const handleStopTyping = () => {
    const currentUserId = user.userId || user.id;
    const recipientId = selectedChat.type === 'direct' ? (selectedChat.userId || selectedChat.id) : null;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendStopTyping(currentUserId, recipientId);
  };

  const handleFileUpload = async (file) => {
    if (file && file.size <= 10 * 1024 * 1024) {
      try {
        const currentUserId = user.userId || user.id;
        const selectedUserId = selectedChat.userId || selectedChat.id;
        
        // Upload file with recipient info
        const response = await api.uploadFile(file, currentUserId, selectedChat.type === 'direct' ? selectedUserId : null);
        const fileId = response;
        
        // Send file message via WebSocket with the uploaded file info
        const fileMessage = {
          senderId: currentUserId,
          content: `📎 ${file.name}`,
          messageType: 'FILE',
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          sentAt: new Date().toISOString()
        };

        if (selectedChat.type === 'direct') {
          fileMessage.recipientId = selectedUserId;
        }

        sendMessage(fileMessage);
        
        // Reload messages to get the updated file message with correct ID
        setTimeout(() => loadMessages(), 500);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  };

  const handleChatSelect = (chat, addToDirectMessages = false) => {
    if (addToDirectMessages && !directMessageUsers.find(u => u.id === chat.id)) {
      const newDirectMessages = [...directMessageUsers, chat];
      setDirectMessageUsers(newDirectMessages);
      localStorage.setItem(`directMessages_${user.id}`, JSON.stringify(newDirectMessages));
    }
    setSelectedChat(chat);
    setMessages([]); // Clear messages when switching chats
    setTypingUsers(new Map()); // Clear typing indicators when switching chats
  };

  const handleClearUnread = (userId) => {
    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#ffffff' }}>
      <Sidebar 
        currentUser={user}
        selectedChat={selectedChat}
        onChatSelect={handleChatSelect}
        onlineUsers={onlineUsers}
        unreadCounts={unreadCounts}
        onClearUnread={handleClearUnread}
        directMessageUsers={directMessageUsers}
      />
      <ChatArea 
        selectedChat={selectedChat}
        currentUser={user}
        messages={messages}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
        onFileUpload={handleFileUpload}
        typingUsers={typingUsers}
        onlineUsers={onlineUsers}
      />
    </Box>
  );
};

export default Chat;