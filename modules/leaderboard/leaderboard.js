
import * as firebaseService from '../../services/firebaseService.js';
import * as gamificationService from '../../services/gamificationService.js';

let listContainer;
let template;

async function loadLeaderboard() {
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="loading-spinner-container"><div class="spinner"></div></div>';
    
    try {
        // 1. Fetch Global/Mock Data
        // Ensure we get an array back
        let data = await firebaseService.getLeaderboard() || [];
        
        // 2. Get Local User Stats (Ensure current user is always visible)
        const currentUserId = firebaseService.getUserId() || 'guest';
        const localStats = gamificationService.getStats();
        
        let displayName = firebaseService.getUserName();
        if (!displayName || displayName === 'Agent') {
            const email = firebaseService.getUserEmail();
            // Fallback for guest mode naming
            displayName = (email && email !== 'Guest Agent') ? email.split('@')[0] : 'Admin'; 
        }

        // Create the entry for the current user
        const currentUserEntry = {
            id: currentUserId,
            username: displayName,
            level: localStats.level || 1,
            xp: localStats.xp || 0,
            isCurrentUser: true
        };

        // 3. Merge Logic: 
        // Remove stale entry of current user if exists (by ID) AND remove any entry with the exact same username to prevent "Double Admin"
        data = data.filter(u => u.id !== currentUserId && u.username !== displayName);
        
        // Add current user fresh from local stats
        data.push(currentUserEntry);

        // 4. Sort by XP Descending
        data.sort((a, b) => b.xp - a.xp);

        // 5. Render
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
            
            if (user.isCurrentUser) {
                item.classList.add('current-user');
                // Append (You) if not already present
                if (!user.username.toLowerCase().includes('(you)')) {
                    user.username += ' (You)';
                }
            }
            
            item.querySelector('.rank-num').textContent = rank;
            item.querySelector('.user-name').textContent = user.username;
            item.querySelector('.level-num').textContent = user.level;
            item.querySelector('.xp-num').textContent = user.xp.toLocaleString();
            
            // Stagger animation
            item.style.animation = `fade-in 0.3s ease-out ${index * 0.05}s forwards`;
            item.style.opacity = '0';
            
            listContainer.appendChild(node);
        });
    } catch (error) {
        console.error("Failed to load leaderboard:", error);
        listContainer.innerHTML = '<div style="padding:2rem; text-align:center; color: var(--color-error);">Connection error. Unable to retrieve rankings.</div>';
    }
}

export function init() {
    listContainer = document.getElementById('leaderboard-list');
    template = document.getElementById('leaderboard-item-template');
    
    const guestMsg = document.getElementById('guest-leaderboard-msg');
    
    // Update Guest Message to be more informative rather than discouraging
    if (firebaseService.isGuest() && guestMsg) {
        guestMsg.style.display = 'block';
        guestMsg.innerHTML = `<p>You are viewing a local simulation. <a href="#/settings">Link Account</a> to compete globally.</p>`;
    }

    loadLeaderboard();
}

export function destroy() {
    // Cleanup if needed
}
