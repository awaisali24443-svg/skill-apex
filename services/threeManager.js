// services/threeManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { soundService } from './soundService.js';

let camera, scene, renderer, composer, controls, sunLight, sunMesh;
let clock, raycaster, mouse;
let animationFrameId;
let onPlanetClick;
const interactableObjects = [];
const planets = [];
const orbitLines = [];
let asteroidBelt, particleSystem;
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

// --- Shaders ---
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
// --- God Rays Shader ---
const GodRaysShader = {
    uniforms: {
        tDiffuse: { value: null },
        uLightPosition: { value: new THREE.Vector2(0.5, 0.5) },
        uExposure: { value: 0.6 },
        uDecay: { value: 0.95 },
        uDensity: { value: 0.8 },
        uWeight: { value: 0.4 },
        uClamp: { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uLightPosition;
        uniform float uExposure;
        uniform float uDecay;
        uniform float uDensity;
        uniform float uWeight;
        uniform float uClamp;

        const int NUM_SAMPLES = 100;

        void main() {
            vec2 delta = vUv - uLightPosition;
            delta *= 1.0 / float(NUM_SAMPLES) * uDensity;
            float illuminationDecay = 1.0;
            vec4 color = texture2D(tDiffuse, vUv) * 0.4; // Base color with reduced brightness

            for (int i = 0; i < NUM_SAMPLES; i++) {
                vUv -= delta;
                vec4 sampleColor = texture2D(tDiffuse, vUv);
                sampleColor *= illuminationDecay * uWeight;
                color += sampleColor;
                illuminationDecay *= uDecay;
            }
            color = clamp(color, 0.0, uClamp);
            gl_FragColor = color * uExposure;
        }
    `
};


// --- Main Initialization ---
function init(canvas, clickCallback) {
    onPlanetClick = clickCallback;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(-10, -10); // Initialize off-screen
    scene = new THREE.Scene();

    const skyboxLoader = new THREE.CubeTextureLoader();
    const skyboxTexture = skyboxLoader.setPath('/assets/textures/realistic_skybox/').load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']);
    scene.background = skyboxTexture;

    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    camera.position.copy(initialCameraPos);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 150;
    controls.enablePan = false;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    sunLight = new THREE.PointLight(0xffffff, 3.5, 1000);
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 32), sunMaterial);
    scene.add(sunMesh);

    const textureFlare0 = textureLoader.load('/assets/textures/lensflare0.png');
    const textureFlare3 = textureLoader.load('/assets/textures/lensflare3.png');
    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(textureFlare0, 700, 0, sunLight.color));
    lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 1));
    sunLight.add(lensflare);

    PLANET_CONFIG.forEach(config => {
        createPlanet(config);
        createOrbitLine(config);
    });
    
    createAsteroidBelt();
    createParticleNebula();

    // --- Post-Processing Setup ---
    composer = new EffectComposer(renderer);
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const godRaysPass = new ShaderPass(GodRaysShader);
    godRaysPass.needsSwap = true;
    composer.addPass(godRaysPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.8, 0.3, 0.3);
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
    
    switch (config.type) {
        case 'earth':
            planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/earth_day.jpg'),
                    bumpMap: textureLoader.load('/assets/textures/planets/earth_bump.jpg'),
                    bumpScale: 0.02,
                    specularMap: textureLoader.load('/assets/textures/planets/earth_specular.png'),
                    specular: new THREE.Color('grey'),
                    shininess: 10, // Increased shininess for water
                    emissiveMap: textureLoader.load('/assets/textures/planets/earth_night.jpg'),
                    emissive: new THREE.Color(0xffff88),
                    emissiveIntensity: 1.5
                })
            );
             const cloudsMesh = new THREE.Mesh(
                new THREE.SphereGeometry(config.size * 1.01, 64, 64),
                new THREE.MeshStandardMaterial({
                    map: textureLoader.load('/assets/textures/planets/earth_clouds.png'),
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    opacity: 0.8
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
                    map: textureLoader.load('/assets/textures/planets/ice.jpg'),
                    shininess: 80, // Make it look icy
                    specular: 0xffffff
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

function createOrbitLine(config) {
    const curve = new THREE.EllipseCurve(
        0, 0,
        config.orbitRadiusX, config.orbitRadiusZ,
        0, 2 * Math.PI, false, 0
    );
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
        color: 0x00f6ff,
        linewidth: 1,
        scale: 1,
        dashSize: 0.5,
        gapSize: 0.25,
        transparent: true,
        opacity: 0.2
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.rotation.x = Math.PI / 2;
    scene.add(line);
    orbitLines.push(line);
}

function createAsteroidBelt() {
    const asteroidCount = 700;
    const geometry = new THREE.DodecahedronGeometry(0.1, 0);
    const material = new THREE.MeshStandardMaterial({
        map: textureLoader.load('/assets/textures/planets/asteroid.jpg'),
        color: 0xaaaaaa,
        roughness: 0.8,
    });
    
    asteroidBelt = new THREE.InstancedMesh(geometry, material, asteroidCount);
    asteroidBelt.castShadow = true;
    asteroidBelt.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const innerRadius = 32;
    const outerRadius = 35;

    for (let i = 0; i < asteroidCount; i++) {
        const radius = Math.random() * (outerRadius - innerRadius) + innerRadius;
        const angle = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * 2.0;

        dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.scale.setScalar(Math.random() * 2 + 0.5);
        dummy.updateMatrix();
        asteroidBelt.setMatrixAt(i, dummy.matrix);
    }

    scene.add(asteroidBelt);
}

function createParticleNebula() {
    const particleCount = 20000;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        size: 0.1,
        map: textureLoader.load('/assets/textures/particle_noise.png'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: 0x00f6ff,
        opacity: 0.3
    });
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
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
    
    // Animate Sun pulse
    sunLight.intensity = 3.5 + Math.sin(elapsedTime * 0.5) * 0.2;
    sunMesh.scale.setScalar(1.0 + Math.sin(elapsedTime * 0.5) * 0.02);
    
    // Update God Rays light position
    if (composer) {
        const screenPosition = new THREE.Vector3();
        sunMesh.getWorldPosition(screenPosition);
        screenPosition.project(camera);
        const godRaysPass = composer.passes[1]; // Assuming it's the second pass
        if (godRaysPass && godRaysPass.material.uniforms.uLightPosition) {
            godRaysPass.material.uniforms.uLightPosition.value.x = (screenPosition.x + 1) * 0.5;
            godRaysPass.material.uniforms.uLightPosition.value.y = (screenPosition.y + 1) * 0.5;
        }
    }
    
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
        p.mesh.rotation.y += p.rotationSpeed * delta * 20;
        p.mesh.children.forEach(child => {
            if(child.material.map?.source?.data?.src?.includes('clouds')) {
                 child.rotation.y += p.rotationSpeed * delta * 10;
            }
        });
    });
    
    orbitLines.forEach(line => {
        line.material.dashOffset -= 0.001;
    });
    
    if (asteroidBelt) asteroidBelt.rotation.y += 0.0002;
    if (particleSystem) {
        particleSystem.rotation.y += 0.0001;
        // Interactive particle effect
        const positions = particleSystem.geometry.attributes.position.array;
        const targetX = mouse.x * 50;
        const targetY = mouse.y * 20;
        for (let i = 0; i < positions.length; i += 3) {
            const dx = positions[i] - targetX;
            const dy = positions[i+1] - targetY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 10) {
                 positions[i+2] += (10-dist) * 0.01;
            }
             positions[i+2] *= 0.99; // Slowly return to position
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    
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
    if (isAnimatingCamera || event.target.tagName !== 'CANVAS') {
        mouse.x = -10; // Move mouse off-screen for particle effect
        mouse.y = -10;
        return;
    };
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
    orbitLines.length = 0;
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