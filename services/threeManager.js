// services/threeManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js'; // NEW
import { soundService } from './soundService.js'; // NEW

let camera, scene, renderer, composer, controls, sunLight;
let clock, raycaster, mouse;
let animationFrameId;
let onPlanetClick;
const interactableObjects = [];
const planets = [];
let hoveredPlanet = null;

let isAnimatingCamera = false;
let animationCallback = null;
const targetPosition = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
const initialCameraPos = new THREE.Vector3(0, 15, 35);
const initialLookAt = new THREE.Vector3(0, 0, 0);

const PLANET_CONFIG = [
    { name: 'Explore Topics', route: '#explore', textureColors: { base: '#4da6ff', accent1: '#8ec5ff', accent2: '#3b82f6' }, size: 1.2, orbitRadiusX: 10, orbitRadiusZ: 10, speed: 0.2, rotationSpeed: 0.005, rings: true },
    { name: 'Custom Quiz', route: '#custom-quiz', textureColors: { base: '#ff6b6b', accent1: '#ff8e8e', accent2: '#e05252' }, size: 0.8, orbitRadiusX: 15, orbitRadiusZ: 14, speed: 0.15, rotationSpeed: 0.004, moons: 2 },
    { name: 'My Library', route: '#library', textureColors: { base: '#a375ff', accent1: '#c09eff', accent2: '#8f5bf0' }, size: 1.0, orbitRadiusX: 20, orbitRadiusZ: 19, speed: 0.1, rotationSpeed: 0.003 },
    { name: 'Settings', route: '#settings', textureColors: { base: '#cdcdcd', accent1: '#e0e0e0', accent2: '#a0a0a0' }, size: 0.7, orbitRadiusX: 25, orbitRadiusZ: 25, speed: 0.08, rotationSpeed: 0.006, rings: true, ringColor: 0xaaaaaa },
    { name: 'Leaderboard', route: '#placeholder', textureColors: { base: '#ffd700', accent1: '#ffeb80', accent2: '#e6c300' }, size: 1.1, orbitRadiusX: 31, orbitRadiusZ: 30, speed: 0.06, rotationSpeed: 0.002 },
    { name: 'Time Challenge', route: '#time-challenge', textureColors: { base: '#f783ac', accent1: '#f9a1c1', accent2: '#e36e95' }, size: 0.9, orbitRadiusX: 37, orbitRadiusZ: 37, speed: 0.05, rotationSpeed: 0.007, moons: 1 },
    { name: 'Profile', route: '#profile', textureColors: { base: '#33cc33', accent1: '#66dd66', accent2: '#29a329' }, size: 0.8, orbitRadiusX: 43, orbitRadiusZ: 42, speed: 0.04, rotationSpeed: 0.004 },
    { name: 'Coming Soon', route: '#placeholder', textureColors: { base: '#a1eaed', accent1: '#c1f0f2', accent2: '#81d8db' }, size: 1.5, orbitRadiusX: 50, orbitRadiusZ: 50, speed: 0.03, rotationSpeed: 0.001, rings: true, ringColor: 0xf0f8ff },
    { name: 'Coming Soon', route: '#placeholder', textureColors: { base: '#ffa07a', accent1: '#ffb899', accent2: '#e68a61' }, size: 1.3, orbitRadiusX: 58, orbitRadiusZ: 57, speed: 0.025, rotationSpeed: 0.005, moons: 3 },
];

// --- Procedural Texture Generation ---
function createPlanetTexture(colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, 512, 256);

    // Add craters and features
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        const radius = Math.random() * 5 + 1;
        const color = Math.random() > 0.5 ? colors.accent1 : colors.accent2;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.random() * 0.5 + 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    return new THREE.CanvasTexture(canvas);
}

function createRingTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(${color.r*255}, ${color.g*255}, ${color.b*255}, ${Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(Math.random()*128, Math.random()*128, Math.random()*1.5, 0, Math.PI*2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 1);
    return texture;
}

function createSunTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 220, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 220, 150, 1)');
    gradient.addColorStop(1, 'rgba(255, 180, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}

// --- Main Initialization ---
function init(canvas, clickCallback) {
    onPlanetClick = clickCallback;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.copy(initialCameraPos);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controls.enablePan = false;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    sunLight = new THREE.PointLight(0xffddaa, 3, 300);
    scene.add(sunLight);

    // NEW: Mobile optimization
    const isMobile = window.innerWidth <= 768;
    const starCount = isMobile ? 2000 : 10000;
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
    const starVertices = [];
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        if (x*x + y*y + z*z < 1000*1000) starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    
    // --- Sun ---
    const sunTexture = createSunTexture();
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 32), sunMaterial);
    scene.add(sunMesh);

    // NEW: Lens Flare with local assets
    const textureLoader = new THREE.TextureLoader();
    // FIX: Load textures from local assets for reliability
    const textureFlare0 = textureLoader.load( '/assets/textures/lensflare0.png' );
    const textureFlare3 = textureLoader.load( '/assets/textures/lensflare3.png' );
    const lensflare = new Lensflare();
    lensflare.addElement( new LensflareElement( textureFlare0, 700, 0, sunLight.color ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 60, 0.6 ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 70, 0.7 ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 120, 0.9 ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 70, 1 ) );
    sunLight.add( lensflare );


    PLANET_CONFIG.forEach(config => createPlanet(config));

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 1.0, 0.1, 0.1);
    composer = new EffectComposer(renderer);
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMouseMove);

    introAnimation();
    animate();
    soundService.startAmbient(); // NEW
}

function createPlanet(config) {
    const planetGroup = new THREE.Object3D();
    scene.add(planetGroup);

    const planetTexture = createPlanetTexture(config.textureColors);
    const planetMaterial = new THREE.MeshStandardMaterial({
        map: planetTexture,
        bumpMap: planetTexture,
        bumpScale: 0.02,
        roughness: 0.8,
        metalness: 0.1
    });

    const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(config.size, 32, 32), planetMaterial);
    planetMesh.userData = { route: config.route, name: config.name };
    planetGroup.add(planetMesh);
    interactableObjects.push(planetMesh);

    if (config.rings) {
        const ringColor = new THREE.Color(config.ringColor || config.textureColors.base);
        const ringTexture = createRingTexture(ringColor);
        const ringGeo = new THREE.RingGeometry(config.size * 1.4, config.size * 2.0, 64);
        const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI * 0.52;
        planetMesh.add(ringMesh);
    }
    
    if (config.moons) {
        for(let i=0; i<config.moons; i++) {
            const moonGroup = new THREE.Object3D();
            planetMesh.add(moonGroup);
            const moonGeo = new THREE.SphereGeometry(config.size * 0.15, 16, 16);
            const moonMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            const dist = config.size + 0.5 + Math.random() * 0.5;
            moonMesh.position.x = dist;
            moonGroup.add(moonMesh);
            moonGroup.rotation.y = Math.random() * Math.PI * 2;
            moonGroup.userData.speed = Math.random() * 0.5 + 0.5;
        }
    }

    planets.push({ 
        mesh: planetMesh, 
        group: planetGroup, 
        speed: config.speed, 
        orbitRadiusX: config.orbitRadiusX, 
        orbitRadiusZ: config.orbitRadiusZ,
        rotationSpeed: config.rotationSpeed
    });
}

function introAnimation() {
    camera.position.set(0, 5, 150);
    controls.target.set(0, 0, 0);
    
    const startPos = camera.position.clone();
    const duration = 4.0;
    const startTime = clock.getElapsedTime();

    function updateCameraAnimation() {
        if (!clock) return; // Guard against destroyed state
        const t = (clock.getElapsedTime() - startTime) / duration;
        const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        if (t < 1.0) {
            camera.position.lerpVectors(startPos, initialCameraPos, easedT);
            requestAnimationFrame(updateCameraAnimation);
        } else {
            camera.position.copy(initialCameraPos);
        }
    }
    updateCameraAnimation();
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    if (isAnimatingCamera) {
        camera.position.lerp(targetPosition, 0.05);
        controls.target.lerp(targetLookAt, 0.05);
        if (camera.position.distanceTo(targetPosition) < 0.1) {
            camera.position.copy(targetPosition);
            controls.target.copy(targetLookAt);
            isAnimatingCamera = false;
            controls.enabled = true;
            if (animationCallback) {
                animationCallback();
                animationCallback = null;
            }
        }
    }

    planets.forEach(p => {
        const angle = elapsedTime * p.speed;
        p.group.position.x = Math.cos(angle) * p.orbitRadiusX;
        p.group.position.z = Math.sin(angle) * p.orbitRadiusZ;
        p.mesh.rotation.y += p.rotationSpeed;
        p.mesh.children.forEach(child => {
            if (child instanceof THREE.Object3D && child.userData.speed) {
                child.rotation.y += child.userData.speed * delta;
            }
        });
    });
    
    sunLight.intensity = 3 + Math.sin(elapsedTime * 1.5) * 0.25;
    
    controls.update();
    composer.render();
}

function onClick(event) {
    if (isAnimatingCamera) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects);

    if (intersects.length > 0) {
        soundService.playSound('click'); // NEW
        const targetObject = intersects[0].object;
        if (onPlanetClick) {
            onPlanetClick(targetObject);
        }
    }
}

function onMouseMove(event) {
    if (isAnimatingCamera) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        document.body.style.cursor = 'pointer';
        if (hoveredPlanet !== intersectedObject) {
            if (hoveredPlanet) {
                hoveredPlanet.material.emissive.setHex(0x000000);
            }
            hoveredPlanet = intersectedObject;
            hoveredPlanet.material.emissive.setHex(0x333333);
            soundService.playSound('hover'); // NEW
        }
    } else {
        document.body.style.cursor = 'grab';
        if (hoveredPlanet) {
            hoveredPlanet.material.emissive.setHex(0x000000);
            hoveredPlanet = null;
        }
    }
}

function onWindowResize() {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
}

function destroy() {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('click', onClick);
    window.removeEventListener('mousemove', onMouseMove);
    soundService.stopAmbient(); // NEW

    scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    if (material.map) material.map.dispose();
                    material.dispose();
                });
            } else {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        }
    });

    if (renderer) renderer.dispose();
    if (controls) controls.dispose();
    interactableObjects.length = 0;
    planets.length = 0;
    clock = null; // nullify to stop animations
}

function focusOnPlanet(target, onComplete) {
    controls.enabled = false;
    isAnimatingCamera = true;
    animationCallback = onComplete;
    soundService.playSound('transition'); // NEW
    
    const planetRadius = target.geometry.parameters.radius;
    const offset = new THREE.Vector3(0, planetRadius * 0.5, planetRadius * 4);
    target.getWorldPosition(targetLookAt);
    targetPosition.copy(targetLookAt).add(offset);
}

function resetCamera(onComplete) {
    controls.enabled = false;
    isAnimatingCamera = true;
    animationCallback = onComplete;
    soundService.playSound('transition'); // NEW
    
    targetPosition.copy(initialCameraPos);
    targetLookAt.copy(initialLookAt);
}

export const threeManager = {
    init,
    destroy,
    focusOnPlanet,
    resetCamera,
};
