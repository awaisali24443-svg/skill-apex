// services/threeManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { soundService } from './soundService.js';

let camera, scene, renderer, composer, controls, sunLight;
let clock, raycaster, mouse;
let animationFrameId;
let onPlanetClick;
const interactableObjects = [];
const planets = [];
let hoveredPlanet = null;
const textureLoader = new THREE.TextureLoader();

let isAnimatingCamera = false;
let animationCallback = null;
const targetPosition = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
const initialCameraPos = new THREE.Vector3(0, 20, 55);
const initialLookAt = new THREE.Vector3(0, 0, 0);

// --- रियलिस्टिक प्लैनेट कॉन्फ़िगरेशन ---
const PLANET_CONFIG = [
    // Maps to new categories
    { name: 'Science & Nature', route: '#explore', size: 1.2, orbitRadiusX: 18, orbitRadiusZ: 18, speed: 0.2, rotationSpeed: 0.005, type: 'earth' },
    { name: 'History', route: '#explore', size: 0.8, orbitRadiusX: 28, orbitRadiusZ: 26, speed: 0.15, rotationSpeed: 0.004, type: 'mars' },
    { name: 'Arts & Literature', route: '#custom-quiz', size: 1.0, orbitRadiusX: 38, orbitRadiusZ: 38, speed: 0.1, rotationSpeed: 0.003, type: 'neptune' },
    { name: 'Technology', route: '#custom-quiz', size: 0.7, orbitRadiusX: 47, orbitRadiusZ: 45, speed: 0.08, rotationSpeed: 0.006, type: 'rocky' },
    { name: 'Aural AI', route: '#aural', size: 1.5, orbitRadiusX: 58, orbitRadiusZ: 58, speed: 0.06, rotationSpeed: 0.002, type: 'jupiter', rings: true },
    { name: 'My Library', route: '#library', size: 0.9, orbitRadiusX: 70, orbitRadiusZ: 68, speed: 0.05, rotationSpeed: 0.007, type: 'ice' },
    { name: 'Settings', route: '#settings', size: 0.6, orbitRadiusX: 80, orbitRadiusZ: 80, speed: 0.04, rotationSpeed: 0.008, type: 'rocky_dark' },
];

// --- Atmosphere Shader (for Earth-like planets) ---
const atmosphereVertexShader = `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize( normalMatrix * normal );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
`;
const atmosphereFragmentShader = `
    uniform vec3 uGlowColor;
    uniform float uPower;
    varying vec3 vNormal;
    void main() {
        float intensity = pow( 0.6 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), uPower );
        gl_FragColor = vec4( uGlowColor, 1.0 ) * intensity;
    }
`;


// --- Main Initialization ---
function init(canvas, clickCallback) {
    onPlanetClick = clickCallback;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    scene = new THREE.Scene();

    // --- Realistic Skybox ---
    const skyboxLoader = new THREE.CubeTextureLoader();
    const skyboxTexture = skyboxLoader.setPath('/assets/textures/realistic_skybox/').load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']);
    scene.background = skyboxTexture;

    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    camera.position.copy(initialCameraPos);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; // Enable shadows

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 150;
    controls.enablePan = false;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    sunLight = new THREE.PointLight(0xffffff, 3.5, 1000);
    sunLight.castShadow = true; // Sun casts shadows
    scene.add(sunLight);
    
    // --- Sun Mesh and Lens Flare ---
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 32), sunMaterial);
    scene.add(sunMesh);

    const textureFlare0 = textureLoader.load( '/assets/textures/lensflare0.png' );
    const textureFlare3 = textureLoader.load( '/assets/textures/lensflare3.png' );
    const lensflare = new Lensflare();
    lensflare.addElement( new LensflareElement( textureFlare0, 700, 0, sunLight.color ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 60, 0.6 ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 70, 0.7 ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 120, 0.9 ) );
    lensflare.addElement( new LensflareElement( textureFlare3, 70, 1 ) );
    sunLight.add( lensflare );

    PLANET_CONFIG.forEach(createPlanet);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.8, 0.3, 0.3);
    composer = new EffectComposer(renderer);
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMouseMove);

    introAnimation();
    animate();
    soundService.startAmbient();
}

function createPlanet(config) {
    const planetGroup = new THREE.Object3D();
    scene.add(planetGroup);
    
    let planetMesh;
    
    // --- Create planet based on type with realistic textures ---
    switch (config.type) {
        case 'earth':
            planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/earth_day.jpg'),
                    specularMap: textureLoader.load('/assets/textures/planets/earth_specular.png'),
                    shininess: 0.5,
                })
            );
             const cloudsMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size * 1.01, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/earth_clouds.png'),
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    opacity: 0.6
                })
            );
            planetMesh.add(cloudsMesh);
            const atmosphereMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size * 1.03, 64, 64),
                new THREE.ShaderMaterial({
                    vertexShader: atmosphereVertexShader,
                    fragmentShader: atmosphereFragmentShader,
                    blending: THREE.AdditiveBlending,
                    side: THREE.BackSide,
                    uniforms: {
                        uGlowColor: { value: new THREE.Color(0x87ceeb) },
                        uPower: { value: 3.0 }
                    }
                })
            );
            planetMesh.add(atmosphereMesh);
            break;
        case 'mars':
            planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/mars.jpg'),
                    bumpMap: textureLoader.load('/assets/textures/planets/mars_bump.jpg'),
                    bumpScale: 0.05,
                })
            );
            break;
        case 'jupiter':
             planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/jupiter.jpg')
                })
            );
            break;
         case 'neptune':
             planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/neptune.jpg')
                })
            );
            break;
        case 'ice':
             planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/ice.jpg')
                })
            );
            break;
        case 'rocky':
             planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/rocky.jpg'),
                    bumpMap: textureLoader.load('/assets/textures/planets/rocky_bump.jpg'),
                    bumpScale: 0.1,
                })
            );
            break;
        case 'rocky_dark':
             planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/rocky.jpg'),
                    bumpMap: textureLoader.load('/assets/textures/planets/rocky_bump.jpg'),
                    bumpScale: 0.1,
                    color: 0x888888 // Darken the texture
                })
            );
            break;
    }

    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    planetMesh.userData = { route: config.route, name: config.name, isPlanet: true };
    planetGroup.add(planetMesh);
    interactableObjects.push(planetMesh);

    if (config.rings) {
        const ringTexture = textureLoader.load('/assets/textures/rings/realistic_rings.png');
        const ringGeo = new THREE.RingGeometry(config.size * 1.5, config.size * 2.5, 64);
        const ringMat = new THREE.MeshStandardMaterial({ map: ringTexture, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.receiveShadow = true;
        ringMesh.rotation.x = Math.PI * 0.52;
        planetMesh.add(ringMesh);
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
        if (!clock) return; 
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
        p.mesh.rotation.y += p.rotationSpeed * delta * 20; // Scale rotation for realism
        p.mesh.children.forEach(child => {
            if(child.material.map?.source?.data?.src?.includes('clouds')) {
                 child.rotation.y += p.rotationSpeed * delta * 10;
            }
        });
    });
    
    controls.update();
    composer.render();
}

function onClick(event) {
    if (isAnimatingCamera || event.target.tagName !== 'CANVAS') return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects);

    if (intersects.length > 0 && intersects[0].object.userData.isPlanet) {
        soundService.playSound('click');
        const targetObject = intersects[0].object;
        if (onPlanetClick) {
            onPlanetClick(targetObject);
        }
    }
}

function onMouseMove(event) {
    if (isAnimatingCamera || event.target.tagName !== 'CANVAS') return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects);

    if (intersects.length > 0 && intersects[0].object.userData.isPlanet) {
        const intersectedObject = intersects[0].object;
        document.body.style.cursor = 'pointer';
        if (hoveredPlanet !== intersectedObject) {
            if (hoveredPlanet) {
                hoveredPlanet.material.emissive?.setHex(0x000000);
            }
            hoveredPlanet = intersectedObject;
            hoveredPlanet.material.emissive?.setHex(0x222222);
            soundService.playSound('hover');
        }
    } else {
        document.body.style.cursor = 'grab';
        if (hoveredPlanet) {
            hoveredPlanet.material.emissive?.setHex(0x000000);
            hoveredPlanet = null;
        }
    }
}

function onWindowResize() {
    const canvas = renderer.domElement;
    if(!canvas) return;
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
    soundService.stopAmbient();

    scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    Object.values(material).forEach(prop => {
                        if (prop && typeof prop.dispose === 'function') prop.dispose();
                    });
                    material.dispose();
                });
            } else {
                Object.values(object.material).forEach(prop => {
                    if (prop && typeof prop.dispose === 'function') prop.dispose();
                });
                object.material.dispose();
            }
        }
    });

    if (renderer) renderer.dispose();
    if (controls) controls.dispose();
    interactableObjects.length = 0;
    planets.length = 0;
    clock = null;
}

function focusOnPlanet(target, onComplete) {
    controls.enabled = false;
    isAnimatingCamera = true;
    animationCallback = onComplete;
    soundService.playSound('transition');
    
    const planetRadius = target.geometry.parameters.radius;
    const offset = new THREE.Vector3(0, planetRadius * 0.5, planetRadius * 4);
    target.getWorldPosition(targetLookAt);
    targetPosition.copy(targetLookAt).add(offset);
}

function resetCamera(onComplete) {
    controls.enabled = false;
    isAnimatingCamera = true;
    animationCallback = onComplete;
    soundService.playSound('transition');
    
    targetPosition.copy(initialCameraPos);
    targetLookAt.copy(initialLookAt);
}

export const threeManager = {
    init,
    destroy,
    focusOnPlanet,
    resetCamera,
};