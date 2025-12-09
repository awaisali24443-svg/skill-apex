
import * as stateService from '../../services/stateService.js';
import * as historyService from '../../services/historyService.js';
import * as gamificationService from '../../services/gamificationService.js'; // Added import
import { showToast } from '../../services/toastService.js';

// ... variables and helper functions ...

// ... startConversation ...

function stopConversation() {
    if (currentState === STATE.IDLE) return;
    clearTimeout(connectionTimeout);
    finalizeLiveTranscription();

    if (transcriptLog.length > 0) {
        const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
        const xpGained = Math.min(50, Math.floor(durationSeconds / 2)); 
        historyService.addAuralSession({ transcript: transcriptLog, duration: durationSeconds, xpGained });
        
        // NEW: Track Aural Time (Minutes)
        const minutes = Math.ceil(durationSeconds / 60);
        gamificationService.incrementStat('auralMinutes', minutes);

        if (xpGained > 0) showToast(`Session saved! +${xpGained} XP`, 'success');
    }

    if (socket) { 
        if (socket.readyState === WebSocket.OPEN) socket.close(); 
        socket = null; 
    }
    if (audioWorkletNode) { audioWorkletNode.disconnect(); audioWorkletNode = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); mediaStream = null; }
    if (outputAudioContext) { sources.forEach(s => s.stop()); sources.clear(); }
    
    if (elements.log) elements.log.innerHTML = '';
    if (elements.placeholder) elements.placeholder.style.display = 'flex';
    updateUI(STATE.IDLE);
}

// ... rest of code ...
