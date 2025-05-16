// Model page JavaScript

// Function to safely escape HTML
function escapeHTML(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Get model name from URL and validate
const urlParams = new URLSearchParams(window.location.search);
const modelName = urlParams.get('model');

if (!modelName) {
    document.getElementById('error-message').style.display = 'block';
    updatePage(null);
} else {
    // Load model information when the page loads
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/models/${modelName}`);
            
            if (!response.ok) {
                throw new Error('Failed to load model information');
            }

            const data = await response.json();
            updatePage(data);
        } catch (error) {
            console.error('Error loading model:', error);
            document.getElementById('error-message').style.display = 'block';
            updatePage(null);
        }
    });
}

// Update page content
function updatePage(model) {
    if (!model) {
        document.getElementById('model-name').textContent = 'Model Not Found';
        document.getElementById('model-description-text').textContent = 'The requested model could not be found.';
        document.getElementById('install-button').style.display = 'none';
        document.getElementById('remove-button').style.display = 'none';
        return;
    }

    // Update model name
    document.getElementById('model-name').textContent = model.name;

    // Update description
    const description = model.description || 'No description available.';
    document.getElementById('model-description-text').textContent = escapeHTML(description);

    // Update action buttons
    document.getElementById('install-button').style.display = model.installed ? 'none' : 'block';
    document.getElementById('remove-button').style.display = model.installed ? 'block' : 'none';

    // Add event listeners
    document.getElementById('install-button').addEventListener('click', () => installModel(model));
    document.getElementById('remove-button').addEventListener('click', () => removeModel(model));
}

// Function to install a model
async function installModel(model) {
    try {
        const response = await fetch('http://localhost:3000/api/install-model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: model.name })
        });

        if (!response.ok) {
            throw new Error('Failed to install model');
        }

        const data = await response.json();
        alert(data.message);
        location.reload();
    } catch (error) {
        console.error('Error installing model:', error);
        alert('Failed to install model: ' + error.message);
    }
}

// Function to remove a model
async function removeModel(model) {
    if (!confirm(`Are you sure you want to remove the ${model.name} model?`)) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/remove-model/${model.name}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to remove model');
        }

        const data = await response.json();
        alert(data.message);
        location.reload();
    } catch (error) {
        console.error('Error removing model:', error);
        alert('Failed to remove model: ' + error.message);
    }
}

// Load model information when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(`http://localhost:3000/api/models/${modelName}`);
        
        if (!response.ok) {
            throw new Error('Failed to load model information');
        }

        const data = await response.json();
        updatePage(data);
    } catch (error) {
        console.error('Error loading model:', error);
        document.getElementById('error-message').style.display = 'block';
        updatePage(null);
    }
});
