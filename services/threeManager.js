// services/threeManager.js
import * as THREE from 'three';

let camera, scene, renderer, particles;
let animationFrameId;
let resizeListener;
let mouse = new THREE.Vector2(0, 0);
const clock = new THREE.Clock(); // Add a clock for smooth animation

// --- Galaxy Parameters ---
const GALAXY_PARAMS = {
    count: 100000,
    size: 0.01,
    radius: 5,
    branches: 5,
    spin: 1,
    randomness: 0.5,
    randomnessPower: 3,
};

const init = () => {
    // Scene setup
    scene = new THREE.Scene();
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.5, 6); // Adjusted camera position for a better view

    // Renderer setup
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) {
        console.error("Background canvas not found!");
        return;
    }
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- Generate Galaxy Geometry ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(GALAXY_PARAMS.count * 3);
    const colors = new Float32Array(GALAXY_PARAMS.count * 3);
    const scales = new Float32Array(GALAXY_PARAMS.count * 1);

    const insideColor = new THREE.Color('#a855f7'); // Aurora primary
    const outsideColor = new THREE.Color('#2dd4bf'); // Aurora secondary

    for (let i = 0; i < GALAXY_PARAMS.count; i++) {
        const i3 = i * 3;
        
        // Position
        const radius = Math.random() * GALAXY_PARAMS.radius;
        const spinAngle = radius * GALAXY_PARAMS.spin;
        const branchAngle = (i % GALAXY_PARAMS.branches) / GALAXY_PARAMS.branches * Math.PI * 2;

        const randomX = Math.pow(Math.random(), GALAXY_PARAMS.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * GALAXY_PARAMS.randomness * radius;
        const randomY = Math.pow(Math.random(), GALAXY_PARAMS.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * GALAXY_PARAMS.randomness * radius;
        const randomZ = Math.pow(Math.random(), GALAXY_PARAMS.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * GALAXY_PARAMS.randomness * radius;

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        // Color
        const mixedColor = insideColor.clone();
        mixedColor.lerp(outsideColor, radius / GALAXY_PARAMS.radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;

        // Scale
        scales[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));


    // --- Custom Shader Material ---
    const material = new THREE.ShaderMaterial({
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms: {
            uTime: { value: 0 },
            uSize: { value: 30 * renderer.getPixelRatio() }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uSize;
            attribute float aScale;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                
                // Spin animation
                float angle = atan(modelPosition.x, modelPosition.z);
                float distance = length(modelPosition.xz);
                angle += distance * 0.1 * uTime;
                modelPosition.x = cos(angle) * distance;
                modelPosition.z = sin(angle) * distance;
                
                vec4 viewPosition = viewMatrix * modelPosition;
                vec4 projectedPosition = projectionMatrix * viewPosition;
                gl_Position = projectedPosition;
                gl_PointSize = uSize * aScale * (1.0 / -viewPosition.z);
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float strength = distance(gl_PointCoord, vec2(0.5));
                strength = 1.0 - strength;
                strength = pow(strength, 3.0);
                
                gl_FragColor = vec4(vColor * strength, strength * 0.8);
            }
        `
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Resize listener
    resizeListener = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        material.uniforms.uSize.value = 30 * renderer.getPixelRatio();
    };
    window.addEventListener('resize', resizeListener);

    animate();
};

const animate = () => {
    const elapsedTime = clock.getElapsedTime();
    
    // Update material time uniform
    if (particles) {
        particles.material.uniforms.uTime.value = elapsedTime * 0.1;
    }

    // Smoother camera parallax effect
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouse.y * 0.5 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animate);
};

const updateMousePosition = (x, y) => {
    mouse.x = x;
    mouse.y = y;
};

const destroy = () => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
        resizeListener = null;
    }
    
    if (scene) {
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
        scene = null;
    }
    
    if (renderer) {
        renderer.dispose();
        renderer.domElement = null;
        renderer = null;
    }
    
    particles = null;
    camera = null;
};

export const threeManager = {
    init,
    destroy,
    updateMousePosition,
};