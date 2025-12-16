
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import { getAIClient } from '../../services/apiService.js';

const STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING', 
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

// NOTE: Gemini 3 Pro does NOT support Real-time Live API yet. 
// We must use 2.5 Flash Native Audio for this specific feature.
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
let outputAnalyser = null; // New analyser for AI voice
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
        // 1. INIT AUDIO CONTEXTS
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        inputAudioContext = new AudioContext({ sampleRate: 16000 });
        outputAudioContext = new AudioContext({ sampleRate: 24000 });
        
        // Browsers require resumption after creation in a click handler
        await inputAudioContext.resume();
        await outputAudioContext.resume();

        // 2. GET CLIENT
        const client = await getAIClient();
        if (!client) {
            throw new Error("API Key configuration missing. Cannot connect to AI.");
        }

        // 3. GET MIC STREAM
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 4. SETUP ANALYZERS (Input & Output)
        analyser = inputAudioContext.createAnalyser();
        analyser.fftSize = 256; 
        analyser.smoothingTimeConstant = 0.5;
        
        outputAnalyser = outputAudioContext.createAnalyser();
        outputAnalyser.fftSize = 256;
        outputAnalyser.smoothingTimeConstant = 0.5;
        
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
                    console.log("✅ Gemini Live Connected");
                    updateUI(STATE.LISTENING);
                },
                onmessage: (msg) => {
                    try {
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            updateUI(STATE.SPEAKING);
                            playAudioChunk(audioData);
                        }
                        if (msg.serverContent?.turnComplete) {
                            updateUI(STATE.PROCESSING, "Processing...");
                        }
                    } catch (err) {
                        console.error("Error processing message:", err);
                    }
                },
                onclose: () => {
                    console.log("Session closed");
                    stopSession();
                },
                onerror: (err) => {
                    console.error("Live API Error:", err);
                    updateUI(STATE.ERROR, "Connection Refused. Check API Key.");
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
            }).catch(e => {
                console.warn("Failed to send audio chunk", e);
            });
        };

    } catch (e) {
        console.error("Failed to start session:", e);
        let errorMsg = "Microphone Error";
        if (e.message.includes("API Key")) errorMsg = "API Key Invalid or Missing";
        updateUI(STATE.ERROR, errorMsg);
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
        
        // Connect to BOTH visualizer and speakers
        if (outputAnalyser) {
            source.connect(outputAnalyser);
        }
        source.connect(outputAudioContext.destination);
        
        source.start(0);
        
        // When audio ends, if nothing else is playing, go back to listening state visualization
        source.onended = () => {
             if (currentState === STATE.SPEAKING) {
                 // Keep state speaking if more chunks are coming, otherwise logic elsewhere handles turn
             }
        };

    } catch (e) {
        console.error("Audio Playback Error:", e);
    }
}

function stopSession() {
    if (sessionPromise) {
        sessionPromise.then(s => s.close()).catch(() => {});
        sessionPromise = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if (inputAudioContext) {
        inputAudioContext.close();
        inputAudioContext = null;
    }
    if (outputAudioContext) {
        outputAudioContext.close();
        outputAudioContext = null;
    }
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    // Only go to idle if not in error state to let user see error
    if (currentState !== STATE.ERROR) {
        updateUI(STATE.IDLE);
    }
}

function updateUI(newState, msg) {
    currentState = newState;
    if (elements.status) {
        if (msg) elements.status.textContent = msg;
        else if (newState === STATE.LISTENING) elements.status.textContent = "Listening...";
        else if (newState === STATE.SPEAKING) elements.status.textContent = "AI Speaking";
        else if (newState === STATE.CONNECTING) elements.status.textContent = "Establishing Uplink...";
        else if (newState === STATE.PROCESSING) elements.status.textContent = "Thinking...";
        else elements.status.textContent = "Ready - Tap to Start";
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
        
        let inputEnergy = 0;
        let outputEnergy = 0;
        
        // 1. Analyze Microphone Input
        if (analyser && (currentState === STATE.LISTENING || currentState === STATE.CONNECTING)) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            inputEnergy = (dataArray.reduce((a,b)=>a+b,0) / dataArray.length) / 255;
        }

        // 2. Analyze AI Output
        if (outputAnalyser && currentState === STATE.SPEAKING) {
            const dataArray = new Uint8Array(outputAnalyser.frequencyBinCount);
            outputAnalyser.getByteFrequencyData(dataArray);
            outputEnergy = (dataArray.reduce((a,b)=>a+b,0) / dataArray.length) / 255;
        }

        // Processing Heartbeat
        if (currentState === STATE.PROCESSING) {
            inputEnergy = 0.1 + Math.sin(time * 0.2) * 0.05; 
        } else if (currentState === STATE.IDLE) {
            inputEnergy = 0.05; 
        }

        const totalEnergy = inputEnergy + (outputEnergy * 1.5); // Boost output visual
        time += 0.05 + (totalEnergy * 0.1); 

        const cx = canvas.width / 2;
        const cy = canvas.height * 0.75; 
        const baseSize = Math.min(canvas.width, canvas.height) * 0.3;

        // Visual Logic:
        // Blue/Cyan = Listening/Idle
        // Pink/Purple = AI Speaking
        
        let color1 = 'rgba(34, 211, 238, 0.4)'; // Cyan
        let color2 = 'rgba(232, 121, 249, 0.4)'; // Magenta
        
        if (currentState === STATE.SPEAKING) {
            color1 = 'rgba(236, 72, 153, 0.6)'; // Pink
            color2 = 'rgba(168, 85, 247, 0.6)'; // Purple
        }

        // Blob 1: Left
        const r1 = baseSize * (0.8 + totalEnergy);
        const x1 = cx + Math.cos(time * 0.7) * 30;
        const y1 = cy + Math.sin(time * 0.5) * 30;
        drawBlob(x1, y1, r1, color1); 

        // Blob 2: Right
        const r2 = baseSize * (0.8 + totalEnergy * 0.8);
        const x2 = cx - Math.sin(time * 0.6) * 30;
        const y2 = cy + Math.cos(time * 0.8) * 30;
        drawBlob(x2, y2, r2, color2);

        // Blob 3: Core (White/Bright)
        const r3 = baseSize * (0.5 + totalEnergy * 1.2); 
        drawBlob(cx, cy, r3, 'rgba(255, 255, 255, 0.3)');
        
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
