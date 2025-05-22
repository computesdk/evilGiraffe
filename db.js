// In-memory database store
let store = {
    messages: [],
    context: ''
};

// Initialize database
async function openDB() {
    // Reset store
    store = {
        records: [],
        nextId: 1
    };
    return Promise.resolve();
}

// Add a user message to the list
async function addUserMessage(message) {
    try {
        store.messages.push(message);
        // Keep only the last 10 messages
        if (store.messages.length > 10) {
            store.messages.shift();
        }
        console.log('Added message:', message);
        console.log('Current messages:', store.messages);
        return Promise.resolve(true);
    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
}

// Add a user message to context
async function addUserMessage(message, model) {
    try {
        console.log('Adding user message to context:', message);
        return await updateContext(message, model);
    } catch (error) {
        console.error('Error adding user message to context:', error);
        throw error;
    }
}



// Get current context
async function getContext() {
    try {
        console.log('Retrieving current context:', store.context);
        return Promise.resolve(store.context);
    } catch (error) {
        console.error('Error retrieving context:', error);
        throw error;
    }
}

// Get conversation history for a specific model
async function getConversationHistory(model) {
    try {
        const records = await getAllRecords();
        return records.filter(record => record.model === model);
    } catch (error) {
        throw error;
    }
}

// Delete a record by id
async function deleteRecord(id) {
    try {
        const originalLength = store.records.length;
        store.records = store.records.filter(record => record.id !== id);
        const deleted = originalLength !== store.records.length;
        console.log(`Delete record ${id}: ${deleted ? 'success' : 'not found'}`);
        console.log('Database state after deletion:', store.records);
        return Promise.resolve(true);
    } catch (error) {
        console.error('Error deleting record:', error);
        throw error;
    }
}

// Clear context
async function clearContext() {
    try {
        console.log('Clearing context...');
        store.context = '';
        console.log('Context cleared successfully');
        return Promise.resolve(true);
    } catch (error) {
        console.error('Error clearing context:', error);
        throw error;
    }
}

module.exports = {
    openDB: async function() {
        // Reset store
        store = {
            messages: [],
            context: ''
        };
        console.log('Database initialized');
        return Promise.resolve();
    },
    
    addUserMessage: async function(message) {
        try {
            store.messages.push(message);
            // Keep only the last 10 messages
            if (store.messages.length > 10) {
                store.messages.shift();
            }
            console.log('Added message:', message);
            console.log('Current messages:', store.messages);
            return Promise.resolve(true);
        } catch (error) {
            console.error('Error adding message:', error);
            throw error;
        }
    },
    
    getContext: async function() {
        try {
            console.log('Retrieving current context:', store.context);
            return Promise.resolve(store.context);
        } catch (error) {
            console.error('Error retrieving context:', error);
            throw error;
        }
    },
    
    updateContext: async function(newContext) {
        try {
            store.context = newContext;
            console.log('Updated context:', store.context);
            return Promise.resolve(true);
        } catch (error) {
            console.error('Error updating context:', error);
            throw error;
        }
    },
    
    clearContext: async function() {
        try {
            console.log('Clearing context...');
            store.messages = [];
            store.context = '';
            console.log('Context cleared successfully');
            return Promise.resolve(true);
        } catch (error) {
            console.error('Error clearing context:', error);
            throw error;
        }
    }
};