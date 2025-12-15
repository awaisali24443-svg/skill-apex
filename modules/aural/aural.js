
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

// --- TOOL DEFINITIONS ---
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_quiz_question",
        description: "Fetch a technical interview question or quiz problem to test the user's knowledge.",
        parameters: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING", description: "The specific topic to quiz on (e.g., 'React Hooks', 'Python Lists')." }
          },
          required: ["topic"]
        }
      }
    ]
  }
];

let currentState = STATE.IDLE;
let sessionPromise = null;
let sessionStartTime = 0;

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

// Chat UI Manager
let chatManager = null;

// --- CHAT MANAGER ---
class ChatManager {
    constructor(container) {
        this.container = container;
        this.messages = []; // Full history for saving
        
        // Active bubble references
        this.currentUserBubbleContent = null;
        this.currentAiBubbleContent = null;
        
        // Text buffers for streaming
        this.userTextBuffer = "";
        this.aiTextBuffer = "";
    }

    createBubble(type) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${type}-bubble`;
        
        // Label
        const label = document.createElement('span');
        label.className = 'bubble-label';
        label.textContent = type === 'user' ? 'YOU' : 'APEX CORE';
        
        // Content
        const content = document.createElement('div');
        content.className = 'bubble-content';
        
        bubble.appendChild(label);
        bubble.appendChild(content);
        
        this.container.appendChild(bubble);
        this.scrollToBottom();
        
        return content;
    }

    updateUserText(text, isFinal) {
        if (!text) return;

        if (!this.currentUserBubbleContent) {
            this.currentUserBubbleContent = this.createBubble('user');
            this.userTextBuffer = "";
        }
        
        this.userTextBuffer += text;
        this.currentUserBubbleContent.textContent = this.userTextBuffer;
        
        if (isFinal) {
            this.commitMessage('user', this.userTextBuffer);
            this.currentUserBubbleContent = null; 
            this.userTextBuffer = "";
        }
        this.scrollToBottom();
    }

    updateAiText(text, isFinal) {
        if (!text) return;

        if (!this.currentAiBubbleContent) {
            this.currentAiBubbleContent = this.createBubble('ai');
            this.aiTextBuffer = "";
        }

        this.aiTextBuffer += text;
        this.currentAiBubbleContent.textContent = this.aiTextBuffer;

        if (isFinal) {
            this.commitMessage('model', this.aiTextBuffer);
            this.currentAiBubbleContent = null;
            this.aiTextBuffer = "";
        }
        this.scrollToBottom();
    }
    
    finalizeTurn() {
        // Force commit any pending buffers
        if (this.currentUserBubbleContent && this.userTextBuffer) {
            this.commitMessage('user', this.userTextBuffer);
            this.currentUserBubbleContent = null;
            this.userTextBuffer = "";
        }
        if (this.currentAiBubbleContent && this.aiTextBuffer) {
            this.commitMessage('model', this.aiTextBuffer);
            this.currentAiBubbleContent = null;
            this.aiTextBuffer = "";
        }
    }

    commitMessage(sender, text) {
        if (!text.trim()) return;
        this.messages.push({ sender, text: text.trim(), timestamp: Date.now() });
    }
    
    addSystemLog(text) {
        const log = document.createElement('div');
        log.className = 'system-log-entry';
        log.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#activity"/></svg> ${text}`;
        this.container.appendChild(log);
        this.scrollToBottom();
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.container.scrollTop = this.container.scrollHeight;
        });
    }
    
    getTranscript() {
        // finalize anything pending before returning
        this.finalizeTurn();
        return [...this.messages];
    }
}

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

function createPcmBlob(float32Data) {
  const l = float32Data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: bytesToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function decodeAudioData(base64Str, ctx) {
    const bytes = base64ToBytes(base64Str);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }
    
    const buffer = ctx.createBuffer(1, float32.length, 24000); 
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

        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        const average = sum / (dataArray.length || 1);
        
        let amplitude = 0;
        if (currentState === STATE.LISTENING || currentState === STATE.SPEAKING) {
            amplitude = average / 5; 
        } else {
            amplitude = 2 + Math.sin(Date.now() / 500);
        }

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
    ctx.stroke();
}

// --- MAIN LOGIC ---

function updateUI(newState, msg = '') {
    currentState = newState;
    const statusText = elements.status;
    const micBtn = elements.micBtn;

    switch (newState) {
        case STATE.CONNECTING:
            statusText.textContent = "ESTABLISHING UPLINK...";
            statusText.style.color = "#FFC107";
            micBtn.classList.add('active'); 
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
        default: 
            statusText.textContent = "SYSTEM STANDBY";
            statusText.style.color = "#9CA3AF";
            micBtn.classList.remove('active');
            break;
    }
}

async function executeLocalTool(toolCall) {
    if (toolCall.name === 'get_quiz_question') {
        const topic = toolCall.args.topic || "General Technology";
        showToast(`AI is generating a quiz for: ${topic}`, "info");
        if(chatManager) chatManager.addSystemLog(`Executing Tool: Quiz Generation [${topic}]`);

        try {
            // Fetch from API
            const data = await apiService.generateLevelQuestions({ 
                topic: topic, 
                level: 1, 
                totalLevels: 10 
            });
            
            if (data && data.questions && data.questions.length > 0) {
                const q = data.questions[0];
                return {
                    result: `Here is a question for the user: "${q.question}" Options: ${q.options.join(', ')}. The correct answer is ${q.options[q.correctAnswerIndex]}. Ask the user to answer.`
                };
            }
        } catch (e) {
            console.error("Tool execution failed", e);
        }
        
        return { result: "Could not generate a specific question right now. Just ask the user a general trivia question about " + topic };
    }
    return { result: "Tool not found." };
}

async function startSession() {
    updateUI(STATE.CONNECTING);
    chatManager = new ChatManager(elements.log);
    
    // 1. Initialize Audio Contexts immediately (User Interaction Context)
    try {
        inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        // Force resume in case browser suspended it
        await inputAudioContext.resume();
        await outputAudioContext.resume();
    } catch(e) {
        updateUI(STATE.ERROR, "Audio Init Failed");
        return;
    }

    // 2. Fetch Client
    const client = await getAIClient();
    if (!client) {
        updateUI(STATE.ERROR, "AI Authentication Failed");
        return;
    }

    // --- CONTEXT INJECTION ---
    const { navigationContext } = stateService.getState();
    const contextTopic = navigationContext?.topic || null;
    const contextLevel = navigationContext?.level || 1;
    
    if (contextTopic) {
        elements.contextBadge.style.display = 'flex';
        elements.contextText.textContent = contextTopic;
    } else {
        elements.contextBadge.style.display = 'none';
    }

    const sysInstruction = `
    You are ApexCore, an elite AI technical mentor for the Skill Apex platform.
    
    CURRENT USER CONTEXT:
    ${contextTopic ? `Focus Topic: ${contextTopic}` : 'Focus: General Tech'}
    ${contextTopic ? `Current Level: ${contextLevel}` : ''}
    
    GUIDELINES:
    1. **Persona**: Intelligent, witty, and concise. Think "Senior Engineer" meets "Podcast Host".
    2. **Brevity**: Speak efficiently. Max 20 seconds per turn unless explaining deep concepts.
    3. **Tools**: If the user asks for a quiz or test, USE the 'get_quiz_question' tool.
    4. **Teaching**: Use analogies. Connect abstract code to physical objects.
    5. **Interaction**: Don't just lecture. Ask checking questions.
    6. **Topic Guardrails**: You are an Educational AI. STRICTLY REFUSE non-educational topics.
    `;

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        analyser = inputAudioContext.createAnalyser();
        analyser.fftSize = 256;
        
        inputSource = inputAudioContext.createMediaStreamSource(mediaStream);
        scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        inputSource.connect(analyser); 
        inputSource.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);

        sessionStartTime = Date.now();

        sessionPromise = client.live.connect({
            model: MODEL_LIVE,
            config: {
                responseModalities: ['AUDIO'], // We want Audio back
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                systemInstruction: sysInstruction,
                tools: TOOLS,
                // ENABLE TRANSCRIPTIONS - Essential for Chat Bubbles
                inputAudioTranscription: { model: MODEL_LIVE }, 
                outputAudioTranscription: { model: MODEL_LIVE }
            },
            callbacks: {
                onopen: () => {
                    console.log("Gemini Live Session Opened");
                    updateUI(STATE.LISTENING);
                    nextStartTime = outputAudioContext.currentTime;
                    elements.placeholder.style.display = 'none';
                    if(chatManager) chatManager.addSystemLog('Neural Link Established');
                },
                onmessage: async (msg) => {
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

        scriptProcessor.onaudioprocess = (e) => {
            if (!sessionPromise) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            }).catch(err => {});
        };

    } catch (e) {
        console.error("Start Session Failed:", e);
        updateUI(STATE.ERROR, "Microphone Access Denied");
        stopSession();
    }
}

async function handleServerMessage(message) {
    const { serverContent, toolCall } = message;
    
    // 1. Handle Tool Calls
    if (toolCall) {
        updateUI(STATE.SPEAKING, "PROCESSING DATA...");
        for (const fc of toolCall.functionCalls) {
            const executionResult = await executeLocalTool(fc);
            sessionPromise.then(session => {
                session.sendToolResponse({
                    functionResponses: [{
                        id: fc.id, name: fc.name, response: executionResult
                    }]
                });
            });
        }
        return; 
    }

    // 2. Handle Audio Output
    const modelAudio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (modelAudio) {
        updateUI(STATE.SPEAKING);
        queueAudioOutput(modelAudio);
    }

    // 3. Handle Transcriptions (Chat Bubbles)
    if(chatManager) {
        // User Input Transcription
        if (serverContent?.inputTranscription) {
            const text = serverContent.inputTranscription.text;
            if (text) {
                chatManager.updateUserText(text, false);
            }
        }

        // Model Output Transcription
        if (serverContent?.outputTranscription) {
            const text = serverContent.outputTranscription.text;
            if (text) {
                chatManager.updateAiText(text, false);
            }
        }

        // Turn Complete Events (Finalize Bubbles)
        if (serverContent?.turnComplete) {
            updateUI(STATE.LISTENING);
            // Force finalize both buffers if turn completes
            chatManager.finalizeTurn();
        }
        
        // 4. Handle Interruption
        if (serverContent?.interrupted) {
            console.log("Model Interrupted");
            clearAudioQueue();
            updateUI(STATE.LISTENING);
            chatManager.addSystemLog('Interruption Detected');
            chatManager.finalizeTurn();
        }
    }
}

function queueAudioOutput(base64Audio) {
    if (!outputAudioContext) return;
    try {
        const audioBuffer = decodeAudioData(base64Audio, outputAudioContext);
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        
        const now = outputAudioContext.currentTime;
        nextStartTime = Math.max(nextStartTime, now);
        
        source.start(nextStartTime);
        nextStartTime += audioBuffer.duration;
        
        scheduledSources.add(source);
        source.onended = () => {
            scheduledSources.delete(source);
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

    clearAudioQueue();
    if (outputAudioContext) {
        outputAudioContext.close();
        outputAudioContext = null;
    }

    if (sessionPromise) {
        sessionPromise.then(session => session.close()).catch(() => {});
        sessionPromise = null;
    }

    // Save Transcript to History
    if (chatManager) {
        const transcript = chatManager.getTranscript();
        if (transcript.length > 0) {
            const duration = Math.max(1, Math.floor((Date.now() - sessionStartTime) / 1000));
            // Save to history service
            historyService.addAuralSession({
                duration: duration,
                transcript: transcript,
                xpGained: transcript.length * 5 
            });
            showToast('Session log saved to History.', 'success');
        }
    }

    analyser = null;
    chatManager = null;
    updateUI(STATE.IDLE);
    if(elements.placeholder) elements.placeholder.style.display = 'block';
    if(elements.contextBadge) elements.contextBadge.style.display = 'none';
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
        contextBadge: document.getElementById('aural-context-badge'),
        contextText: document.getElementById('aural-context-text')
    };

    // Clean log
    elements.log.innerHTML = '';
    elements.log.appendChild(elements.placeholder);

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
