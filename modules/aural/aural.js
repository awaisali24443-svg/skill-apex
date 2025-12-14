
import { GoogleGenAI } from "@google/genai";
import * as stateService from '../../services/stateService.js';
import * as historyService from '../../services/historyService.js';
import { showToast } from '../../services/toastService.js';
import { getAIClient } from '../../services/apiService.js';

const STATE = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

let currentState = STATE.IDLE;
let session = null;
let audioContext = null;
let source = null;
let analyser = null;
let scriptProcessor = null;
let stream = null;
let elements = {};
let sessionStartTime = 0;
let animationFrameId = null;
let outputContext = null; 

// --- WAVEFORM VISUALIZER (Siri Style) ---
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

        let dataArray = new Uint8Array(5); // Default quiet
        if (analyser) {
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
        }

        // Calculate volume
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        const average = sum / (dataArray.length || 1);
        
        // Dynamic Amplitude based on volume
        let amplitude = 0;
        if (currentState === STATE.LISTENING || currentState === STATE.SPEAKING) {
            amplitude = average / 5; // Scale down 0-255
        } else {
            amplitude = 2 + Math.sin(Date.now() / 500); // Heartbeat
        }

        // Draw Waves
        drawWave(ctx, canvas, amplitude, 1, '#0052CC', 0.002); // Primary Blue
        drawWave(ctx, canvas, amplitude * 0.8, -1, '#D946EF', 0.003); // Fuchsia
        drawWave(ctx, canvas, amplitude * 0.5, 1, '#7C3AED', 0.001); // Violet
    };
    draw();
}

function drawWave(ctx, canvas, amplitude, direction, color, frequency) {
    const centerY = canvas.height / 2;
    const time = Date.now() * frequency;
    
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    
    for (let x = 0; x < canvas.width; x += 5) {
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

// --- AUDIO HANDLING ---
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
    
    if (!outputContext) {
        outputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    
    // Resume context if suspended (browser policy)
    if (outputContext.state === 'suspended') await outputContext.resume();

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
    bufferSource.connect(outputContext.destination);
    bufferSource.start(0);
}

function updateUI(newState, msg = '') {
    currentState = newState;
    const statusText = elements.status;
    const micBtn = elements.micBtn;

    switch (newState) {
        case STATE.LISTENING:
            statusText.textContent = "LISTENING // FREQUENCY OPEN";
            statusText.style.color = "#0052CC";
            micBtn.classList.add('active');
            break;
        case STATE.SPEAKING:
            statusText.textContent = "TRANSMITTING DATA...";
            statusText.style.color = "#D946EF";
            micBtn.classList.add('active'); 
            break;
        case STATE.ERROR:
            statusText.textContent = "CONNECTION SEVERED";
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
    const client = getAIClient();
    if (!client) {
        updateUI(STATE.ERROR, "AUTH KEY MISSING");
        return;
    }

    try {
        // Initialize Contexts EARLY
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        if (audioContext.state === 'suspended') await audioContext.resume();
        
        analyser = audioContext.createAnalyser(); 
        analyser.fftSize = 512;
        
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        updateUI(STATE.LISTENING);
        sessionStartTime = Date.now();
        elements.log.innerHTML = ''; 

        const sessionPromise = client.live.connect({
            model: MODEL_LIVE,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                // Short, punchy instruction to reduce model think time
                systemInstruction: `You are JARVIS. Answers must be under 1 sentence. Be extremely fast.`
            },
            callbacks: {
                onopen: () => {
                    console.log("Uplink Established");
                    source = audioContext.createMediaStreamSource(stream);
                    source.connect(analyser); 
                    
                    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(sess => sess.sendRealtimeInput({ media: pcmBlob }));
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination);
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
                onerror: (e) => updateUI(STATE.ERROR, "Signal Lost")
            }
        });
        
        session = await sessionPromise;

    } catch (e) {
        console.error(e);
        updateUI(STATE.ERROR, "Access Denied (Microphone)");
    }
}

function stopSession() {
    if (source) { source.disconnect(); source = null; }
    if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    session = null;
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

    // Header Back
    const { navigationContext } = stateService.getState();
    elements.headerControls.innerHTML = '';
    const backBtn = document.createElement('a');
    backBtn.href = navigationContext.auralContext?.from ? `#/${navigationContext.auralContext.from}` : '#/';
    backBtn.className = 'btn';
    backBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#arrow-left"/></svg> DISCONNECT`;
    backBtn.onclick = () => stopSession();
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
