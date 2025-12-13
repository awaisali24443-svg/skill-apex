
import { GoogleGenAI } from "@google/genai";
import * as stateService from '../../services/stateService.js';
import * as historyService from '../../services/historyService.js';
import { showToast } from '../../services/toastService.js';
import { getAIClient } from '../../services/apiService.js';

// --- State ---
const STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

let currentState = STATE.IDLE;
let session = null;
let audioContext = null;
let analyser = null; // For Visualizer
let source = null;
let scriptProcessor = null;
let stream = null;
let elements = {};
let sessionStartTime = 0;
let visualizerFrameId = null;
let outputContext = null; // Context for model audio output

// --- Audio Visualizer ---
function initVisualizer() {
    if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId);
    
    const updateVisuals = () => {
        if (!analyser || !elements.orb) return;
        
        // Frequency Data (0-255)
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume for reactivity
        let sum = 0;
        // Focus on lower frequencies for "bass" impact (first 50 bins)
        for (let i = 0; i < 50; i++) {
            sum += dataArray[i];
        }
        const average = sum / 50;
        
        // Map average (0-255) to scale (1.0 - 1.5)
        const scale = 1 + (average / 255) * 0.6;
        
        elements.orb.style.transform = `scale(${scale})`;
        
        visualizerFrameId = requestAnimationFrame(updateVisuals);
    };
    
    updateVisuals();
}

// --- Audio Helpers ---
function createBlob(data) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    data: btoa(binary),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function decodeBase64(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function playAudioChunk(base64Audio) {
    if (!base64Audio) return;
    
    // Init Output Context on first play if needed (User Gesture Requirement)
    if (!outputContext) {
        outputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        // Create analyser for visualizer on OUTPUT
        analyser = outputContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        initVisualizer();
    }
    
    if (outputContext.state === 'suspended') {
        await outputContext.resume();
    }

    const bytes = decodeBase64(base64Audio);
    const dataInt16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(dataInt16.length);
    for (let i = 0; i < dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768.0;
    }
    
    const buffer = outputContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    
    const bufferSource = outputContext.createBufferSource();
    bufferSource.buffer = buffer;
    
    // Connect Source -> Analyser -> Speakers
    bufferSource.connect(analyser);
    analyser.connect(outputContext.destination);
    
    bufferSource.start(0);
}

function updateUI(newState, msg = '') {
    currentState = newState;
    
    // Class Reset
    elements.orb.classList.remove('listening', 'thinking', 'speaking');
    elements.micBtn.classList.remove('active');
    elements.error.style.display = 'none';

    switch (newState) {
        case STATE.LISTENING:
            elements.orb.classList.add('listening');
            elements.status.textContent = "I'm Listening...";
            elements.micBtn.classList.add('active');
            break;
        case STATE.THINKING:
            elements.orb.classList.add('thinking');
            elements.status.textContent = "Processing...";
            break;
        case STATE.SPEAKING:
            elements.orb.classList.add('speaking');
            elements.status.textContent = "Speaking...";
            break;
        case STATE.CONNECTING:
            elements.status.textContent = "Establishing Uplink...";
            break;
        case STATE.ERROR:
            elements.status.textContent = "Connection Failed";
            elements.error.textContent = msg || "Unknown Error";
            elements.error.style.display = 'block';
            break;
        default: // IDLE
            elements.status.textContent = "Tap Mic to Start";
            elements.orb.style.transform = 'scale(1)'; // Reset visualizer scale
            break;
    }
}

function addTranscriptEntry(text, sender) {
    if (!text) return;
    elements.placeholder.style.display = 'none';
    
    const entry = document.createElement('div');
    entry.className = `transcription-entry ${sender}`;
    entry.textContent = text;
    elements.log.appendChild(entry);
    
    // Smooth scroll to bottom
    elements.log.scrollTo({ top: elements.log.scrollHeight, behavior: 'smooth' });
}

async function startSession() {
    const client = getAIClient();
    if (!client) {
        updateUI(STATE.ERROR, "System Offline. Missing API Key.");
        return;
    }

    updateUI(STATE.CONNECTING);
    elements.log.innerHTML = '';
    sessionStartTime = Date.now();

    try {
        // 1. Setup Input Audio (Microphone)
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 2. Connect to Gemini Live
        const sessionPromise = client.live.connect({
            model: MODEL_LIVE,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                inputAudioTranscription: { model: "google-provided-model" }, // Enable user transcript
                systemInstruction: `You are ApexCore. Be concise, encouraging, and helpful. Current Context: ${historyService.getLastContext()}`
            },
            callbacks: {
                onopen: () => {
                    console.log("Live Session Open");
                    updateUI(STATE.LISTENING);
                    
                    source = audioContext.createMediaStreamSource(stream);
                    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (e) => {
                        if (currentState === STATE.LISTENING || currentState === STATE.SPEAKING) {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(sess => sess.sendRealtimeInput({ media: pcmBlob }));
                        }
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination);
                },
                onmessage: (msg) => {
                    // Audio Output
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        updateUI(STATE.SPEAKING);
                        playAudioChunk(audioData);
                    }
                    
                    // Turn Complete (Back to Listening)
                    if (msg.serverContent?.turnComplete) {
                        updateUI(STATE.LISTENING);
                    }
                    
                    // Transcription
                    // Note: Current SDK might package transcription differently, this is best-effort based on docs
                    const transcript = msg.serverContent?.modelTurn?.parts?.[0]?.text; // Sometimes text comes separately
                    if (transcript) addTranscriptEntry(transcript, 'model');
                },
                onclose: () => {
                    stopSession();
                },
                onerror: (e) => {
                    console.error("Session Error", e);
                    updateUI(STATE.ERROR, "Lost connection to neural core.");
                }
            }
        });
        
        session = await sessionPromise;

    } catch (e) {
        console.error(e);
        updateUI(STATE.ERROR, "Microphone access denied or network error.");
    }
}

function stopSession() {
    // Cleanup Audio
    if (source) { source.disconnect(); source = null; }
    if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    if (outputContext) { outputContext.close(); outputContext = null; }
    if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId);
    
    session = null;
    analyser = null;

    // Log Session
    const duration = Math.round((Date.now() - sessionStartTime) / 1000);
    if (duration > 5) {
        historyService.addAuralSession({
            transcript: [{ sender: 'system', text: 'Voice Session Ended' }], // Placeholder until full transcript avail
            duration: duration,
            xpGained: Math.min(100, Math.floor(duration / 2))
        });
    }
    
    updateUI(STATE.IDLE);
}

function handleMicClick() {
    if (currentState === STATE.IDLE || currentState === STATE.ERROR) {
        startSession();
    } else {
        stopSession();
    }
}

export function init() {
    elements = {
        log: document.getElementById('transcription-log'),
        placeholder: document.getElementById('aural-placeholder'),
        orb: document.getElementById('orb'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        error: document.getElementById('aural-error'),
        headerControls: document.getElementById('aural-header-controls'),
    };

    // Header Back Button Injection
    const { navigationContext } = stateService.getState();
    elements.headerControls.innerHTML = ''; // Clear prev
    const backBtn = document.createElement('a');
    // Default to home if no context
    const backPath = navigationContext.auralContext?.from ? `#/${navigationContext.auralContext.from}` : '#/';
    backBtn.href = backPath;
    backBtn.className = 'btn';
    backBtn.innerHTML = `<svg class="icon" width="18" height="18" viewBox="0 0 24 24"><use href="assets/icons/feather-sprite.svg#arrow-left"/></svg><span>End Session</span>`;
    backBtn.onclick = (e) => {
        stopSession();
    };
    elements.headerControls.appendChild(backBtn);

    elements.micBtn.onclick = handleMicClick;
    
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopSession();
}
