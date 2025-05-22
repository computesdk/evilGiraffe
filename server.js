const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const bodyParser = require('body-parser');
const { openDB, addUserMessage, addAIResponse, getContext } = require('./db');

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
    res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/model', (req, res) => {
  res.sendFile(path.join(__dirname, 'model.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
});

// Initialize database
openDB().then(() => {
    console.log('Database initialized successfully');
}).catch(error => {
    console.error('Failed to initialize IndexedDB:', error);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
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
        const { message, model } = req.body;
        console.log('New chat message received:', {
            model: model,
            message: message
        });
        
        // Get current context
        const context = await getContext();
        console.log('Retrieved context:', context);
        console.log('Sending message to Ollama with context...');

        try {
            // Initialize response variable
            let response;
            
            // Handle API call based on whether we have context
            let responseText = '';

            if (!context) {
                console.log('No context found, using /api/generate endpoint');
                console.log('Generate request:', {
                    model: model,
                    message: message
                });
                
                const response = await axios.post('http://localhost:11434/api/generate', {
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
                }
            } else {
                console.log('Context found, using chat endpoint');
                const formattedContext = `Previous conversation context:\n${context}`;
                console.log('Formatted context for API:', formattedContext);

                console.log('Chat request:', {
                    model: model,
                    context: formattedContext,
                    message: message
                });
                
                const response = await axios.post('http://localhost:11434/api/chat', {
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
                
                // Extract response text
                if (response.data?.response) {
                    responseText = response.data.response;
                    console.log('Got response text from chat endpoint:', responseText);
                } else {
                    console.warn('No response found in data from chat endpoint');
                    console.log('Full response:', response.data);
                }
            }

            // Store user message in database
            try {
                console.log('Storing message:', message);
                await addUserMessage(message);
                console.log('Message stored successfully');
            } catch (error) {
                console.error('Failed to store chat messages:', error);
                throw error;
            }

            // Send response to client
            res.json({
                response: responseText,
                message: responseText  // Also include message for compatibility
            });

            // Return the final response
            return response;

            res.json({ response: responseText });
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
});
