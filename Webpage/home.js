// Home page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    const modelStats = document.querySelector('.model-stats');
    const loadingMessage = document.createElement('li');
    loadingMessage.className = 'loading';
    loadingMessage.textContent = 'Loading model information...';
    modelStats.innerHTML = '';
    modelStats.appendChild(loadingMessage);

    try {
        // Fetch installed models from the server
        const response = await fetch('http://localhost:3000/api/models');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || !data.stats) {
            throw new Error('Invalid response format');
        }
        
        // Update the UI with the actual data
        modelStats.innerHTML = `
            <li>Total Models: ${data.stats.total}</li>
            <li>Active: ${data.stats.active}</li>
            <li>Storage Used: ${data.stats.totalSizeGB}GB</li>
        `;
    } catch (error) {
        console.error('Error loading model information:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        const errorMessage = getErrorMessage(error);
        modelStats.innerHTML = `
            <li class="error">${errorMessage}</li>
            <li class="details">Check browser console for details</li>
        `;
    }
});

function getErrorMessage(error) {
    if (error.name === 'AbortError') {
        return 'Request timed out. Is Ollama running?';
    }
    if (error.message.includes('Failed to fetch')) {
        return 'Could not connect to the server. Make sure the server is running.';
    }
    if (error.message.includes('HTTP error!')) {
        return `Server returned error: ${error.message}`;
    }
    return error.message || 'Failed to load model information';
}
