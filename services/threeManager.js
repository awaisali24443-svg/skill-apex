// services/threeManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { soundService } from './soundService.js';
import { getCategories } from './topicService.js';

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

const initialCameraPos = new THREE.Vector3(0, 20, 55);

// --- Static Planet Config for non-category modules ---
const STATIC_PLANET_CONFIG = [
    { name: 'Custom Quiz', route: '#custom-quiz', size: 1.0, orbitRadiusX: 28, orbitRadiusZ: 26, speed: 0.15, rotationSpeed: 0.004, type: 'neptune' },
    { name: 'Aural AI', route: '#aural', size: 1.5, orbitRadiusX: 58, orbitRadiusZ: 58, speed: 0.06, rotationSpeed: 0.002, type: 'jupiter', rings: true },
    { name: 'Learning Paths', route: '#paths', size: 1.2, orbitRadiusX: 70, orbitRadiusZ: 68, speed: 0.05, rotationSpeed: 0.007, type: 'ice' },
    { name: 'My Library', route: '#library', size: 0.9, orbitRadiusX: 80, orbitRadiusZ: 80, speed: 0.04, rotationSpeed: 0.008, type: 'rocky_dark' },
    { name: 'Settings', route: '#settings', size: 0.7, orbitRadiusX: 90, orbitRadiusZ: 92, speed: 0.03, rotationSpeed: 0.009, type: 'mars' },
];

const PLANET_VISUAL_TYPES = ['earth', 'mars', 'rocky', 'neptune', 'ice', 'jupiter'];

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
async function init(canvas, clickCallback) {
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

    // --- Dynamic Planet Generation ---
    const allPlanetConfigs = [...STATIC_PLANET_CONFIG];
    try {
        const categories = await getCategories();
        const baseOrbit = 18;
        const orbitStep = 10;
        categories.forEach((cat, index) => {
            allPlanetConfigs.push({
                name: cat.name,
                route: `#topics/${cat.id}`,
                size: 1.0 + Math.random() * 0.4 - 0.2, // ~0.8 to 1.2
                orbitRadiusX: baseOrbit + (index * orbitStep),
                orbitRadiusZ: baseOrbit + (index * orbitStep) + (Math.random() * 4 - 2), // slightly elliptical
                speed: 0.2 - (index * 0.03),
                rotationSpeed: 0.003 + Math.random() * 0.004,
                type: PLANET_VISUAL_TYPES[index % PLANET_VISUAL_TYPES.length] // cycle through visuals
            });
        });
    } catch (error) {
        console.error("Could not fetch categories to generate planets:", error);
    }
    
    // Sort planets by orbit radius for a logical layout
    allPlanetConfigs.sort((a, b) => a.orbitRadiusX - b.orbitRadiusX);

    allPlanetConfigs.forEach(config => {
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
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMouseMove);

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
    const innerRadius = 42;
    const outerRadius = 45;

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
    let startTime = null;

    function updateCameraAnimation(timestamp) {
        if (!clock) return;
        if (startTime === null) startTime = timestamp; 
        const elapsed = timestamp - startTime;
        const t = Math.min(elapsed / (duration * 1000), 1.0);
        const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        camera.position.lerpVectors(startPos, initialCameraPos, easedT);
        if (t < 1.0) {
            requestAnimationFrame(updateCameraAnimation);
        } else {
            camera.position.copy(initialCameraPos);
        }
    }
    requestAnimationFrame(updateCameraAnimation);
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    sunLight.intensity = 3.5 + Math.sin(elapsedTime * 0.5) * 0.2;
    sunMesh.scale.setScalar(1.0 + Math.sin(elapsedTime * 0.5) * 0.02);
    
    if (composer) {
        const screenPosition = new THREE.Vector3();
        sunMesh.getWorldPosition(screenPosition);
        screenPosition.project(camera);
        const godRaysPass = composer.passes[1]; 
        if (godRaysPass && godRaysPass.material.uniforms.uLightPosition) {
            godRaysPass.material.uniforms.uLightPosition.value.x = (screenPosition.x + 1) * 0.5;
            godRaysPass.material.uniforms.uLightPosition.value.y = (screenPosition.y + 1) * 0.5;
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
    if (particleSystem) particleSystem.rotation.y += 0.0001;
    
    controls.update();
    composer.render();
}

function onClick(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
        let currentObject = intersects[0].object;
        // Traverse up to find the object with userData
        while(currentObject) {
            if (currentObject.userData.isPlanet) {
                soundService.playSound('click');
                if (onPlanetClick) {
                    onPlanetClick(currentObject);
                }
                return;
            }
            currentObject = currentObject.parent;
        }
    }
}

function onMouseMove(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    let intersectedPlanet = null;
    if (intersects.length > 0) {
        let currentObject = intersects[0].object;
        while(currentObject) {
             if (currentObject.userData.isPlanet) {
                intersectedPlanet = currentObject;
                break;
            }
            currentObject = currentObject.parent;
        }
    }
    
    if (intersectedPlanet) {
        canvas.style.cursor = 'pointer';
        if (hoveredPlanet !== intersectedPlanet) {
            if (hoveredPlanet && hoveredPlanet.material.emissive) {
                hoveredPlanet.material.emissive.setHex(0x000000);
            }
            hoveredPlanet = intersectedPlanet;
            if (hoveredPlanet.material.emissive) {
                 hoveredPlanet.material.emissive.setHex(0x444444);
            }
            soundService.playSound('hover');
        }
    } else {
        canvas.style.cursor = 'grab';
        if (hoveredPlanet && hoveredPlanet.material.emissive) {
            hoveredPlanet.material.emissive.setHex(0x000000);
            hoveredPlanet = null;
        }
    }
}

function onWindowResize() {
    const canvas = renderer.domElement;
    if(!canvas || !canvas.parentElement) return;

    const parent = canvas.parentElement;
    camera.aspect = parent.clientWidth / parent.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(parent.clientWidth, parent.clientHeight);
    composer.setSize(parent.clientWidth, parent.clientHeight);
}

function destroy() {
    console.log("Destroying Three.js manager");
    cancelAnimationFrame(animationFrameId);
    
    const canvas = renderer?.domElement;
    if (canvas) {
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('mousemove', onMouseMove);
    }
    window.removeEventListener('resize', onWindowResize);
    
    soundService.stopAmbient();

    scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
    });

    if (renderer) renderer.dispose();
    if (controls) controls.dispose();
    
    // Clear arrays
    interactableObjects.length = 0;
    planets.length = 0;
    orbitLines.length = 0;

    // Nullify variables
    camera = scene = renderer = composer = controls = sunLight = sunMesh = clock = raycaster = mouse = null;
    asteroidBelt = particleSystem = hoveredPlanet = null;
    animationFrameId = undefined;
}

export const threeManager = {
    init,
    destroy,
};