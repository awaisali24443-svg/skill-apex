import { categoryData } from './topicService.js';
import { getProgress } from './progressService.js';
import { NUM_QUESTIONS, MAX_LEVEL } from '../constants.js';
import { startQuizFlow } from './navigationService.js';

export class StellarMap {
    #canvas;
    #renderer;
    #scene;
    #camera;
    #raycaster;
    #mouse;
    #clock;
    #objects = { stars: [], constellations: [], constellationGroup: null };
    #intersected = null;
    #userLevels = {};

    // Animation state
    #isAnimating = false;
    #cameraTargetPosition = new THREE.Vector3();
    #cameraLookAtTarget = new THREE.Vector3();
    #animationStartTime = 0;
    #animationDuration = 1.5; // in seconds
    #animationStartPosition = new THREE.Vector3();
    #animationStartLookAt = new THREE.Vector3();
    #animationEndObject = null;
    #animationFrameId;

    // UI Elements
    #infoPanel;
    #loadingOverlay;

    constructor(canvas) {
        this.#canvas = canvas;
        this.#raycaster = new THREE.Raycaster();
        this.#mouse = new THREE.Vector2();
        this.#clock = new THREE.Clock();
        this.#infoPanel = document.getElementById('stellar-map-info-panel');
        this.#loadingOverlay = document.getElementById('stellar-map-loading');
    }

    async init() {
        try {
            // Fetch user progress first
            const progress = await getProgress();
            this.#userLevels = progress?.levels || {};

            // Scene and Camera
            this.#scene = new THREE.Scene();
            this.#camera = new THREE.PerspectiveCamera(60, this.#canvas.clientWidth / this.#canvas.clientHeight, 0.1, 1000);
            this.#camera.position.z = 25;

            // Renderer
            this.#renderer = new THREE.WebGLRenderer({ canvas: this.#canvas, antialias: true, alpha: true });
            this.#renderer.setSize(this.#canvas.clientWidth, this.#canvas.clientHeight);
            this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            // Lights
            this.#scene.add(new THREE.AmbientLight(0xffffff, 0.2));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
            dirLight.position.set(5, 5, 5);
            this.#scene.add(dirLight);

            this.#createBackground();
            this.#createConstellations();

            // Event Listeners
            window.addEventListener('resize', this.#onResize);
            this.#canvas.addEventListener('mousemove', this.#onMouseMove);
            this.#canvas.addEventListener('click', this.#onClick);

            this.#animate();
            
            // Hide overlay on successful initialization
            if (this.#loadingOverlay) {
                this.#loadingOverlay.classList.add('hidden');
            }
        } catch (error) {
            console.error("StellarMap initialization failed:", error);
            if (this.#loadingOverlay) {
                this.#loadingOverlay.innerHTML = `<p style="color:var(--color-danger); text-align:center;">3D map failed to load.<br>The dashboard is still available.</p>`;
            }
        }
    }

    #createBackground() {
        const vertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = THREE.MathUtils.randFloatSpread(200);
            const y = THREE.MathUtils.randFloatSpread(200);
            const z = THREE.MathUtils.randFloatSpread(200);
            vertices.push(x, y, z);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.1 });
        const points = new THREE.Points(geometry, material);
        this.#scene.add(points);
    }

    #createConstellations() {
        const starTexture = new THREE.TextureLoader().load('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==');
        const starMaterial = new THREE.SpriteMaterial({ map: starTexture, color: 0xffffff, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        
        const constellationGroup = new THREE.Group();
        this.#scene.add(constellationGroup);
        this.#objects.constellationGroup = constellationGroup;

        for (const catKey in categoryData) {
            const category = categoryData[catKey];
            const categoryGroup = new THREE.Group();
            categoryGroup.position.set(category.pos.x, category.pos.y, category.pos.z);
            constellationGroup.add(categoryGroup);

            const points = [];
            category.topics.forEach(topic => {
                const sprite = new THREE.Sprite(starMaterial.clone());
                sprite.position.set(topic.pos.x, topic.pos.y, topic.pos.z);
                const level = this.#userLevels[topic.name] || 1;
                const scale = 0.5 + (level / MAX_LEVEL) * 1.5;
                sprite.scale.set(scale, scale, scale);
                sprite.userData = { ...topic, level: level, category: category.title, baseScale: scale };
                
                categoryGroup.add(sprite);
                this.#objects.constellations.push(sprite);
                points.push(sprite.position);
            });

            if (points.length > 1) {
                const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4d5a7a, transparent: true, opacity: 0.3 });
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                categoryGroup.add(line);
            }
        }
    }

    #showInfoPanel = (intersectedObject) => {
        if (!intersectedObject) {
            this.#infoPanel.classList.add('hidden');
            return;
        }

        const topicData = intersectedObject.userData;
        document.getElementById('info-panel-title').textContent = topicData.name;
        document.getElementById('info-panel-level').textContent = `LVL ${topicData.level}`;
        document.getElementById('info-panel-desc').textContent = topicData.description;
        
        const quizBtn = document.getElementById('info-panel-quiz-btn');
        const studyBtn = document.getElementById('info-panel-study-btn');
        
        const startQuizHandler = async () => {
            const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicData.name}". The difficulty should be for a user at Level ${topicData.level} of ${MAX_LEVEL}.`;
            const quizContext = { topicName: topicData.name, level: topicData.level, returnHash: '#home', isLeveled: true, prompt, generationType: 'quiz' };
            await startQuizFlow(quizContext);
        };
        
        const startStudyHandler = () => {
             const prompt = `Generate a concise study guide about "${topicData.name}". The guide should be easy to understand for a beginner.`;
             const quizContext = { topicName: topicData.name, level: topicData.level, returnHash: '#home', isLeveled: true, prompt, generationType: 'study' };
             sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
             window.location.hash = '#loading';
        };

        quizBtn.onclick = startQuizHandler;
        studyBtn.onclick = startStudyHandler;

        this.#infoPanel.classList.remove('hidden');
    };

    #onResize = () => {
        if (!this.#renderer) return;
        this.#camera.aspect = this.#canvas.clientWidth / this.#canvas.clientHeight;
        this.#camera.updateProjectionMatrix();
        this.#renderer.setSize(this.#canvas.clientWidth, this.#canvas.clientHeight);
    };

    #onMouseMove = (event) => {
        if (this.#isAnimating) return;
        const rect = this.#canvas.getBoundingClientRect();
        this.#mouse.x = ((event.clientX - rect.left) / this.#canvas.clientWidth) * 2 - 1;
        this.#mouse.y = -((event.clientY - rect.top) / this.#canvas.clientHeight) * 2 + 1;
    };

    #onClick = () => {
        if (this.#isAnimating || !this.#intersected) return;

        const topicData = this.#intersected; 
        this.#infoPanel.classList.add('hidden');

        // Start animation
        this.#isAnimating = true;
        this.#animationStartTime = this.#clock.getElapsedTime();
        this.#animationEndObject = topicData;

        this.#animationStartPosition.copy(this.#camera.position);
        this.#animationStartLookAt.set(0,0,0); // Assume we are looking at the center

        const worldPosition = new THREE.Vector3();
        topicData.getWorldPosition(worldPosition);

        this.#cameraLookAtTarget.copy(worldPosition);
        this.#cameraTargetPosition.copy(worldPosition).add(new THREE.Vector3(0, 2, 5));
    };

    #animate = () => {
        this.#animationFrameId = requestAnimationFrame(this.#animate);
        const elapsedTime = this.#clock.getElapsedTime();

        if (this.#isAnimating) {
            const elapsed = elapsedTime - this.#animationStartTime;
            const progress = Math.min(elapsed / this.#animationDuration, 1);
            const easedProgress = 0.5 * (1 - Math.cos(progress * Math.PI));

            this.#camera.position.lerpVectors(this.#animationStartPosition, this.#cameraTargetPosition, easedProgress);
            
            const currentLookAt = new THREE.Vector3().lerpVectors(this.#animationStartLookAt, this.#cameraLookAtTarget, easedProgress);
            this.#camera.lookAt(currentLookAt);

            if (progress >= 1) {
                this.#isAnimating = false;
                this.#showInfoPanel(this.#animationEndObject);
                this.#animationEndObject = null;
            }
        } else {
            // Idle state animation: auto-rotation and mouse parallax
            if (this.#objects.constellationGroup) {
                this.#objects.constellationGroup.rotation.y = elapsedTime * 0.05;
            }

            this.#camera.position.x += (this.#mouse.x * 2 - this.#camera.position.x) * .02;
            this.#camera.position.y += (-this.#mouse.y * 2 - this.#camera.position.y) * .02;
            this.#camera.lookAt(this.#scene.position);

            // Raycasting for hover effect
            this.#raycaster.setFromCamera(this.#mouse, this.#camera);
            const intersects = this.#raycaster.intersectObjects(this.#objects.constellations);

            if (intersects.length > 0) {
                if (this.#intersected !== intersects[0].object) {
                    if (this.#intersected) {
                        this.#intersected.material.color.setHex(0xffffff);
                        const oldScale = this.#intersected.userData.baseScale;
                        this.#intersected.scale.set(oldScale, oldScale, oldScale);
                    }
                    this.#intersected = intersects[0].object;
                    this.#intersected.material.color.setHex(0x00ffff); // Cyan highlight
                    this.#canvas.style.cursor = 'pointer';
                }
            } else {
                if (this.#intersected) {
                    this.#intersected.material.color.setHex(0xffffff);
                    const oldScale = this.#intersected.userData.baseScale;
                    this.#intersected.scale.set(oldScale, oldScale, oldScale);
                    this.#canvas.style.cursor = 'grab';
                }
                this.#intersected = null;
            }
        }
        
        // Apply pulse to the currently hovered object
        if (this.#intersected) {
            const pulse = Math.sin(elapsedTime * 5) * 0.1 + 1.0;
            const baseScale = this.#intersected.userData.baseScale * 1.5; // Scale up for hover
            this.#intersected.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);
        }

        this.#renderer.render(this.#scene, this.#camera);
    };

    destroy() {
        if (this.#animationFrameId) {
            cancelAnimationFrame(this.#animationFrameId);
        }
        window.removeEventListener('resize', this.#onResize);
        this.#canvas.removeEventListener('mousemove', this.#onMouseMove);
        this.#canvas.removeEventListener('click', this.#onClick);
        
        if (this.#scene) {
            this.#scene.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
        if (this.#renderer) this.#renderer.dispose();
        
        this.#renderer = null;
        this.#scene = null;
        this.#camera = null;
    }
}