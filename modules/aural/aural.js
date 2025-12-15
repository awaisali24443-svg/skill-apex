
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
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
        
        // CRITICAL: Force Resume
        await inputAudioContext.resume();
        await outputAudioContext.resume();

        // 2. GET CLIENT
        const client = await getAIClient();
        if (!client) throw new Error("Could not authenticate AI client");

        // 3. GET MIC STREAM
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 4. SETUP ANALYZER
        analyser = inputAudioContext.createAnalyser();
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
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        updateUI(STATE.SPEAKING);
                        playAudioChunk(audioData);
                    }
                    if (msg.serverContent?.turnComplete) {
                        updateUI(STATE.LISTENING);
                    }
                },
                onclose: () => stopSession(),
                onerror: (err) => {
                    console.error("Live API Error:", err);
                    updateUI(STATE.ERROR, "Connection Error");
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
            }).catch(() => {}); // Ignore send errors if session closed
        };

    } catch (e) {
        console.error("Failed to start session:", e);
        updateUI(STATE.ERROR, "Mic Access Denied or API Error");
        stopSession();
    }
}

function playAudioChunk(base64Data) {
    if (!outputAudioContext) return;
    try {
        const bytes = base64ToBytes(base64Data);
        // Convert PCM 16-bit to Float32
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
    if (elements.status) elements.status.textContent = msg || newState;
    
    if (newState === STATE.CONNECTING || newState === STATE.LISTENING || newState === STATE.SPEAKING) {
        elements.micBtn.classList.add('active');
        elements.placeholder.style.display = 'none';
    } else {
        elements.micBtn.classList.remove('active');
        elements.placeholder.style.display = 'block';
    }
}

function initVisualizer() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
        animationFrameId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let barHeight = 0;
        if (currentState === STATE.LISTENING || currentState === STATE.SPEAKING) {
            if (analyser) {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                let sum = 0;
                for(let i=0; i<array.length; i++) sum += array[i];
                barHeight = sum / array.length;
            } else {
                barHeight = Math.random() * 50; // Fake it for visual feedback if analyzer glitch
            }
        }

        const cy = canvas.height / 2;
        ctx.beginPath();
        ctx.arc(canvas.width/2, cy, 50 + barHeight, 0, 2*Math.PI);
        ctx.strokeStyle = currentState === STATE.SPEAKING ? '#D946EF' : '#0052CC';
        ctx.lineWidth = 2;
        ctx.stroke();
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

    // Header Back Button
    elements.headerControls.innerHTML = `<button class="btn" onclick="window.history.back()">EXIT</button>`;

    // Toggle Handler
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
