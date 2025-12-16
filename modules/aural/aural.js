
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as historyService from '../../services/historyService.js';
import { showToast } from '../../services/toastService.js';
import { getAIClient } from '../../services/apiService.js';

const STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING', 
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

let currentState = STATE.IDLE;
let sessionPromise = null;
let inputAudioContext = null;
let outputAudioContext = null;
let mediaStream = null;
let scriptProcessor = null;
let inputSource = null;
let elements = {};
let analyser = null;
let animationFrameId = null;

// --- AUDIO HELPERS ---
function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function convertFloat32ToInt16(float32Data) {
    const l = float32Data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
}

function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// --- MAIN SESSION LOGIC ---
async function startSession() {
    updateUI(STATE.CONNECTING);

    try {
        // 1. INIT AUDIO CONTEXTS (Must happen on user click)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        inputAudioContext = new AudioContext({ sampleRate: 16000 });
        outputAudioContext = new AudioContext({ sampleRate: 24000 });
        
        await inputAudioContext.resume();
        await outputAudioContext.resume();

        // 2. GET CLIENT
        const client = await getAIClient();
        if (!client) throw new Error("Could not authenticate AI client");

        // 3. GET MIC STREAM
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 4. SETUP ANALYZER FOR VISUALS
        analyser = inputAudioContext.createAnalyser();
        analyser.fftSize = 512; // Higher resolution for better visuals
        analyser.smoothingTimeConstant = 0.6; // Smoother transitions
        
        inputSource = inputAudioContext.createMediaStreamSource(mediaStream);
        scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        inputSource.connect(analyser);
        inputSource.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);

        // 5. CONNECT TO GEMINI
        sessionPromise = client.live.connect({
            model: MODEL_LIVE,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            },
            callbacks: {
                onopen: () => {
                    console.log("Connected to Gemini Live");
                    updateUI(STATE.LISTENING);
                },
                onmessage: (msg) => {
                    // Audio coming in means model is speaking
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        updateUI(STATE.SPEAKING);
                        playAudioChunk(audioData);
                    }
                    
                    // Turn complete means user finished talking
                    if (msg.serverContent?.turnComplete) {
                        updateUI(STATE.PROCESSING, "Thinking...");
                    }
                },
                onclose: () => stopSession(),
                onerror: (err) => {
                    console.error("Live API Error:", err);
                    updateUI(STATE.ERROR, "Connection Lost");
                }
            }
        });

        // 6. STREAM AUDIO
        scriptProcessor.onaudioprocess = (e) => {
            if (!sessionPromise) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = convertFloat32ToInt16(inputData);
            const base64Data = bytesToBase64(new Uint8Array(int16Data.buffer));
            
            sessionPromise.then(session => {
                session.sendRealtimeInput({
                    media: {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data
                    }
                });
            }).catch(() => {});
        };

    } catch (e) {
        console.error("Failed to start session:", e);
        updateUI(STATE.ERROR, "Mic Error or API Key Invalid");
        stopSession();
    }
}

function playAudioChunk(base64Data) {
    if (!outputAudioContext) return;
    try {
        const bytes = base64ToBytes(base64Data);
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;

        const buffer = outputAudioContext.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = outputAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(outputAudioContext.destination);
        source.start(0);
    } catch (e) {
        console.error("Audio Playback Error:", e);
    }
}

function stopSession() {
    if (sessionPromise) {
        sessionPromise.then(s => s.close()).catch(() => {});
        sessionPromise = null;
    }
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    if (inputAudioContext) inputAudioContext.close();
    if (outputAudioContext) outputAudioContext.close();
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor.onaudioprocess = null;
    }
    updateUI(STATE.IDLE);
}

function updateUI(newState, msg) {
    currentState = newState;
    if (elements.status) {
        if (msg) elements.status.textContent = msg;
        else if (newState === STATE.LISTENING) elements.status.textContent = "Listening...";
        else if (newState === STATE.SPEAKING) elements.status.textContent = "AI Speaking";
        else if (newState === STATE.CONNECTING) elements.status.textContent = "Establishing Uplink...";
        else elements.status.textContent = "Ready";
    }
    
    // Toggle active classes for CSS animations
    if (newState === STATE.IDLE || newState === STATE.ERROR) {
        elements.micBtn.classList.remove('active');
        elements.placeholder.style.display = 'block';
        elements.micBtn.innerHTML = `<div class="mic-icon-wrapper"><svg class="icon"><use href="assets/icons/feather-sprite.svg#mic"/></svg></div>`;
    } else {
        elements.micBtn.classList.add('active');
        elements.placeholder.style.display = 'none';
        elements.micBtn.innerHTML = `<div class="mic-icon-wrapper"><svg class="icon"><use href="assets/icons/feather-sprite.svg#x"/></svg></div>`;
    }
}

// --- REFINED VISUALIZER ---
function initVisualizer() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    let time = 0;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    // Helper for soft glowing blobs
    const drawBlob = (x, y, radius, color) => {
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen'; 
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    };

    const draw = () => {
        animationFrameId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let bass = 0, mid = 0, high = 0;
        
        // Analyze Frequency Bands
        if (analyser && (currentState === STATE.LISTENING || currentState === STATE.SPEAKING)) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            
            // Simple band splitting
            const bassRange = dataArray.slice(0, 10);
            const midRange = dataArray.slice(10, 50);
            const highRange = dataArray.slice(50, 100);
            
            bass = bassRange.reduce((a,b)=>a+b,0) / bassRange.length / 255;
            mid = midRange.reduce((a,b)=>a+b,0) / midRange.length / 255;
            high = highRange.reduce((a,b)=>a+b,0) / highRange.length / 255;
        } else if (currentState === STATE.PROCESSING) {
            // Simulated heartbeat when thinking
            bass = 0.2 + Math.sin(time * 0.1) * 0.1;
            mid = 0.1;
        } else {
            // Idling
            bass = 0.05 + Math.sin(time * 0.05) * 0.02;
        }

        // Time step dependent on audio energy for responsiveness
        time += 0.05 + (bass * 0.1); 

        const cx = canvas.width / 2;
        const cy = canvas.height * 0.75; 
        const baseSize = Math.min(canvas.width, canvas.height) * 0.25;

        // Blob 1: Cyan (Reacts to Bass - Size pulse)
        const r1 = baseSize * (1 + bass * 1.5);
        const x1 = cx + Math.cos(time * 0.6) * 40;
        const y1 = cy + Math.sin(time * 0.4) * 20;
        drawBlob(x1, y1, r1, 'rgba(34, 211, 238, 0.5)'); 

        // Blob 2: Magenta (Reacts to Mids - Movement jitter)
        const r2 = baseSize * (0.9 + mid * 1.2);
        const x2 = cx - Math.sin(time * 0.5) * (40 + mid * 50);
        const y2 = cy + Math.cos(time * 0.4) * (20 + mid * 30);
        drawBlob(x2, y2, r2, 'rgba(232, 121, 249, 0.5)');

        // Blob 3: Blue Core (Reacts to Highs - Intense center)
        const r3 = baseSize * (0.8 + high * 2.0); 
        drawBlob(cx, cy, r3, 'rgba(99, 102, 241, 0.7)');
        
        ctx.globalCompositeOperation = 'source-over';
    };
    draw();
}

export function init() {
    elements = {
        canvas: document.getElementById('aural-visualizer'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        placeholder: document.getElementById('aural-placeholder'),
        headerControls: document.getElementById('aural-header-controls')
    };

    elements.headerControls.innerHTML = `<button class="btn" onclick="window.history.back()">EXIT</button>`;

    elements.micBtn.onclick = () => {
        if (currentState === STATE.IDLE || currentState === STATE.ERROR) {
            startSession();
        } else {
            stopSession();
        }
    };

    initVisualizer();
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopSession();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}
