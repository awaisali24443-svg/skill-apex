import * as THREE from 'three';

let camera, scene, renderer, stars;
let container;
let animationFrameId;

function init(containerElement) {
    container = containerElement;

    // --- Scene Setup ---
    scene = new THREE.Scene();

    // --- Camera Setup ---
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 1;
    camera.rotation.x = Math.PI / 2;

    // --- Renderer Setup ---
    renderer = new THREE.WebGLRenderer({
        canvas: container.querySelector('#bg-canvas'),
        antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // --- Starfield ---
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 6000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.7
    });

    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize, false);

    // --- Start Animation ---
    animate();
}

function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Animate stars
    if (stars) {
        stars.rotation.y += 0.0001;
    }

    renderer.render(scene, camera);
}

function destroy() {
    console.log("Destroying Three.js manager");
    window.removeEventListener('resize', onWindowResize);
    cancelAnimationFrame(animationFrameId);
    if (renderer) {
        renderer.dispose();
    }
    if (scene) {
        scene.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if(Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
    renderer = null;
    scene = null;
    camera = null;
    stars = null;
    container = null;
}

export const threeManager = {
    init,
    destroy,
};
