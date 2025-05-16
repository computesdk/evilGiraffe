// Chat page JavaScript
console.log('Chat script loaded');

// Load models when the page loads

// Load models when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Show loading state
        const dropdown = document.getElementById('versionDropdown');
        const loadingMessage = dropdown.querySelector('.loading-message');
        
        // Fetch models from the server
        const response = await fetch('http://localhost:3000/api/ollama', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'models' })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }
        
        const data = await response.json();
        
        // Remove loading message
        loadingMessage.remove();
        
        // Add models to dropdown
        if (data.success && Array.isArray(data.models)) {
            data.models.forEach(model => {
                const item = document.createElement('div');
                item.className = 'version-item';
                item.dataset.version = model.name;
                item.textContent = model.display;
                if (model.name === 'llama2') {
                    item.classList.add('active');
                }
                dropdown.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Error loading models:', error);
        const dropdown = document.getElementById('versionDropdown');
        const loadingMessage = dropdown.querySelector('.loading-message');
        loadingMessage.textContent = 'Error loading models: ' + error.message;
    }
});

// Initialize DOM elements
const chatMessages = document.querySelector(".chat-messages");
const userInput = document.querySelector(".input-field");
const sendButton = document.querySelector(".send-button");
const loadingMessage = document.createElement("div");
loadingMessage.className = "loading-message";
loadingMessage.style.display = "none";
loadingMessage.innerHTML =
    '<div class="spinner"></div><span>Evil Giraffe is thinking...</span>';
document.querySelector(".chat-messages").appendChild(loadingMessage);

const versionHeader = document.getElementById("versionHeader");
const versionButton = document.querySelector(".version-button");
const versionDropdown = document.getElementById("versionDropdown");
const versionItems = document.querySelectorAll(".version-item");

// Initialize variables
let currentModel = "llama2"; // Default model

// Map version names to Ollama model names
const versionToModel = {
    "Llama-2": "llama2",
    Mistral: "mistral",
    "Phi 3.5": "phi3.5",
    Custom: "tinyllama",
};

// Chat functionality
function addMessage(message, isUser) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${
        isUser ? "user-message" : "ai-message"
    }`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (message) {
        console.log("Sending message:", message);

        addMessage(message, true);
        userInput.value = "";

        // Show loading message
        const loadingIndicator = document.getElementById('loadingMessage');
        if (loadingIndicator) {
            loadingIndicator.style.display = "flex";
        }
        
        try {
            const response = await fetch('http://localhost:3000/api/ollama', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'chat',
                    model: currentModel,
                    messages: [{
                        role: 'user',
                        content: message
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from server');
            }

            const data = await response.json();
            addMessage(data.message, false);
        } catch (error) {
            console.error('Error in chat:', error);
            addMessage('Error: ' + error.message, false);
        } finally {
            // Hide loading message
            if (loadingIndicator) {
                loadingIndicator.style.display = "none";
            }
        }
    }
}

// Event Listeners
// Send message on Enter key
userInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Send message on button click
sendButton.addEventListener("click", sendMessage);

// Version selection
versionButton.addEventListener("click", function (e) {
    e.stopPropagation();
    versionDropdown.classList.toggle("show");
});

// Close dropdown when clicking outside
document.addEventListener("click", function (e) {
    if (!versionButton.contains(e.target)) {
        versionDropdown.classList.remove("show");
    }
});

// Close dropdown when hovering away
versionDropdown.addEventListener("mouseleave", function () {
    versionDropdown.classList.remove("show");
});

// Version item click handler
versionItems.forEach(item => {
    item.addEventListener("click", function () {
        const version = item.dataset.version;
        if (version) {
            currentModel = version;
            versionHeader.textContent = item.textContent;
            versionItems.forEach(v => v.classList.remove("active"));
            item.classList.add("active");
            versionDropdown.classList.remove("show");
        }
    });
});
