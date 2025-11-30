
import * as firebaseService from '../../services/firebaseService.js';

let listContainer;
let template;

async function loadLeaderboard() {
    listContainer.innerHTML = '<div class="loading-spinner-container"><div class="spinner"></div></div>';
    
    const data = await firebaseService.getLeaderboard();
    const currentUserId = firebaseService.getUserId();
    
    listContainer.innerHTML = '';
    
    if (data.length === 0) {
        listContainer.innerHTML = '<div style="padding:2rem; text-align:center;">No active agents found.</div>';
        return;
    }

    data.forEach((user, index) => {
        const node = template.content.cloneNode(true);
        const item = node.querySelector('.leaderboard-item');
        const rank = index + 1;
        
        item.classList.add(`rank-${rank}`);
        if (user.id === currentUserId) item.classList.add('current-user');
        
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
