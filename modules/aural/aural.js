
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import { getAIClient } from '../../services/apiService.js';
import * as gamificationService from '../../services/gamificationService.js';

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

let currentInputTranscription = "";
let currentOutputTranscription = "";
let startTime = 0;

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

// --- CHAT UI HELPERS ---
function addChatBubble(text, sender) {
    if (!text.trim()) return;
    
    // Clear placeholder if first bubble
    if (elements.placeholder.style.display !== 'none') {
        elements.placeholder.style.display = 'none';
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    bubble.textContent = text;
    elements.chatLog.appendChild(bubble);
    
    // Auto Scroll
    elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
    
    // Limit log size for performance
    if (elements.chatLog.children.length > 10) {
        elements.chatLog.removeChild(elements.chatLog.firstChild);
    }
}

// --- MAIN SESSION LOGIC ---
async function startSession() {
    updateUI(STATE.CONNECTING);
    startTime = Date.now();

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
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        
        outputAnalyser = outputAudioContext.createAnalyser();
        outputAnalyser.fftSize = 512;
        outputAnalyser.smoothingTimeConstant = 0.7;
        
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
                },
                // ENABLE TRANSCRIPTIONS
                inputAudioTranscription: {},
                outputAudioTranscription: {}
            },
            callbacks: {
                onopen: () => {
                    console.log("✅ Neural Link Established");
                    updateUI(STATE.LISTENING);
                },
                onmessage: (msg) => {
                    try {
                        // 1. Audio Processing
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            updateUI(STATE.SPEAKING);
                            playAudioChunk(audioData);
                        }

                        // 2. Transcription Processing
                        if (msg.serverContent?.inputTranscription) {
                            currentInputTranscription += msg.serverContent.inputTranscription.text;
                        }
                        if (msg.serverContent?.outputTranscription) {
                            currentOutputTranscription += msg.serverContent.outputTranscription.text;
                        }

                        if (msg.serverContent?.turnComplete) {
                            // Append bubbles when turn finishes
                            if (currentInputTranscription) {
                                addChatBubble(currentInputTranscription, 'user');
                                currentInputTranscription = "";
                            }
                            if (currentOutputTranscription) {
                                addChatBubble(currentOutputTranscription, 'ai');
                                currentOutputTranscription = "";
                            }
                            updateUI(STATE.LISTENING);
                        }
                    } catch (err) {
                        console.error("Error processing message:", err);
                    }
                },
                onclose: () => stopSession(),
                onerror: (err) => {
                    console.error("Live API Error:", err);
                    updateUI(STATE.ERROR, "Link Severed.");
                }
            }
        });

        scriptProcessor.onaudioprocess = (e) => {
            if (!sessionPromise) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = convertFloat32ToInt16(inputData);
            const base64Data = bytesToBase64(new Uint8Array(int16Data.buffer));
            
            sessionPromise.then(session => {
                session.sendRealtimeInput({
                    media: { mimeType: "audio/pcm;rate=16000", data: base64Data }
                });
            }).catch(() => {});
        };

    } catch (e) {
        console.error("Session failed:", e);
        updateUI(STATE.ERROR, "Mic Access Required.");
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
    
    // Gamification Tracking
    if (startTime > 0) {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        if (durationSeconds > 10) {
            gamificationService.checkQuestProgress({ 
                type: 'aural_session', 
                data: { duration: durationSeconds } 
            });
        }
        startTime = 0;
    }

    if (currentState !== STATE.ERROR) updateUI(STATE.IDLE);
}

function updateUI(newState, msg) {
    currentState = newState;
    if (elements.status) {
        if (msg) elements.status.textContent = msg;
        else if (newState === STATE.LISTENING) elements.status.textContent = "Uplink Stable";
        else if (newState === STATE.SPEAKING) elements.status.textContent = "Receiving Signal";
        else if (newState === STATE.CONNECTING) elements.status.textContent = "Syncing Neural Core";
        else elements.status.textContent = "Ready to Sync";
    }
    
    if (newState === STATE.IDLE || newState === STATE.ERROR) {
        elements.micBtn.classList.remove('active');
        elements.micBtn.innerHTML = `<div class="mic-icon-wrapper"><svg class="icon"><use href="assets/icons/feather-sprite.svg#mic"/></svg></div>`;
    } else {
        elements.micBtn.classList.add('active');
        elements.micBtn.innerHTML = `<div class="mic-icon-wrapper"><svg class="icon"><use href="assets/icons/feather-sprite.svg#x"/></svg></div>`;
    }
}

// --- ORGANIC BLOB VISUALIZER ---
function initVisualizer() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    let time = 0;

    const resize = () => { 
        canvas.width = window.innerWidth; 
        canvas.height = window.innerHeight; 
    };
    window.addEventListener('resize', resize);
    resize();

    const drawBlob = (x, y, radius, color) => {
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    };

    const draw = () => {
        animationFrameId = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let inputEnergy = 0;
        let outputEnergy = 0;
        
        if (analyser && (currentState === STATE.LISTENING || currentState === STATE.CONNECTING)) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            inputEnergy = (dataArray.reduce((a,b)=>a+b,0) / dataArray.length) / 255;
        }

        if (outputAnalyser && currentState === STATE.SPEAKING) {
            const dataArray = new Uint8Array(outputAnalyser.frequencyBinCount);
            outputAnalyser.getByteFrequencyData(dataArray);
            outputEnergy = (dataArray.reduce((a,b)=>a+b,0) / dataArray.length) / 255;
        }

        const totalEnergy = inputEnergy + (outputEnergy * 1.5); 
        time += 0.05 + (totalEnergy * 0.1); 

        const cx = canvas.width / 2;
        const cy = canvas.height * 0.7;
        const baseSize = Math.min(canvas.width, canvas.height) * (0.4 + (totalEnergy * 0.3));

        let color1 = 'rgba(37, 99, 235, 0.4)'; // Blue
        let color2 = 'rgba(124, 58, 237, 0.4)'; // Purple
        
        if (currentState === STATE.SPEAKING) {
            color1 = 'rgba(219, 39, 119, 0.5)'; // Pink
            color2 = 'rgba(79, 70, 229, 0.5)'; // Indigo
        }

        // Blob 1: Atmospheric Pulse
        const r1 = baseSize * (1 + Math.sin(time * 0.3) * 0.1);
        drawBlob(cx + Math.cos(time * 0.2) * 50, cy + Math.sin(time * 0.1) * 30, r1, color1);

        // Blob 2: Core Reactivity
        const r2 = baseSize * 0.8 * (1 + Math.cos(time * 0.4) * 0.15);
        drawBlob(cx - Math.sin(time * 0.3) * 40, cy + Math.cos(time * 0.2) * 20, r2, color2);
        
        // Blob 3: Shadow Anchor
        drawBlob(cx, cy, baseSize * 0.5, 'rgba(15, 23, 42, 0.05)');
    };
    draw();
}

export function init() {
    elements = {
        canvas: document.getElementById('aural-visualizer'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        placeholder: document.getElementById('aural-placeholder'),
        chatLog: document.getElementById('aural-chat-log'),
        headerControls: document.getElementById('aural-header-controls')
    };

    elements.headerControls.innerHTML = `<button class="btn" onclick="window.history.back()">ABORT LINK</button>`;

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
