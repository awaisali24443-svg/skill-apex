
import * as firebaseService from '../../services/firebaseService.js';

let listContainer;
let template;

// MOCK DATA FOR DEMO PURPOSES
const MOCK_LEADERS = [
    { username: "NexusPrime", level: 42, xp: 85400 },
    { username: "CyberSamurai", level: 38, xp: 72100 },
    { username: "LogicGate", level: 35, xp: 68900 },
    { username: "BitWitch", level: 31, xp: 54200 },
    { username: "CodeRunner", level: 29, xp: 49800 },
    { username: "PixelArtist", level: 25, xp: 41000 },
    { username: "NetWalker", level: 22, xp: 36500 },
    { username: "DataMiner", level: 19, xp: 28900 },
];

async function loadLeaderboard() {
    listContainer.innerHTML = '<div class="loading-spinner-container"><div class="spinner"></div></div>';
    
    // Attempt to get real data, but fall back to mock data if empty (Crucial for Demo)
    let data = await firebaseService.getLeaderboard();
    const currentUserId = firebaseService.getUserId();
    
    if (data.length < 5) {
        // Merge real data with mock data for a full board
        data = [...data, ...MOCK_LEADERS].sort((a, b) => b.xp - a.xp).slice(0, 10);
    }
    
    listContainer.innerHTML = '';
    
    data.forEach((user, index) => {
        const node = template.content.cloneNode(true);
        const item = node.querySelector('.leaderboard-item');
        const rank = index + 1;
        
        item.classList.add(`rank-${rank}`);
        // Highlight if it matches real user ID
        if (user.id && user.id === currentUserId) item.classList.add('current-user');
        
        item.querySelector('.rank-num').textContent = rank;
        item.querySelector('.user-name').textContent = user.username;
        item.querySelector('.level-num').textContent = user.level;
        item.querySelector('.xp-num').textContent = user.xp.toLocaleString();
        
        // Stagger animation
        item.style.animation = `fade-in 0.3s ease-out ${index * 0.05}s forwards`;
        item.style.opacity = '0';
        
        listContainer.appendChild(node);
    });
}

export function init() {
    listContainer = document.getElementById('leaderboard-list');
    template = document.getElementById('leaderboard-item-template');
    
    const guestMsg = document.getElementById('guest-leaderboard-msg');
    if (firebaseService.isGuest() && guestMsg) {
        guestMsg.style.display = 'block';
    }

    loadLeaderboard();
}

export function destroy() {
    // Cleanup if needed
}
