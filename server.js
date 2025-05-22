const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const bodyParser = require('body-parser');

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
        return [];
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

// Endpoint to handle chat messages
app.post('/api/chat', async (req, res) => {
    try {
        // Get message and model from request body
        const { message, model } = req.body;
        console.log('New chat message received:', {
            model: model,
            message: message
        });
        
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
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: model,
                prompt: message,
                stream: false,
                context: ""
            }, {
                responseType: 'json', // Try with regular JSON response first
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Handle the response
            let responseText = '';

            try {
                // The /api/generate endpoint returns the response directly in the response property
                if (response.data?.response) {
                    responseText = response.data.response;
                    console.log('Got response text:', responseText);
                } else {
                    console.warn('No response found in data');
                    console.log('Full response:', response.data);
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
});
