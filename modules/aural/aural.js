
import { GoogleGenAI } from "@google/genai";
import * as stateService from '../../services/stateService.js';
import * as historyService from '../../services/historyService.js';
import { showToast } from '../../services/toastService.js';
import { getAIClient } from '../../services/apiService.js';

const STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

let currentState = STATE.IDLE;
let sessionPromise = null;

// Audio Contexts
let inputAudioContext = null;
let outputAudioContext = null;

// Input Nodes
let mediaStream = null;
let inputSource = null;
let scriptProcessor = null;

// Output Scheduling
let nextStartTime = 0;
const scheduledSources = new Set();

// Visualizer
let analyser = null;
let animationFrameId = null;
let elements = {};

// --- UTILS: BASE64 & PCM ---

function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Float32 (Web Audio) to Int16 (Gemini API)
function createPcmBlob(float32Data) {
  const l = float32Data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp and scale
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: bytesToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Convert Int16 (Gemini API) to Float32 (Web Audio)
function decodeAudioData(base64Str, ctx) {
    const bytes = base64ToBytes(base64Str);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }
    
    const buffer = ctx.createBuffer(1, float32.length, 24000); // Model output is 24kHz
    buffer.getChannelData(0).set(float32);
    return buffer;
}

// --- VISUALIZER ---
function initVisualizer() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
        animationFrameId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let dataArray = new Uint8Array(5);
        if (analyser) {
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
        }

        // Calculate average volume
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        const average = sum / (dataArray.length || 1);
        
        let amplitude = 0;
        if (currentState === STATE.LISTENING || currentState === STATE.SPEAKING) {
            amplitude = average / 5; 
        } else {
            amplitude = 2 + Math.sin(Date.now() / 500); // Idle pulse
        }

        // Draw Waves
        drawWave(ctx, canvas, amplitude, 1, '#0052CC', 0.002);
        drawWave(ctx, canvas, amplitude * 0.8, -1, '#D946EF', 0.003);
        drawWave(ctx, canvas, amplitude * 0.5, 1, '#7C3AED', 0.001);
    };
    draw();
}

function drawWave(ctx, canvas, amplitude, direction, color, frequency) {
    const centerY = canvas.height / 2;
    const time = Date.now() * frequency;
    
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    
    for (let x = 0; x < canvas.width; x += 10) {
        const y = Math.sin(x * 0.01 + time * direction) * amplitude * Math.sin(x / canvas.width * Math.PI); 
        ctx.lineTo(x, centerY + y * 20);
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// --- MAIN AUDIO LOGIC ---

function updateUI(newState, msg = '') {
    currentState = newState;
    const statusText = elements.status;
    const micBtn = elements.micBtn;

    switch (newState) {
        case STATE.CONNECTING:
            statusText.textContent = "ESTABLISHING UPLINK...";
            statusText.style.color = "#FFC107";
            micBtn.classList.add('active'); // Pulse while connecting
            break;
        case STATE.LISTENING:
            statusText.textContent = "LISTENING // FREQUENCY OPEN";
            statusText.style.color = "#0052CC";
            micBtn.classList.add('active');
            break;
        case STATE.SPEAKING:
            statusText.textContent = "INCOMING TRANSMISSION...";
            statusText.style.color = "#D946EF";
            micBtn.classList.add('active');
            break;
        case STATE.ERROR:
            statusText.textContent = msg || "CONNECTION SEVERED";
            statusText.style.color = "#EF4444";
            micBtn.classList.remove('active');
            if(msg) showToast(msg, 'error');
            break;
        default: // IDLE
            statusText.textContent = "SYSTEM STANDBY";
            statusText.style.color = "#9CA3AF";
            micBtn.classList.remove('active');
            break;
    }
}

async function startSession() {
    updateUI(STATE.CONNECTING);
    
    const client = await getAIClient();
    if (!client) {
        updateUI(STATE.ERROR, "AUTH KEY MISSING");
        return;
    }

    try {
        // 1. Setup Audio Contexts
        // Input: 16kHz for model compatibility
        inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        // Output: 24kHz matches model output
        outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        // 2. Setup Mic Stream
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 3. Setup Analyser (Visualizer) attached to Mic
        analyser = inputAudioContext.createAnalyser();
        analyser.fftSize = 256;
        
        // 4. Setup Input Processing
        inputSource = inputAudioContext.createMediaStreamSource(mediaStream);
        scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        inputSource.connect(analyser); // For visualizer
        inputSource.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);

        // 5. Connect to Gemini Live
        sessionPromise = client.live.connect({
            model: MODEL_LIVE,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                systemInstruction: "You are ApexCore. Speak like a witty, high-energy tech podcast host. Keep answers under 15 seconds. Use analogies. Be funny. If asked about code, describe the logic simply. No lecturing!"
            },
            callbacks: {
                onopen: () => {
                    console.log("Gemini Live Session Opened");
                    updateUI(STATE.LISTENING);
                    nextStartTime = outputAudioContext.currentTime;
                },
                onmessage: (msg) => {
                    handleServerMessage(msg);
                },
                onclose: (e) => {
                    console.log("Session Closed", e);
                    stopSession();
                },
                onerror: (e) => {
                    console.error("Session Error", e);
                    updateUI(STATE.ERROR, "Signal Lost");
                }
            }
        });

        // 6. Hook up Processor to Send Data
        scriptProcessor.onaudioprocess = (e) => {
            if (!sessionPromise) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            
            // Send to model if session is ready
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            }).catch(err => {
                console.warn("Failed to send audio", err);
            });
        };

    } catch (e) {
        console.error("Start Session Failed:", e);
        updateUI(STATE.ERROR, "Access Denied (Microphone)");
        stopSession();
    }
}

function handleServerMessage(message) {
    const { serverContent } = message;
    
    // 1. Handle Audio Output
    const modelAudio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (modelAudio) {
        updateUI(STATE.SPEAKING);
        queueAudioOutput(modelAudio);
    }

    // 2. Handle Interruption
    if (serverContent?.interrupted) {
        console.log("Model Interrupted");
        clearAudioQueue();
        updateUI(STATE.LISTENING);
    }

    // 3. Handle Turn Complete (Model finished speaking this phrase)
    if (serverContent?.turnComplete) {
        updateUI(STATE.LISTENING);
    }
}

function queueAudioOutput(base64Audio) {
    if (!outputAudioContext) return;

    try {
        const audioBuffer = decodeAudioData(base64Audio, outputAudioContext);
        
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        
        // Schedule gapless playback
        // Ensure we don't schedule in the past
        const now = outputAudioContext.currentTime;
        nextStartTime = Math.max(nextStartTime, now);
        
        source.start(nextStartTime);
        nextStartTime += audioBuffer.duration;
        
        // Track for cancellation
        scheduledSources.add(source);
        source.onended = () => {
            scheduledSources.delete(source);
            if (scheduledSources.size === 0) {
               // Could trigger idle state here if strictly needed
            }
        };
        
    } catch (e) {
        console.error("Audio Decode Error", e);
    }
}

function clearAudioQueue() {
    scheduledSources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    scheduledSources.clear();
    if(outputAudioContext) nextStartTime = outputAudioContext.currentTime;
}

function stopSession() {
    // 1. Stop Input
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor.onaudioprocess = null;
        scriptProcessor = null;
    }
    if (inputSource) {
        inputSource.disconnect();
        inputSource = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if (inputAudioContext) {
        inputAudioContext.close();
        inputAudioContext = null;
    }

    // 2. Stop Output
    clearAudioQueue();
    if (outputAudioContext) {
        outputAudioContext.close();
        outputAudioContext = null;
    }

    // 3. Close Session
    if (sessionPromise) {
        sessionPromise.then(session => session.close()).catch(() => {});
        sessionPromise = null;
    }

    analyser = null;
    updateUI(STATE.IDLE);
}

function handleToggle() {
    if (currentState === STATE.IDLE || currentState === STATE.ERROR) {
        startSession();
    } else {
        stopSession();
    }
}

export function init() {
    elements = {
        canvas: document.getElementById('aural-visualizer'),
        log: document.getElementById('transcription-log'),
        placeholder: document.getElementById('aural-placeholder'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        headerControls: document.getElementById('aural-header-controls'),
    };

    // Setup Header Back Button
    const { navigationContext } = stateService.getState();
    elements.headerControls.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#arrow-left"/></svg> DISCONNECT`;
    backBtn.onclick = () => {
        stopSession();
        window.history.back();
    };
    elements.headerControls.appendChild(backBtn);

    elements.micBtn.onclick = handleToggle;
    
    initVisualizer();
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopSession();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', null);
}
