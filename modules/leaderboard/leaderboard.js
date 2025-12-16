
import * as firebaseService from '../../services/firebaseService.js';
import * as gamificationService from '../../services/gamificationService.js';

let listContainer;
let template;

async function loadLeaderboard() {
    if (!listContainer) return;
    
    // Show spinner while loading
    listContainer.innerHTML = '<div class="loading-spinner-container"><div class="spinner"></div></div>';
    
    try {
        // 1. Fetch Data (Mocks or Real)
        let data = await firebaseService.getLeaderboard() || [];
        
        // 2. Get Local User Stats
        const currentUserId = firebaseService.getUserId() || 'guest';
        const localStats = gamificationService.getStats();
        
        let displayName = firebaseService.getUserName();
        // Fallback if name is empty
        if (!displayName || displayName === 'Agent') {
            const email = firebaseService.getUserEmail();
            displayName = (email && email !== 'Guest Agent') ? email.split('@')[0] : 'Admin'; 
        }

        // 3. Prepare Current User Entry
        const currentUserEntry = {
            id: currentUserId,
            username: displayName,
            level: localStats.level || 1,
            xp: localStats.xp || 0,
            isCurrentUser: true
        };

        // 4. Merge Logic: Remove duplicates of current user
        data = data.filter(u => u.id !== currentUserId && u.username !== displayName);
        data.push(currentUserEntry);

        // 5. Sort by XP Descending
        data.sort((a, b) => b.xp - a.xp);

        // 6. Render
        listContainer.innerHTML = '';
        
        if (data.length === 0) {
            listContainer.innerHTML = '<div style="padding:2rem; text-align:center;">No active agents found.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        data.forEach((user, index) => {
            const node = template.content.cloneNode(true);
            const item = node.querySelector('.leaderboard-item');
            const rank = index + 1;
            
            item.classList.add(`rank-${rank}`);
            if (user.isCurrentUser) item.classList.add('current-user');
            
            // Add animation class instead of inline style for reliability
            item.classList.add('animate-entry');
            item.style.animationDelay = `${index * 0.05}s`;
            
            item.querySelector('.rank-num').textContent = rank;
            item.querySelector('.user-name').textContent = user.username + (user.isCurrentUser ? ' (You)' : '');
            item.querySelector('.level-num').textContent = user.level;
            item.querySelector('.xp-num').textContent = user.xp.toLocaleString();
            
            fragment.appendChild(node);
        });

        listContainer.appendChild(fragment);

    } catch (error) {
        console.error("Failed to load leaderboard:", error);
        listContainer.innerHTML = '<div style="padding:2rem; text-align:center; color: var(--color-error);">Connection error. Unable to retrieve rankings.</div>';
    }
}

export function init() {
    listContainer = document.getElementById('leaderboard-list');
    template = document.getElementById('leaderboard-item-template');
    
    // Ensure container exists before trying to load
    if (listContainer && template) {
        loadLeaderboard();
    }
    
    const guestMsg = document.getElementById('guest-leaderboard-msg');
    if (firebaseService.isGuest() && guestMsg) {
        guestMsg.style.display = 'block';
    }
}

export function destroy() {
    // Cleanup if needed
}
