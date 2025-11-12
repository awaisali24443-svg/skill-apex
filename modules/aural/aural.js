import { GoogleGenAI, Modality } from '@google/genai';

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
let session, ai, mediaStream, inputAudioContext, outputAudioContext, scriptProcessor;
let nextStartTime = 0;
let sources = new Set();
let currentInputTranscription = '', currentOutputTranscription = '';

// --- DOM Elements ---
let elements = {};

// --- Audio Utilities (as per Gemini Spec) ---
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
async function decodeAudioData(data, ctx) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
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
    const entry = document.createElement('div');
    entry.className = `transcription-entry ${type}`;
    entry.textContent = text;
    elements.log.prepend(entry);
}

// --- Core Conversation Logic ---
async function startConversation() {
    if (currentState !== STATE.IDLE) return;
    updateUI(STATE.CONNECTING);
    elements.error.style.display = 'none';

    try {
        if (!ai) ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    updateUI(STATE.LISTENING);
                    const source = inputAudioContext.createMediaStreamSource(mediaStream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message) => {
                    if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                        updateUI(STATE.SPEAKING);
                        const audioData = message.serverContent.modelTurn.parts[0].inlineData.data;
                        const decoded = decode(audioData);
                        const audioBuffer = await decodeAudioData(decoded, outputAudioContext);
                        
                        nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.addEventListener('ended', () => sources.delete(source));
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                        sources.add(source);
                    }
                    if (message.serverContent?.outputTranscription?.text) {
                        currentOutputTranscription += message.serverContent.outputTranscription.text;
                    }
                    if (message.serverContent?.inputTranscription?.text) {
                        currentInputTranscription += message.serverContent.inputTranscription.text;
                    }
                    if(message.serverContent?.turnComplete) {
                        addTranscriptionEntry(currentInputTranscription, 'user');
                        addTranscriptionEntry(currentOutputTranscription, 'model');
                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        updateUI(STATE.LISTENING);
                    }
                },
                onerror: (e) => updateUI(STATE.ERROR, `Session error: ${e.message || e}`),
                onclose: () => { if(currentState !== STATE.IDLE) stopConversation(); },
            }
        });
        session = await sessionPromise;
    } catch (err) {
        console.error(err);
        updateUI(STATE.ERROR, err.message);
    }
}

function stopConversation() {
    if (currentState === STATE.IDLE) return;
    
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
        inputAudioContext.close();
        inputAudioContext = null;
    }
    if (outputAudioContext) {
        sources.forEach(s => s.stop());
        sources.clear();
        outputAudioContext.close();
        outputAudioContext = null;
    }
    if (session) {
        session.close();
        session = null;
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
export function init(appState) {
    elements = {
        log: document.getElementById('transcription-log'),
        orb: document.getElementById('orb'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        error: document.getElementById('aural-error'),
    };
    elements.micBtn.addEventListener('click', handleMicClick);
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopConversation();
    if(elements.micBtn) {
        elements.micBtn.removeEventListener('click', handleMicClick);
    }
}