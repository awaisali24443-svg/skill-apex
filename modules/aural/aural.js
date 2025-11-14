// --- State Management ---
const STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

let currentState = STATE.IDLE;
let socket, mediaStream, inputAudioContext, outputAudioContext, scriptProcessor, connectionTimeout;
let nextStartTime = 0;
let sources = new Set();
let currentInputTranscription = '', currentOutputTranscription = '';
let appState; // Store appState globally in this module

// --- DOM Elements ---
let elements = {};

// --- Audio Utilities ---
function encode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
function createBlob(data) {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

// --- UI & State Updates ---
function updateUI(newState, message = '') {
    currentState = newState;
    elements.orb.className = 'orb'; // Reset classes

    switch (currentState) {
        case STATE.IDLE:
            elements.status.textContent = 'Tap to Start';
            elements.micBtn.classList.remove('active');
            elements.micBtn.setAttribute('aria-label', 'Start conversation');
            break;
        case STATE.CONNECTING:
            elements.status.textContent = 'Connecting...';
            elements.micBtn.setAttribute('aria-label', 'Connecting');
            break;
        case STATE.LISTENING:
            elements.status.textContent = 'Listening...';
            elements.orb.classList.add('listening');
            elements.micBtn.classList.add('active');
            elements.micBtn.setAttribute('aria-label', 'Stop conversation');
            break;
        case STATE.THINKING:
            elements.status.textContent = 'Thinking...';
            elements.orb.classList.add('thinking');
            elements.micBtn.setAttribute('aria-label', 'Stop conversation');
            break;
        case STATE.SPEAKING:
            elements.status.textContent = 'Speaking...';
            elements.orb.classList.add('speaking');
            elements.micBtn.setAttribute('aria-label', 'Stop conversation');
            break;
        case STATE.ERROR:
            elements.status.textContent = 'Error';
            elements.error.textContent = message;
            elements.error.style.display = 'block';
            elements.micBtn.classList.remove('active');
            elements.micBtn.setAttribute('aria-label', 'Start conversation');
            break;
    }
}

function addTranscriptionEntry(text, type) {
    if (!text.trim()) return;
    if (elements.placeholder) {
        elements.placeholder.style.display = 'none';
    }
    const entry = document.createElement('div');
    entry.className = `transcription-entry ${type}`;
    entry.textContent = text;
    elements.log.prepend(entry);
}

// --- Core Conversation Logic ---
async function startConversation() {
    if (currentState !== STATE.IDLE && currentState !== STATE.ERROR) return;
    updateUI(STATE.CONNECTING);
    elements.error.style.display = 'none';

    connectionTimeout = setTimeout(() => {
        if (currentState === STATE.CONNECTING) {
            updateUI(STATE.ERROR, 'Connection timed out. Please try again.');
            stopConversation();
        }
    }, 8000); // 8-second timeout

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const { auralContext } = appState.context;
        const systemInstruction = auralContext?.systemInstruction || '';
        const socketUrl = `${protocol}//${window.location.host}/?systemInstruction=${encodeURIComponent(systemInstruction)}`;
        socket = new WebSocket(socketUrl);


        socket.onopen = () => {
            clearTimeout(connectionTimeout);
            updateUI(STATE.LISTENING);
            const source = inputAudioContext.createMediaStreamSource(mediaStream);
            scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (event) => {
                if (socket.readyState !== WebSocket.OPEN) return;
                const inputData = event.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                socket.send(JSON.stringify({ type: 'audio_input', payload: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
        };

        socket.onmessage = async (event) => {
            const serverMessage = JSON.parse(event.data);
            if (serverMessage.type === 'error') {
                updateUI(STATE.ERROR, serverMessage.message);
                return;
            }

            const geminiMessage = serverMessage.message;
            if (!geminiMessage) return;

            if (geminiMessage.serverContent?.interrupted) {
                sources.forEach(source => source.stop());
                sources.clear();
                nextStartTime = 0;
            }

            const audioData = geminiMessage.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                updateUI(STATE.SPEAKING);
                const decoded = decode(audioData);
                const audioBuffer = await decodeAudioData(decoded, outputAudioContext, 24000, 1);
                
                nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContext.destination);
                source.addEventListener('ended', () => sources.delete(source));
                source.start(nextStartTime);
                nextStartTime += audioBuffer.duration;
                sources.add(source);
            }

            if (geminiMessage.serverContent?.outputTranscription?.text) {
                currentOutputTranscription += geminiMessage.serverContent.outputTranscription.text;
            }
            if (geminiMessage.serverContent?.inputTranscription?.text) {
                currentInputTranscription += geminiMessage.serverContent.inputTranscription.text;
            }
            if(geminiMessage.serverContent?.turnComplete) {
                addTranscriptionEntry(currentInputTranscription, 'user');
                addTranscriptionEntry(currentOutputTranscription, 'model');
                currentInputTranscription = '';
                currentOutputTranscription = '';
                
                // Wait for any queued audio to finish playing before switching back to LISTENING
                const checkPlaybackAndSetListening = () => {
                    // Check if context exists and if current time has passed the scheduled end time
                    if (outputAudioContext && outputAudioContext.currentTime + 0.1 >= nextStartTime) {
                        updateUI(STATE.LISTENING);
                    } else {
                        // If audio is still playing, check again shortly
                        setTimeout(checkPlaybackAndSetListening, 100);
                    }
                };
                checkPlaybackAndSetListening();
            }
        };
        
        socket.onerror = (err) => updateUI(STATE.ERROR, `WebSocket error. Check console.`);
        socket.onclose = () => stopConversation();

    } catch (err) {
        console.error("Error starting conversation:", err);
        clearTimeout(connectionTimeout);
        let message = `Could not start microphone: ${err.message}`;
        if (err.name === 'NotAllowedError') {
            message = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        }
        updateUI(STATE.ERROR, message);
    }
}

function stopConversation() {
    if (currentState === STATE.IDLE) return;
    
    clearTimeout(connectionTimeout);

    if (socket) {
        socket.close();
        socket = null;
    }
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor.onaudioprocess = null;
        scriptProcessor = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (inputAudioContext) {
        inputAudioContext.close().catch(e => {});
        inputAudioContext = null;
    }
    if (outputAudioContext) {
        sources.forEach(s => s.stop());
        sources.clear();
        outputAudioContext.close().catch(e => {});
        outputAudioContext = null;
    }

    if (elements.log && elements.log.childElementCount <= 1 && elements.placeholder) {
        elements.placeholder.style.display = 'flex';
    }

    updateUI(STATE.IDLE);
}

function handleMicClick() {
    if (currentState === STATE.IDLE || currentState === STATE.ERROR) {
        startConversation();
    } else {
        stopConversation();
    }
}

// --- Module Lifecycle ---
export function init(globalState) {
    appState = globalState;
    elements = {
        log: document.getElementById('transcription-log'),
        placeholder: document.getElementById('aural-placeholder'),
        orb: document.getElementById('orb'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        error: document.getElementById('aural-error'),
        headerControls: document.getElementById('aural-header-controls'),
    };

    const { auralContext } = appState.context;
    if (auralContext && auralContext.from) {
        const backBtn = document.createElement('a');
        backBtn.href = `#/${auralContext.from}`;
        backBtn.className = 'btn';
        backBtn.innerHTML = `
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            <span>Back to Lesson</span>
        `;
        elements.headerControls.appendChild(backBtn);
    }


    elements.micBtn.addEventListener('click', handleMicClick);
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopConversation();
    if(elements.micBtn) {
        elements.micBtn.removeEventListener('click', handleMicClick);
    }
    // Clean up the context when leaving the module
    if (appState && appState.context.auralContext) {
        delete appState.context.auralContext;
    }
}