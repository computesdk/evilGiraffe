// server.js - Backend server to proxy requests to Ollama
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const helmet = require('helmet');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
const port = 3000;

// Security headers with CSP configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:11434"],
            fontSrc: ["'self'", "https:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:"],
            frameSrc: ["'self'"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// Body parser configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the Webpage directory
app.use(express.static(path.join(__dirname, 'Webpage')));

// Route for the root URL
app.get('/', (req, res) => {
  console.log('Received request to /');
  res.sendFile(path.join(__dirname, 'Webpage', 'home.html'));
});

// Main chat endpoint that handles all Ollama operations
app.post('/api/ollama', async (req, res) => {
    console.log('Received request to /api/ollama');
    try {
        const { action, model, message, messages } = req.body;
        console.log('Request body:', { action, model, message, messages });
        
        if (!action) {
            console.log('Error: Action is required');
            return res.status(400).json({ error: 'Action is required' });
        }

        console.log('Processing action:', action);

        switch(action) {
            case 'install':
                if (!model) {
                    console.log('Error: Model name is required');
                    return res.status(400).json({ error: 'Model name is required' });
                }
                // Check if model exists
                const tagsResponse = await axios.get('http://localhost:11434/api/tags', {
                    timeout: 5000
                });
                
                const existingTags = tagsResponse.data.tags.map(tag => tag.name);
                
                if (existingTags.includes(model)) {
                    return res.json({ success: true, message: 'Model already installed' });
                }

                // Install model
                const pullResponse = await axios.post('http://localhost:11434/api/pull', {
                    name: model
                }, {
                    timeout: 30000
                });

                return res.json({ success: true, message: 'Model installed successfully' });

            case 'chat':
                if (!model || (!message && !messages)) {
                    return res.status(400).json({ error: 'Model and message/messages are required' });
                }

                // Send request to Ollama
                const chatResponse = await axios.post('http://localhost:11434/api/generate', {
                    model: model,
                    prompt: message || messages[messages.length - 1].content,
                    stream: true
                }, {
                    timeout: 30000
                });

                // Stream the response back to the client
                chatResponse.data.pipe(res);
                break;

            case 'models':
                const modelsResponse = await axios.get('http://localhost:11434/api/tags', {
                    timeout: 5000
                });
                
                const models = modelsResponse.data.tags.map(tag => ({
                    name: tag.name,
                    display: tag.name
                }));

                res.json({ success: true, models });
                break;

            case 'remove':
                try {
                    const response = await axios.delete(`http://localhost:11434/api/tags/${model}`);
                    console.log('Model removal response:', response.data);
                    
                    res.json({ 
                        success: true, 
                        message: `Successfully removed model: ${model}`,
                        output: response.data.message || 'Model removed successfully'
                    });
                } catch (error) {
                    console.error('Error removing model:', error);
                    res.status(500).json({ 
                        success: false, 
                        error: 'Failed to remove model',
                        details: error.message
                    });
                }
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error in Ollama request:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process request',
            details: error.message
        });
    }
});

// Endpoint to get available models from Ollama
app.get('/api/models', async (req, res) => {
  try {
    console.log('Attempting to fetch models from Ollama...');
    
    // Make GET request to Ollama API to fetch installed models
    const response = await axios.get('http://localhost:11434/api/tags', {
      timeout: 5000, // 5 second timeout
      validateStatus: function (status) {
        return status < 500; // Resolve only if status code is less than 500
      }
    });
    
    console.log('Ollama API response:', JSON.stringify(response.data, null, 2));
    console.log('Ollama API response status:', response.status);
    
    if (response.status !== 200) {
      throw new Error(`Ollama API returned status ${response.status}: ${response.statusText}`);
    }
    
    if (!response.data || !Array.isArray(response.data.tags)) {
      console.error('Unexpected response format from Ollama:', response.data);
      throw new Error('Unexpected response format from Ollama API');
    }
    
    // Process the response to get installed models
    const installedModels = response.data.tags || [];
    console.log('Raw models data:', JSON.stringify(installedModels, null, 2));
    console.log(`Found ${installedModels.length} models`);
    
    // Format models for dropdown
    const dropdownModels = installedModels.map(model => ({
      name: model.name || 'Unknown',
      size: model.details?.size || 'Unknown',
      display: `${model.name || 'Unknown'} (${model.details?.size || 'Unknown'})`
    }));
    
    // Calculate total size
    const totalSize = installedModels.reduce((sum, model) => sum + (model.details?.size || 0), 0);
    const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
    
    // Prepare response
    const result = {
      dropdown: dropdownModels,
      stats: {
        total: installedModels.length,
        active: installedModels.filter(m => m.details?.size).length,
        totalSizeGB: totalSizeGB
      }
    };
    
    console.log('Sending response:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error('Error fetching installed models:', error.message);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response',
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      },
      message: error.message
    });
    
    res.status(500).json({
      error: 'Failed to fetch installed models',
      details: error.message
    });
  }
});

// Endpoint to update the model configuration
// This endpoint allows updating the model configuration file
// Used when switching between different AI models
app.post('/api/update-modelfile', async (req, res) => {
  try {
    // Get the model configuration content from request
    const content = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content is required' 
      });
    }

    // Validate content type and length
    if (typeof content !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Content must be a string' 
      });
    }

    if (content.length > 100000) { // Limit to 100KB
      return res.status(400).json({ 
        success: false, 
        error: 'Content too large (max 100KB)' 
      });
    }

    // Validate that content looks like JSON
    try {
      const parsed = JSON.parse(content);
      if (!parsed.model || !parsed.system) {
        throw new Error('Invalid model configuration format');
      }
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON format' 
      });
    }

    // Use fs.promises for better error handling
    const fs = require('fs').promises;
    await fs.writeFile('Modelfile', content, 'utf8');
    
    res.json({ 
      success: true, 
      message: 'Modelfile updated successfully'
    });
  } catch (error) {
    console.error('Error updating Modelfile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update Modelfile',
      details: error.message
    });
  }
});

// Main chat endpoint that handles user messages
app.post('/api/chat', async (req, res) => {
  try {
    // Extract parameters from request body
    const { model, messages } = req.body;
    
    // Validate required parameters
    if (!model || !messages) {
      return res.status(400).json({ error: 'Model and messages are required' });
    }

    // Format messages for Ollama
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Log the request parameters for debugging
    console.log('Chat request:', { model, messages: formattedMessages });

    // Make request to Ollama API
    const ollamaResponse = await axios.post('http://localhost:11434/api/chat', {
      model: model,
      messages: formattedMessages,
      options: {
        temperature: 0.7  // Default temperature value
      },
      stream: false
    });

    // Format and return response to frontend
    res.json({
      model: model,
      message: {
        role: 'assistant',
        content: ollamaResponse.data.message?.content || 'No response from model'
      }
    });
  } catch (error) {
    // Log error and return error response
    console.error('Error getting completion:', error.message);
    res.status(500).json({ error: 'Failed to get completion from Ollama' });
  }
});

const { spawn } = require('child_process');

// Start Ollama service
async function startOllama() {
  try {
    // Check if Ollama is already running
    try {
      const response = await axios.get('http://localhost:11434/api/tags', {
        timeout: 1000
      });
      if (response.status === 200) {
        console.log('Ollama is already running');
        return null; // No need to start a new process
      }
    } catch (error) {
      // If we can't connect, it means Ollama isn't running
      console.log('Ollama is not running, starting it now...');
    }

    const { stdout } = await execAsync('ollama --version');
    console.log('Ollama version:', stdout.trim());
    return exec('ollama serve', { detached: true });
  } catch (error) {
    console.error('Error starting Ollama:', error);
    throw error;
  }
}

// Start Ollama service
let ollamaProcess = null;
startOllama().then(process => {
  if (process) {
    ollamaProcess = process;
  }
  console.log('Server ready');
});

// Handle process termination
process.on('SIGTERM', () => {
  if (ollamaProcess) {
    ollamaProcess.kill('SIGTERM');
  }
  process.exit(0);
});
