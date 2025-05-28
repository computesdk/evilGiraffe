const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

// Load state from file
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data) || { conversations: [] };
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return { conversations: [] };
}

// Save state to file
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Get a value by key
function get(key) {
  const state = loadState();
  return state[key];
}

// Set a value by key
function set(key, value) {
  const state = loadState();
  state[key] = value;
  saveState(state);
  return value;
}

// Update a value by key using a function
function update(key, updater) {
  const state = loadState();
  const newValue = updater(state[key]);
  state[key] = newValue;
  saveState(state);
  return newValue;
}

// Delete a key
function remove(key) {
  const state = loadState();
  if (key in state) {
    delete state[key];
    saveState(state);
    return true;
  }
  return false;
}

// Add a new chat to the conversations array
function addChat(chatData) {
  const state = loadState();
  const { title, model, messages, context } = chatData;
  
  const newChat = {
    id: Date.now().toString(),
    title: title || 'New Chat',
    model: model || 'default',
    messages: messages || [],
    context: context || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  if (!state.conversations) {
    state.conversations = [];
  }
  
  state.conversations.push(newChat);
  saveState(state);
  return newChat;
}

// Get all chats
function getAllChats() {
  const state = loadState();
  return state.conversations || [];
}

// Get a specific chat by ID
function getChatById(chatId) {
  const state = loadState();
  return (state.conversations || []).find(chat => chat.id === chatId);
}

// Update a chat
function updateChat(chatId, updates) {
  const state = loadState();
  const chatIndex = (state.conversations || []).findIndex(chat => chat.id === chatId);
  
  if (chatIndex === -1) return null;
  
  const { context: newContext, ...otherUpdates } = updates;
  const currentChat = state.conversations[chatIndex];
  
  const updatedChat = {
    ...currentChat,
    ...otherUpdates,
    context: {
      ...currentChat.context,
      ...(newContext || {})
    },
    updatedAt: new Date().toISOString()
  };
  
  state.conversations[chatIndex] = updatedChat;
  saveState(state);
  return updatedChat;
}

// Delete a chat
function deleteChat(chatId) {
  const state = loadState();
  const initialLength = state.conversations ? state.conversations.length : 0;
  
  if (state.conversations) {
    state.conversations = state.conversations.filter(chat => chat.id !== chatId);
  }
  
  saveState(state);
  return initialLength !== (state.conversations?.length || 0);
}

// Export the new functions
module.exports = {
  get,
  set,
  update,
  remove,
  addChat,
  getAllChats,
  getChatById,
  updateChat,
  deleteChat
};