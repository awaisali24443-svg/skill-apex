
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';

let elements = {};
let isLoginMode = true;

// --- DEMO SCENARIOS (ROBOTICS & IT EXPO EDITION) ---
// 1. Python for Robotics: Level 1 (Entry)
// 2. Computer Vision: Level 5 (Visuals)
// 3. Autonomous Navigation: Level 30 (Advanced)
// 4. Swarm Intelligence: Level 50 (Boss Battle)

const DEMO_SCENARIOS = [
    {
        topic: "Python for Robotics",
        level: 1,
        totalLevels: 50,
        style: "topic-programming",
        desc: "Master the language of hardware control.",
        lesson: "### **MISSION BRIEFING: HARDWARE INTERFACE**\n\n**STATUS:** Connected to Raspberry Pi Controller.\n\n*   **GPIO Pins:** General Purpose Input/Output. The nervous system connecting code to motors.\n*   **PWM (Pulse Width Modulation):** Controlling motor speed by pulsing power on and off rapidly.\n*   **Libraries:** Using `RPi.GPIO` to simplify hardware commands.\n\nInitialize motor control sequence.",
        questions: [
            { question: "You need to slow down a DC motor using code. Which technique do you use?", options: ["Digital Write HIGH", "PWM (Pulse Width Modulation)", "Analog Read", "Voltage Divider"], correctAnswerIndex: 1, explanation: "PWM simulates lower voltage by toggling the signal fast, effectively controlling speed." },
            { question: "Which Python library is standard for controlling Raspberry Pi pins?", options: ["pandas", "RPi.GPIO", "numpy", "requests"], correctAnswerIndex: 1, explanation: "RPi.GPIO provides the interface to control the physical pins on the board." },
            { question: "A sensor returns a '1' or '0'. What type of signal is this?", options: ["Analog", "Digital", "Quantum", "Spectral"], correctAnswerIndex: 1, explanation: "Digital signals have only two states: High (1) or Low (0)." }
        ]
    },
    {
        topic: "Computer Vision Systems",
        level: 5,
        totalLevels: 80,
        style: "topic-arts",
        desc: "Teach machines to see and interpret the world.",
        lesson: "### **MISSION BRIEFING: OBJECT TRACKING**\n\n**STATUS:** Camera Feed Active. Processing Frames.\n\n*   **OpenCV:** The open-source library for real-time computer vision.\n*   **RGB vs Grayscale:** Converting images to B&W (Grayscale) drastically speeds up processing.\n*   **Edge Detection:** Finding boundaries of objects by looking for sharp changes in brightness.\n\nLocate target in video stream.",
        questions: [
            { question: "Why do we often convert RGB images to Grayscale for processing?", options: ["It looks artistic", "To reduce computational load", "Cameras only see B&W", "To increase file size"], correctAnswerIndex: 1, explanation: "Grayscale images have 1 channel vs 3 (RGB), making math operations 3x faster." },
            { question: "Which algorithm is commonly used for detecting edges in an image?", options: ["Canny Edge Detector", "Bubble Sort", "Dijkstra", "AES Encryption"], correctAnswerIndex: 0, explanation: "The Canny algorithm is a multi-stage algorithm to detect a wide range of edges in images." },
            { question: "A self-driving car sees a Stop sign. This is an example of:", options: ["Image Generation", "Object Detection/Classification", "Data Compression", "Audio Synthesis"], correctAnswerIndex: 1, explanation: "The system is identifying and classifying a specific object within the visual field." }
        ]
    },
    {
        topic: "Autonomous Navigation",
        level: 30,
        totalLevels: 120,
        style: "topic-space",
        desc: "LIDAR, SLAM, and Pathfinding algorithms.",
        lesson: "### **MISSION BRIEFING: S.L.A.M.**\n\n**STATUS:** Mapping Unknown Environment.\n\n*   **SLAM:** Simultaneous Localization and Mapping. Building a map while figuring out where you are in it.\n*   **LIDAR:** Light Detection and Ranging. Using lasers to measure distances precisely.\n*   **A* (A-Star):** The most popular algorithm for finding the shortest path between nodes.\n\nCalculate trajectory.",
        questions: [
            { question: "What does 'SLAM' stand for in robotics?", options: ["Super Large Autonomous Machine", "Simultaneous Localization and Mapping", "Sensor Light And Motion", "System Logic And Memory"], correctAnswerIndex: 1, explanation: "SLAM is the computational problem of constructing a map of an unknown environment while keeping track of location." },
            { question: "Which sensor spins to create a 360-degree point cloud of the room?", options: ["Gyroscope", "Ultrasonic", "LIDAR", "Thermometer"], correctAnswerIndex: 2, explanation: "LIDAR uses spinning laser arrays to create high-resolution 3D maps." },
            { question: "The robot needs the shortest path through a maze. Which algorithm is best?", options: ["Random Walk", "A* (A-Star) Search", "Brute Force", "Bubble Sort"], correctAnswerIndex: 1, explanation: "A* is widely used for pathfinding because it efficiently finds the optimal path using heuristics." }
        ]
    },
    {
        topic: "Swarm Drone Defense",
        level: 50,
        totalLevels: 50, // Boss Context
        style: "topic-robotics",
        desc: "Coordinating multi-agent systems.",
        lesson: "### **BOSS BATTLE: HIVE MIND CONTROL**\n\n**STATUS:** SYNCHRONIZING 500 DRONES.\n\n*   **Decentralized Control:** No single leader. Each drone follows local rules to create global behavior.\n*   **Collision Avoidance:** The highest priority rule for any swarm member.\n*   **Mesh Network:** Drones talk to neighbors, relaying messages across the swarm.\n\n**OBJECTIVE:** Form defensive shield formation.",
        questions: [
            { question: "In a decentralized swarm, what happens if the 'leader' drone is destroyed?", options: ["The swarm crashes", "The swarm adapts and continues", "The mission resets", "They fly back home"], correctAnswerIndex: 1, explanation: "Decentralized systems have no single point of failure; the swarm reconfigures automatically." },
            { question: "How do drones in a swarm typically communicate data?", options: ["Via a central server only", "Mesh Networking (Peer-to-Peer)", "Morse Code", "They don't communicate"], correctAnswerIndex: 1, explanation: "Mesh networks allow drones to relay data through each other, extending range without a central tower." },
            { question: "What is the primary bio-mimicry inspiration for swarm robotics?", options: ["Solitary Tigers", "Flocks of Birds / Schools of Fish", "Sloths", "Human Cities"], correctAnswerIndex: 1, explanation: "Nature's flocks and schools demonstrate complex behavior from simple local rules (Boids algorithm)." }
        ]
    }
];

function toggleMode() {
    isLoginMode = !isLoginMode;
    elements.title.textContent = isLoginMode ? 'System Login' : 'New Registration';
    elements.subtitle.textContent = isLoginMode ? 'Identify yourself to access the neural network.' : 'Create a new profile to begin your journey.';
    elements.submitBtnText.textContent = isLoginMode ? 'Connect' : 'Register';
    elements.toggleText.textContent = isLoginMode ? 'New user?' : 'Already have an account?';
    elements.toggleBtn.textContent = isLoginMode ? 'Initialize New Account' : 'Login with Existing ID';
    elements.error.style.display = 'none';
    if (elements.forgotBtn) elements.forgotBtn.style.display = isLoginMode ? 'block' : 'none';
}

async function handleSubmit(e) {
    e.preventDefault();
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    if (!email || !password) return;
    
    elements.submitBtn.disabled = true;
    elements.submitBtnText.style.display = 'none';
    elements.submitBtnSpinner.style.display = 'block';
    
    try {
        if (isLoginMode) {
            await firebaseService.login(email, password);
        } else {
            await firebaseService.register(email, password);
            showToast('Account created successfully!', 'success');
        }
    } catch (error) {
        handleError(error);
    }
}

async function handleGoogleLogin() {
    try { await firebaseService.loginWithGoogle(); } catch (error) { handleError(error); }
}

function populateGuestData() {
    console.log("Injecting Expo Demo Data (Robotics Edition)...");

    // 1. PRE-BAKED LEVEL CACHE (Instant Load)
    DEMO_SCENARIOS.forEach(scenario => {
        const cacheKey = `kt-level-cache-${scenario.topic.toLowerCase()}-${scenario.level}`;
        if (!localStorage.getItem(cacheKey)) {
            const cacheEntry = {
                timestamp: Date.now(),
                data: {
                    lesson: scenario.lesson,
                    questions: scenario.questions
                }
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        }
    });

    // 2. ACTIVE JOURNEYS (Matches the new Robotics topics)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS)) {
        const sampleJourneys = DEMO_SCENARIOS.map(scenario => ({
            id: `j_${scenario.topic.substring(0, 3)}_${Math.floor(Math.random()*1000)}`,
            goal: scenario.topic,
            description: scenario.desc,
            currentLevel: scenario.level,
            totalLevels: scenario.totalLevels,
            styleClass: scenario.style, 
            createdAt: new Date().toISOString()
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(sampleJourneys));
    }

    // 3. GAMIFICATION STATS
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION)) {
        const sampleStats = {
            level: 18,
            xp: 18500,
            currentStreak: 14, 
            lastQuizDate: new Date().toISOString(),
            totalQuizzesCompleted: 45, 
            totalPerfectQuizzes: 12, 
            questionsSaved: 8, 
            nightOwlSessions: 5, 
            fastAnswersCount: 22, 
            totalAuralMinutes: 120, 
            uniqueTopicsPlayed: ["Robotics", "AI", "Computer Vision", "Sensors"], 
            
            dailyQuests: { 
                date: new Date().toDateString(), 
                quests: [
                    { id: 'complete_level', text: 'Complete 1 Level', xp: 50, completed: true }, 
                    { id: 'perfect_score', text: 'Get 100% on a Quiz', xp: 100, completed: false },
                    { id: 'use_hint', text: 'Use a Hint', xp: 20, completed: false }
                ] 
            },
            dailyChallenge: { date: new Date().toDateString(), completed: false }
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(sampleStats));
    }

    // 4. RICH HISTORY (Includes Robotics Audio Transcript)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY)) {
        const now = Date.now();
        const day = 86400000;
        const sampleHistory = [
            {
                id: `quiz_h_1`,
                type: 'quiz',
                topic: `Autonomous Navigation - Level 29`,
                score: 3,
                totalQuestions: 3,
                date: new Date(now - (day * 0.1)).toISOString(),
                xpGained: 50
            },
            {
                id: `quiz_h_2`,
                type: 'quiz',
                topic: `Python for Robotics - Level 4`,
                score: 2,
                totalQuestions: 3,
                date: new Date(now - (day * 0.5)).toISOString(),
                xpGained: 20
            },
            {
                id: `aural_h_1`,
                type: 'aural',
                topic: 'Robotics Theory Session',
                date: new Date(now - (day * 2)).toISOString(),
                duration: 145, 
                xpGained: 120,
                transcript: [
                    { sender: 'user', text: 'Explain Inverse Kinematics for a 6-axis arm.' },
                    { sender: 'model', text: 'Inverse Kinematics calculates the joint angles required to position the end-effector at a specific point in 3D space.' },
                    { sender: 'user', text: 'Why is it harder than Forward Kinematics?' },
                    { sender: 'model', text: 'Because there can be multiple valid joint configurations (solutions) for the same end position, creating a complex math problem.' }
                ]
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(sampleHistory));
    }

    // 5. LIBRARY CONTENT (Robotics focused)
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY)) {
        const sampleLibrary = [
            {
                id: "q_lib_1",
                question: "What is the role of a PID Controller in maintaining robot balance?",
                options: ["Power Management", "Error Correction Loop", "Image Processing", "Data Storage"],
                correctAnswerIndex: 1,
                explanation: "PID (Proportional-Integral-Derivative) continuously calculates error values to apply accurate corrections to motors.",
                srs: { interval: 1, repetitions: 1, easeFactor: 2.5, nextReviewDate: Date.now() - 10000, lastReviewed: Date.now() - 86400000 }
            },
            {
                id: "q_lib_2",
                question: "Which sensor uses the Doppler effect?",
                options: ["Camera", "LIDAR", "Ultrasonic/Radar", "Gyroscope"],
                correctAnswerIndex: 2,
                explanation: "Radar and Ultrasonic sensors can measure speed and distance using frequency shifts (Doppler Effect).",
                srs: { interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewDate: Date.now(), lastReviewed: null }
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(sampleLibrary));
    }
}

async function handleGuestLogin() {
    try {
        populateGuestData(); 
        await firebaseService.loginAsGuest();
    } catch (error) {
        handleError(error);
    }
}

function handleError(error) {
    console.error(error);
    elements.error.textContent = error.message;
    elements.error.style.display = 'block';
    elements.submitBtn.disabled = false;
    elements.submitBtnText.style.display = 'block';
    elements.submitBtnSpinner.style.display = 'none';
}

export function init() {
    const container = document.getElementById('auth-container');
    fetch('./modules/auth/auth.html')
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            if (!document.querySelector('link[href="./modules/auth/auth.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = './modules/auth/auth.css';
                document.head.appendChild(link);
            }
            
            elements = {
                form: document.getElementById('auth-form'),
                emailInput: document.getElementById('auth-email'),
                passwordInput: document.getElementById('auth-password'),
                submitBtn: document.getElementById('auth-submit-btn'),
                submitBtnText: document.querySelector('#auth-submit-btn .btn-text'),
                submitBtnSpinner: document.querySelector('#auth-submit-btn .spinner'),
                toggleBtn: document.getElementById('auth-toggle-btn'),
                googleBtn: document.getElementById('google-login-btn'),
                guestBtn: document.getElementById('guest-login-btn'),
                forgotBtn: document.getElementById('forgot-password-btn'),
                title: document.getElementById('auth-title'),
                subtitle: document.getElementById('auth-subtitle'),
                toggleText: document.getElementById('auth-toggle-text'),
                error: document.getElementById('auth-error')
            };
            
            if(elements.form) elements.form.addEventListener('submit', handleSubmit);
            if(elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleMode);
            if(elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleLogin);
            if(elements.guestBtn) elements.guestBtn.addEventListener('click', handleGuestLogin);
        });
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}
