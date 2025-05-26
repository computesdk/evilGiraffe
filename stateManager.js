const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

// Load state from file
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data) || {};
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return {};
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

module.exports = {
  get,
  set,
  update,
  remove,
  loadState,
  saveState
};