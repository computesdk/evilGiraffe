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
        const chat = chatId ? (stateManager.getChatById(chatId) || { context: {} }) : { context: {} };
        const context = chat.context || {};
        
        console.log('Using chat context:', context);

        try {
            let response;
            let responseText = '';
            
            if (Object.keys(context).length === 0) {
                console.log('No context found, using generate endpoint with model:', model);
                
                response = await axios.post('http://localhost:11434/api/generate', {
                    model: model,
                    stream: false,
                    prompt: message
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
            } else {
                console.log('Context found, using chat endpoint with model:', model);
                const formattedContext = typeof context === 'string' ? context : 
                    (context.systemPrompt || 'You are a helpful assistant');
                    
                console.log('Using context:', formattedContext);

                response = await axios.post('http://localhost:11434/api/chat', {
                    model: model,
                    stream: false,
                    messages: [
                        {
                            role: "system",
                            content: formattedContext
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ]
                }, {
                    responseType: 'json',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                console.log('Chat response:', response.data);
                
                // Extract response text from chat endpoint
                if (response.data?.message?.content) {
                    responseText = response.data.message.content;
                    console.log('Got response text from chat endpoint:', responseText);
                } else if (response.data?.response) {
                    responseText = response.data.response;
                    console.log('Got response text from chat endpoint (legacy format):', responseText);
                } else {
                    console.warn('No response found in data from chat endpoint');
                    console.log('Full response:', response.data);
                    throw new Error('No valid response from the model');
                }
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

// Endpoint to handle chat messages
app.post('/api/chat', async (req, res) => {
    try {
        // Get message and model from request body
        const { message, model } = req.body;
        console.log('New chat message received:', {
            model: model,
            message: message
        });
        
        // Initialize messageContext as an empty array to hold Ollama's context
        let messageContext = [];
        let responseText = '';
        
        // Send message to Ollama using chat API
        console.log('Sending message to Ollama...');
        console.log('Request body:', {
            model: model,
            messages: [{
                role: "user",
                content: message
            }]
        });

        try {
            // Log the context being sent to Ollama
            console.log('Sending context to Ollama:', messageContext.length > 0 ? messageContext : 'No context');
            
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: model,
                prompt: message,
                stream: false,
                context: messageContext.length > 0 ? messageContext : undefined
            }, {
                responseType: 'json', // Try with regular JSON response first
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Handle the response
            try {
                // The /api/generate endpoint returns the response directly in the response property
                if (response.data?.response) {
                    responseText = response.data.response;
                    console.log('Got response text:', responseText);
                } else {
                    console.warn('No response found in data');
                    console.log('Full response:', response.data);
                }

                // Get and store context if available
                if (response.data?.context) {
                    messageContext = response.data.context;
                    console.log('Got context from Ollama:', messageContext);
                } else {
                    console.log('No context received from Ollama');
                }
            } catch (error) {
                console.error('Failed to parse Ollama response:', error);
                console.log('Raw response:', response.data);
            }

            console.log('Final response text:', responseText);
            res.json({ response: responseText });

        } catch (error) {
            console.error('Error making request to Ollama:', error);
            console.error('Error details:', error.response?.data || error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
                console.error('Response data:', error.response.data);
            }
            res.status(500).json({ 
                error: 'Failed to process chat message',
                details: error.response?.data || error.message 
            });
        }
    } catch (error) {
        console.error('Error processing chat:', error);
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to process chat message',
            details: error.response?.data || error.message 
        });
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
