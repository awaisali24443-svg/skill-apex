// services/libraryLoader.js

// This service manages the dynamic loading of third-party scripts
// to prevent race conditions where our code tries to use a library
// before it's fully loaded.

const loadedScripts = new Map();

function loadScript(url) {
    // If the script is already loading or loaded, return the existing promise
    if (loadedScripts.has(url)) {
        return loadedScripts.get(url);
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            console.log(`${url} loaded successfully.`);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${url}`);
            reject(new Error(`Failed to load script: ${url}`));
            loadedScripts.delete(url); // Allow retrying
        };
        document.head.appendChild(script);
    });

    loadedScripts.set(url, promise);
    return promise;
}

export async function loadThreeJS() {
    try {
        // Sequentially load Three.js first, then OrbitControls which depends on it.
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/0.164.1/three.min.js');
    } catch (error) {
        console.error("Could not load Three.js libraries.", error);
        throw error; // Re-throw to be caught by the calling module
    }
}

export async function loadChartJS() {
    try {
        await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js');
    } catch (error) {
        console.error("Could not load Chart.js library.", error);
        throw error;
    }
}