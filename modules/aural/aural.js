
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
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

let currentState = STATE.IDLE;
let session = null;
let audioContext = null;
let source = null;
let scriptProcessor = null;
let workletNode = null;
let stream = null;
let elements = {};
let currentTranscript = [];
let sessionStartTime = 0;

// --- Live API Config ---
const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

// --- Audio Helper: Blob creation for input ---
function createBlob(data) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp and convert float32 to int16
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Manual Base64 Encode
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  return {
    data: base64Data,
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Audio Helper: Output Decoding ---
function decodeBase64(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function playAudioChunk(base64Audio, ctx) {
    if (!base64Audio) return;
    
    // Decode
    const bytes = decodeBase64(base64Audio);
    const dataInt16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(dataInt16.length);
    for (let i = 0; i < dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768.0;
    }

    // Play
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    
    const bufferSource = ctx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(ctx.destination);
    bufferSource.start(0); // Play immediately for lowest latency
}

function updateUI(newState, msg = '') {
    currentState = newState;
    elements.orb.className = 'orb'; 
    
    if (newState === STATE.LISTENING) {
        elements.orb.classList.add('listening');
        elements.status.textContent = "Listening...";
        elements.micBtn.classList.add('active');
    } else if (newState === STATE.SPEAKING) {
        elements.orb.classList.add('speaking');
        elements.status.textContent = "Speaking...";
    } else if (newState === STATE.CONNECTING) {
        elements.status.textContent = "Connecting...";
    } else if (newState === STATE.ERROR) {
        elements.status.textContent = "Error";
        elements.error.textContent = msg;
        elements.error.style.display = 'block';
        elements.micBtn.classList.remove('active');
    } else {
        elements.status.textContent = "Tap to Start";
        elements.micBtn.classList.remove('active');
    }
}

async function startSession() {
    const ai = getAIClient();
    if (!ai) {
        updateUI(STATE.ERROR, "API Key missing. Cannot start Live mode.");
        return;
    }

    updateUI(STATE.CONNECTING);
    elements.error.style.display = 'none';
    elements.log.innerHTML = '';
    elements.placeholder.style.display = 'flex';
    currentTranscript = [];
    sessionStartTime = Date.now();

    try {
        // 1. Audio Setup
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 2. Connect to Gemini Live
        const sessionPromise = ai.live.connect({
            model: MODEL_LIVE,
            config: {
                responseModalities: ['AUDIO'], // Mandatory for Live API
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                systemInstruction: `You are ApexCore, an encouraging AI tutor. Keep responses short, spoken-style, and friendly. Context: ${historyService.getLastContext()}`
            },
            callbacks: {
                onopen: () => {
                    console.log("Live Session Open");
                    updateUI(STATE.LISTENING);
                    
                    // Start Input Stream
                    source = audioContext.createMediaStreamSource(stream);
                    // Use ScriptProcessor for wide compatibility (or AudioWorklet if preferred)
                    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        
                        sessionPromise.then(sess => {
                            sess.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination); // Required for script processor to fire
                },
                onmessage: (msg) => {
                    // Handle Audio Output
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        updateUI(STATE.SPEAKING);
                        // Decode and play using a separate context for output to match 24kHz model output
                        if (!window.outputCtx) window.outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                        playAudioChunk(audioData, window.outputCtx);
                    }
                    
                    if (msg.serverContent?.turnComplete) {
                        updateUI(STATE.LISTENING);
                    }
                },
                onclose: () => {
                    console.log("Session Closed");
                    stopSession();
                },
                onerror: (e) => {
                    console.error("Session Error", e);
                    updateUI(STATE.ERROR, "Connection lost.");
                }
            }
        });
        
        session = await sessionPromise;

    } catch (e) {
        console.error(e);
        updateUI(STATE.ERROR, "Could not access microphone or connect.");
    }
}

function stopSession() {
    if (session) {
        // session.close() not explicitly exposed in some SDK versions, usually handled by closing input
        session = null;
    }
    
    if (source) { source.disconnect(); source = null; }
    if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    
    // Save minimal session history
    const duration = Math.round((Date.now() - sessionStartTime) / 1000);
    if (duration > 5) {
        historyService.addAuralSession({
            transcript: [{ sender: 'system', text: 'Live Voice Session' }], // Live API doesn't return text transcript yet easily
            duration: duration,
            xpGained: Math.min(50, Math.floor(duration / 2))
        });
        showToast("Session saved.", "success");
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

    // Back Button Logic
    const { navigationContext } = stateService.getState();
    if (navigationContext.auralContext?.from) {
        elements.headerControls.innerHTML = ''; // Clear old
        const backBtn = document.createElement('a');
        backBtn.href = `#/${navigationContext.auralContext.from}`;
        backBtn.className = 'btn';
        backBtn.innerHTML = `<svg class="icon" width="18" height="18" viewBox="0 0 24 24"><use href="assets/icons/feather-sprite.svg#arrow-left"/></svg><span>Back</span>`;
        elements.headerControls.appendChild(backBtn);
    }

    elements.micBtn.removeEventListener('click', handleMicClick); // Prevent dupes
    elements.micBtn.addEventListener('click', handleMicClick);
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopSession();
}
