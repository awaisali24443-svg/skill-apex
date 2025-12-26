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
let outputAnalyser = null;
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
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        inputAudioContext = new AudioContext({ sampleRate: 16000 });
        outputAudioContext = new AudioContext({ sampleRate: 24000 });
        await inputAudioContext.resume();
        await outputAudioContext.resume();

        const client = await getAIClient();
        if (!client) throw new Error("API Key configuration missing.");

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        analyser = inputAudioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        
        outputAnalyser = outputAudioContext.createAnalyser();
        outputAnalyser.fftSize = 256;
        outputAnalyser.smoothingTimeConstant = 0.8;
        
        inputSource = inputAudioContext.createMediaStreamSource(mediaStream);
        scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        inputSource.connect(analyser);
        inputSource.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);

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
                            updateUI(STATE.PROCESSING, "SYNCING DATA...");
                        }
                    } catch (err) { console.error(err); }
                },
                onclose: () => stopSession(),
                onerror: (err) => updateUI(STATE.ERROR, "LINK SEVERED")
            }
        });

        scriptProcessor.onaudioprocess = (e) => {
            if (!sessionPromise) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = convertFloat32ToInt16(inputData);
            const base64Data = bytesToBase64(new Uint8Array(int16Data.buffer));
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=16000", data: base64Data } });
            }).catch(() => {});
        };
    } catch (e) {
        updateUI(STATE.ERROR, "HARDWARE FAILURE");
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
        if (outputAnalyser) source.connect(outputAnalyser);
        source.connect(outputAudioContext.destination);
        source.start(0);
    } catch (e) { console.error(e); }
}

function stopSession() {
    if (sessionPromise) { sessionPromise.then(s => s.close()).catch(() => {}); sessionPromise = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    if (inputAudioContext) { inputAudioContext.close(); inputAudioContext = null; }
    if (outputAudioContext) { outputAudioContext.close(); outputAudioContext = null; }
    if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
    if (currentState !== STATE.ERROR) updateUI(STATE.IDLE);
}

function updateUI(newState, msg) {
    currentState = newState;
    if (elements.status) {
        if (msg) elements.status.textContent = msg;
        else if (newState === STATE.LISTENING) elements.status.textContent = "LISTENING...";
        else if (newState === STATE.SPEAKING) elements.status.textContent = "TRANSMITTING...";
        else if (newState === STATE.CONNECTING) elements.status.textContent = "ESTABLISHING UPLINK...";
        else if (newState === STATE.PROCESSING) elements.status.textContent = "SYNTHESIZING...";
        else elements.status.textContent = "READY FOR UPLINK";
    }
    
    if (newState === STATE.IDLE || newState === STATE.ERROR) {
        elements.micBtn.classList.remove('active');
        elements.placeholder.style.display = 'block';
    } else {
        elements.micBtn.classList.add('active');
        elements.placeholder.style.display = 'none';
    }
}

// --- HIGH-FIDELITY NEURAL VISUALIZER ---
function initVisualizer() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    let time = 0;

    const resize = () => {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const drawLine = (x1, y1, x2, y2, color, width) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    const draw = () => {
        animationFrameId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let energy = 0;
        if (analyser && (currentState === STATE.LISTENING || currentState === STATE.CONNECTING)) {
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            energy = (data.reduce((a,b)=>a+b,0) / data.length) / 255;
        }
        if (outputAnalyser && currentState === STATE.SPEAKING) {
            const data = new Uint8Array(outputAnalyser.frequencyBinCount);
            outputAnalyser.getByteFrequencyData(data);
            energy = (data.reduce((a,b)=>a+b,0) / data.length) / 255;
        }

        if (currentState === STATE.PROCESSING) energy = 0.2 + Math.sin(time * 5) * 0.1;
        else if (currentState === STATE.IDLE) energy = 0.05 + Math.sin(time * 1) * 0.02;

        time += 0.02 + energy * 0.1;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;

        // Draw Neural Filaments
        const filaments = 16;
        for (let i = 0; i < filaments; i++) {
            const angle = (i / filaments) * Math.PI * 2 + time * 0.3;
            const dist = baseRadius * (1.2 + energy * 3);
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            
            const color = currentState === STATE.SPEAKING ? `rgba(244, 63, 94, ${0.15 + energy})` : `rgba(34, 211, 238, ${0.15 + energy})`;
            drawLine(cx, cy, x, y, color, 1.5 + energy * 8);
            
            // End points
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(x, y, 3 + energy * 15, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Core Swell
        const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * (1.5 + energy));
        const c1 = currentState === STATE.SPEAKING ? 'rgba(244, 63, 94, 0.4)' : 'rgba(34, 211, 238, 0.4)';
        coreGradient.addColorStop(0, c1);
        coreGradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.beginPath();
        ctx.fillStyle = coreGradient;
        ctx.arc(cx, cy, baseRadius * (2.5 + energy * 2), 0, Math.PI * 2);
        ctx.fill();
        
        // Dynamic Ring
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 20]);
        ctx.arc(cx, cy, baseRadius * (1.2 + energy * 0.8), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
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

    if (elements.headerControls) {
        elements.headerControls.innerHTML = `<button class="btn-disconnect" onclick="window.history.back()">Disconnect</button>`;
    }
    
    if (elements.micBtn) {
        elements.micBtn.onclick = () => {
            if (currentState === STATE.IDLE || currentState === STATE.ERROR) startSession();
            else stopSession();
        };
    }

    initVisualizer();
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopSession();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}