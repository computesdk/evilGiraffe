const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const bodyParser = require('body-parser');
const stateManager = require('./stateManager');

// Initialize Express app
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Ollama API configuration
const OLLAMA_API = 'http://localhost:11434/api/tags';

// Get installed models from Ollama
async function getInstalledModels() {
    try {
        const response = await axios.get(OLLAMA_API);
        return response.data.models;
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error; // Let the endpoint handle the error
    }
}

// Serve static files from both directories
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Serve Images directory
app.use('/Images', express.static(path.join(__dirname, 'Images')));

// Serve CSS file directly
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/model', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'model.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// Endpoint to get installed models
app.get('/api/models', async (req, res) => {
    console.log('Request received for /api/models');
    try {
        const models = await getInstalledModels();
        console.log('Successfully fetched models:', models);
        res.json(models);
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ 
            error: 'Failed to fetch models',
            details: error.message 
        });
    }
});

// Endpoint to handle chat messages
app.post('/api/chat', async (req, res) => {
    try {
        // Get message and model from request body
        const { message, model, chatId } = req.body;
        console.log('New chat message received:', {
            model: model,
            message: message,
            chatId: chatId
        });
        
        // Get the current chat to get its context
        const chat = chatId ? (stateManager.getChatById(chatId) || { context: [] }) : { context: [] };
        const context = Array.isArray(chat.context) ? chat.context : [];
        
        console.log('=== CONTEXT USED FOR MESSAGE GENERATION ===');
        console.log('Context type:', Array.isArray(context) ? 'Array' : typeof context);
        console.log('Context content:', JSON.stringify(context, null, 2));
        console.log('=========================================');

        try {
            let response;
            let responseText = '';
            
            console.log('Using generate endpoint with model:', model);
            
            console.log('Sending to generate endpoint with context:', Array.isArray(context) ? context : 'No valid context');
            
            response = await axios.post('http://localhost:11434/api/generate', {
                model: model,
                stream: false,
                prompt: message,
                context: context.length > 0 ? context : undefined
            }, {
                responseType: 'json',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('Generate response:', response.data);
            
            // Extract response text
            if (response.data?.response) {
                responseText = response.data.response;
                console.log('Got response text from generate endpoint:', responseText);
            } else {
                console.warn('No response found in data from generate endpoint');
                console.log('Full response:', response.data);
                throw new Error('No response from the model');
            }

            // Store user message in database
            try {
                console.log('Storing message in chat:', chatId);
                if (chatId && chatId !== 'default') {
                    const chat = stateManager.getChatById(chatId);
                    if (chat) {
                        // Update model if it's 'no_model'
                        const updates = {};
                        if (chat.model === 'no_model' || !chat.model) {
                            updates.model = model;
                            console.log(`Updating chat model from '${chat.model}' to '${model}'`);
                        }
                        
                        // Add messages
                        const messages = [...(chat.messages || [])];
                        messages.push({
                            role: 'user',
                            content: message,
                            timestamp: new Date().toISOString()
                        });
                        messages.push({
                            role: 'assistant',
                            content: responseText,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Update context if provided in the response
                        const context = response.data?.context;
                        if (Array.isArray(context)) {
                            console.log('Storing context array in chat:', context);
                            updates.context = context;
                        }
                        
                        // Update chat with new messages, context, and model (if changed)
                        stateManager.updateChat(chatId, {
                            ...updates,
                            messages: messages,
                            updatedAt: new Date().toISOString()
                        });
                        console.log('Message and context stored successfully in chat:', chatId);
                    }
                }
            } catch (error) {
                console.error('Failed to store chat messages:', error);
                // Don't fail the request if message storage fails
            }

            // Send response to client
            res.json({
                response: responseText,
                message: responseText  // Also include message for compatibility
            });
            
            return; // End the request handling
        } catch (error) {
            console.error('Failed to communicate with Ollama:', error);
            res.status(500).json({ 
                error: 'Failed to get response from Ollama',
                details: error.message 
            });
            return; // Prevent further execution
        }
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
        return; // Prevent further execution
    }
});

// Endpoint to update a chat's model
app.patch('/api/chats/:chatId', (req, res) => {
    try {
        const { chatId } = req.params;
        const { model } = req.body;
        
        if (!model) {
            return res.status(400).json({ error: 'Model is required' });
        }
        
        const chat = stateManager.getChatById(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        // Update the chat's model
        const updatedChat = stateManager.updateChat(chatId, { model });
        
        res.json(updatedChat);
    } catch (error) {
        console.error('Error updating chat model:', error);
        res.status(500).json({ 
            error: 'Failed to update chat model',
            details: error.message 
        });
    }
});

// Endpoint to install a model
app.post('/api/install/:model', async (req, res) => {
    const modelName = req.params.model;
    console.log(`Attempting to install model: ${modelName}`);

    try {
        // Use Ollama API to install the model
        await axios.post('http://localhost:11434/api/pull', {
            name: modelName
        });

        console.log(`Successfully installed model: ${modelName}`);
        res.json({ success: true, message: 'Model installed successfully' });
    } catch (error) {
        console.error(`Error installing model ${modelName}:`, error);
        res.status(500).json({ 
            error: 'Failed to install model',
            details: error.message 
        });
    }
});

// Endpoint to delete a model
app.delete('/api/delete/:model', async (req, res) => {
    const modelName = req.params.model;
    console.log(`Attempting to delete model: ${modelName}`);

    try {
        // Use Ollama API to delete the model
        const response = await axios.delete('http://localhost:11434/api/delete', {
            data: { name: modelName },
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to delete model');
        }

        console.log(`Successfully deleted model: ${modelName}`);
        res.json({ success: true, message: 'Model deleted successfully' });
    } catch (error) {
        console.error(`Error deleting model ${modelName}:`, error);
        res.status(500).json({ 
            error: 'Failed to delete model',
            details: error.message 
        });
    }
});

// Chat Management Endpoints

// Create a new chat
app.post('/api/chats', (req, res) => {
    try {
        console.log('Creating new chat with data:', req.body);
        const newChat = stateManager.addChat(req.body);
        console.log('Successfully created chat:', newChat);
        res.status(201).json(newChat);
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({ 
            error: 'Failed to create chat', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get all chats
app.get('/api/chats', (req, res) => {
    try {
        const chats = stateManager.getAllChats();
        res.json(chats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ error: 'Failed to fetch chats', details: error.message });
    }
});

// Get a specific chat
app.get('/api/chats/:id', (req, res) => {
    try {
        const chat = stateManager.getChatById(req.params.id);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.json(chat);
    } catch (error) {
        console.error(`Error fetching chat ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch chat', details: error.message });
    }
});

// Update a chat
app.put('/api/chats/:id', (req, res) => {
    try {
        const updatedChat = stateManager.updateChat(req.params.id, req.body);
        if (!updatedChat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.json(updatedChat);
    } catch (error) {
        console.error(`Error updating chat ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to update chat', details: error.message });
    }
});

// Delete a chat
app.delete('/api/chats/:id', (req, res) => {
    try {
        const deleted = stateManager.deleteChat(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting chat ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to delete chat', details: error.message });
    }
});



// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`  POST   /api/chats - Create a new chat`);
    console.log(`  GET    /api/chats - Get all chats`);
    console.log(`  GET    /api/chats/:id - Get a specific chat`);
    console.log(`  PUT    /api/chats/:id - Update a chat`);
    console.log(`  DELETE /api/chats/:id - Delete a chat`);
    console.log(`  POST   /api/chat - Send a chat message`);
    console.log('\nMake sure the state.json file is writable by the server.');
    
    // Open browser after server starts
    exec(`start http://localhost:${PORT}`);
});