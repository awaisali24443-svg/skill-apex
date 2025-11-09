// This class manages a single Three.js scene instance.
// A new instance should be created for each module that needs a background.
export class SceneManager {
    #camera;
    #scene;
    #renderer;
    #animationFrameId;
    #objects = {}; // To hold scene-specific objects for animation
    #sceneType;
    #canvas;
    #clock;
    #mouse = new THREE.Vector2();

    constructor(canvas) {
        if (!canvas) {
            throw new Error('Canvas element is required for SceneManager.');
        }
        this.#canvas = canvas;
        this.#clock = new THREE.Clock();
    }

    #getThemeColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            primary: new THREE.Color(style.getPropertyValue('--color-primary').trim() || '#3b82f6'),
            secondary: new THREE.Color(style.getPropertyValue('--color-secondary').trim() || '#14b8a6'),
            text: new THREE.Color(style.getPropertyValue('--color-text').trim() || '#111111'),
            bg: new THREE.Color(style.getPropertyValue('--color-bg').trim() || '#ffffff'),
        };
    }

    init(sceneType) {
        if (!window.THREE) {
            console.error('THREE.js is not loaded.');
            return;
        }
        this.#sceneType = sceneType;

        this.#scene = new THREE.Scene();
        this.#camera = new THREE.PerspectiveCamera(75, this.#canvas.clientWidth / this.#canvas.clientHeight, 0.1, 1000);
        this.#camera.position.z = 5;

        this.#renderer = new THREE.WebGLRenderer({ canvas: this.#canvas, alpha: true, antialias: true });
        this.#renderer.setSize(this.#canvas.clientWidth, this.#canvas.clientHeight);
        this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        switch (this.#sceneType) {
            case 'particleGalaxy': this.#createParticleGalaxy(8000, 0.01); break;
            case 'subtleParticles': this.#createParticleGalaxy(1000, 0.015); break;
            case 'abstractHub': this.#createAbstractHub(); break;
            case 'dataStream': this.#createDataStream(); break;
            case 'atomicStructure': this.#createAtomicStructure(); break;
            case 'calmGeometric': this.#createCalmGeometric(); break;
            // New Thematic Scenes
            case 'nebula': this.#createNebulaScene(); break;
            case 'microscopic': this.#createMicroscopicScene(); break;
            default: console.warn(`Unknown scene type: ${this.#sceneType}`);
        }
        
        window.addEventListener('resize', this.#onResize);
        document.addEventListener('mousemove', this.#onMouseMove);
        this.#onResize();

        this.#animate();
    }
    
    #onMouseMove = (event) => {
        this.#mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.#mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    #onResize = () => {
        if (!this.#renderer) return;
        this.#camera.aspect = this.#canvas.clientWidth / this.#canvas.clientHeight;
        this.#camera.updateProjectionMatrix();
        this.#renderer.setSize(this.#canvas.clientWidth, this.#canvas.clientHeight);
        this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    #createParticleGalaxy(count, size) {
        const colors = this.#getThemeColors();
        const positions = new Float32Array(count * 3);
        const particleColors = new Float32Array(count * 3);
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

            color.set(Math.random() > 0.5 ? colors.primary : colors.secondary);
            particleColors[i * 3] = color.r;
            particleColors[i * 3 + 1] = color.g;
            particleColors[i * 3 + 2] = color.b;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        
        const material = new THREE.PointsMaterial({
            size: size,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        
        this.#objects.particles = new THREE.Points(geometry, material);
        this.#scene.add(this.#objects.particles);
        this.#camera.position.z = 3;
    }

    #createAbstractHub() {
        const colors = this.#getThemeColors();
        const group = new THREE.Group();
        const geometry = new THREE.IcosahedronGeometry(1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: colors.primary, 
            roughness: 0.2, 
            metalness: 0.9,
            emissive: colors.primary,
            emissiveIntensity: 0.1
        });
        
        const mainShape = new THREE.Mesh(geometry, material);
        group.add(mainShape);

        const wireframeGeo = new THREE.IcosahedronGeometry(1.01, 1);
        const wireframeMat = new THREE.MeshBasicMaterial({ color: colors.secondary, wireframe: true, transparent: true, opacity: 0.3 });
        const wireframe = new THREE.Mesh(wireframeGeo, wireframeMat);
        group.add(wireframe);

        for(let i=0; i < 5; i++) {
            const torusGeo = new THREE.TorusGeometry(2 + i * 0.5, 0.03, 16, 100);
            const torusMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? colors.primary : colors.secondary, transparent: true, opacity: 0.5 });
            const torus = new THREE.Mesh(torusGeo, torusMat);
            torus.rotation.x = Math.random() * Math.PI;
            torus.rotation.y = Math.random() * Math.PI;
            group.add(torus);
        }
        
        const light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(5, 5, 5);
        this.#scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));

        this.#objects.hub = group;
        this.#scene.add(group);
    }
    
    #createDataStream() {
        const colors = this.#getThemeColors();
        const particleCount = 4000;
        const positions = new Float32Array(particleCount * 3);
        this.#objects.velocities = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = Math.random() * 20 - 10;
            positions[i * 3 + 1] = Math.random() * 20 - 10;
            positions[i * 3 + 2] = Math.random() * 20 - 10;
            this.#objects.velocities[i] = 1 + Math.random() * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 0.03,
            color: colors.secondary,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
        });

        this.#objects.particles = new THREE.Points(geometry, material);
        this.#scene.add(this.#objects.particles);
        this.#camera.position.z = 10;
    }

    #createAtomicStructure() {
        const colors = this.#getThemeColors();
        const group = new THREE.Group();
        const coreGeo = new THREE.IcosahedronGeometry(0.5, 1);
        const coreMat = new THREE.MeshStandardMaterial({color: colors.primary, flatShading: true});
        const core = new THREE.Mesh(coreGeo, coreMat);
        group.add(core);

        for (let i = 0; i < 3; i++) {
            const orbitGeo = new THREE.TorusGeometry(2 + i, 0.02, 16, 100);
            const orbitMat = new THREE.MeshBasicMaterial({color: colors.text, transparent: true, opacity: 0.3});
            const orbit = new THREE.Mesh(orbitGeo, orbitMat);
            orbit.rotation.x = Math.random() * Math.PI;
            orbit.rotation.y = Math.random() * Math.PI;
            group.add(orbit);

            const electronGeo = new THREE.SphereGeometry(0.1, 16, 16);
            const electronMat = new THREE.MeshBasicMaterial({color: colors.secondary});
            const electron = new THREE.Mesh(electronGeo, electronMat);
            electron.position.x = 2 + i;
            orbit.add(electron);
        }
        
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        this.#scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));
        
        this.#objects.atom = group;
        this.#scene.add(group);
    }
    
    #createCalmGeometric() {
        const colors = this.#getThemeColors();
        const geometry = new THREE.IcosahedronGeometry(1.5, 0);
        const material = new THREE.MeshStandardMaterial({
            color: colors.primary,
            transparent: true,
            opacity: 0.9,
            wireframe: true
        });
        
        this.#objects.shape = new THREE.Mesh(geometry, material);
        this.#scene.add(this.#objects.shape);

        const light = new THREE.PointLight(colors.secondary, 2, 100);
        light.position.set(0, 0, 10);
        this.#scene.add(light);
    }

    #createNebulaScene() {
        this.#scene.fog = new THREE.FogExp2(this.#getThemeColors().bg, 0.1);
        this.#createParticleGalaxy(10000, 0.02); // Denser stars
    }

    #createMicroscopicScene() {
        const colors = this.#getThemeColors();
        const group = new THREE.Group();
        for (let i = 0; i < 50; i++) {
            const geometry = new THREE.SphereGeometry(Math.random() * 0.5 + 0.1, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.5 ? colors.primary : colors.secondary,
                transparent: true,
                opacity: 0.6,
                roughness: 0.4
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
            mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
            group.add(mesh);
        }
        this.#objects.cells = group;
        this.#scene.add(group);
        this.#scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    }


    #animate = () => {
        if (!this.#renderer) return;
        this.#animationFrameId = window.requestAnimationFrame(this.#animate);
        
        const elapsedTime = this.#clock.getElapsedTime();
        const delta = this.#clock.getDelta();

        // Parallax effect
        this.#camera.position.x += (this.#mouse.x * 0.5 - this.#camera.position.x) * .05;
        this.#camera.position.y += (-this.#mouse.y * 0.5 - this.#camera.position.y) * .05;
        this.#camera.lookAt(this.#scene.position);


        switch (this.#sceneType) {
            case 'particleGalaxy':
            case 'nebula':
                if (this.#objects.particles) this.#objects.particles.rotation.y = elapsedTime * 0.05;
                break;
            case 'subtleParticles':
                if (this.#objects.particles) this.#objects.particles.rotation.y = elapsedTime * 0.03;
                break;
            case 'abstractHub':
                if(this.#objects.hub) {
                    this.#objects.hub.rotation.y += delta * 0.2;
                    this.#objects.hub.rotation.x += delta * 0.1;
                    this.#objects.hub.children[0].material.emissiveIntensity = Math.sin(elapsedTime * 2) * 0.2 + 0.2;
                }
                break;
            case 'dataStream':
                if(this.#objects.particles) {
                    const positions = this.#objects.particles.geometry.attributes.position.array;
                    for (let i = 0; i < positions.length / 3; i++) {
                        positions[i * 3 + 1] -= this.#objects.velocities[i] * delta;
                        if(positions[i * 3 + 1] < -10) positions[i * 3 + 1] = 10;
                    }
                    this.#objects.particles.geometry.attributes.position.needsUpdate = true;
                }
                break;
            case 'atomicStructure':
                if(this.#objects.atom) {
                    this.#objects.atom.rotation.y += delta * 0.1;
                    this.#objects.atom.children.forEach((child, index) => {
                        if(child.type === 'Mesh' && child.geometry.type === 'TorusGeometry') {
                            child.rotation.z += delta * (0.2 + index * 0.05);
                        }
                    });
                }
                break;
            case 'calmGeometric':
                if(this.#objects.shape) {
                    this.#objects.shape.rotation.y += delta * 0.1;
                    this.#objects.shape.rotation.x += delta * 0.1;
                }
                break;
            case 'microscopic':
                if(this.#objects.cells) {
                    this.#objects.cells.children.forEach(cell => {
                        cell.position.add(cell.userData.velocity);
                        if(Math.abs(cell.position.x) > 8) cell.userData.velocity.x *= -1;
                        if(Math.abs(cell.position.y) > 8) cell.userData.velocity.y *= -1;
                        if(Math.abs(cell.position.z) > 8) cell.userData.velocity.z *= -1;
                    });
                }
                break;
        }

        this.#renderer.render(this.#scene, this.#camera);
    }

    destroy() {
        if (this.#animationFrameId) {
            window.cancelAnimationFrame(this.#animationFrameId);
        }
        window.removeEventListener('resize', this.#onResize);
        document.removeEventListener('mousemove', this.#onMouseMove);
        
        if (this.#scene) {
            this.#scene.traverse(object => {
                if (object.isMesh || object.isPoints) {
                    if(object.geometry) object.geometry.dispose();
                    if(object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => mat.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        }

        if (this.#renderer) {
            this.#renderer.dispose();
            this.#renderer.domElement.width = 0;
            this.#renderer.domElement.height = 0;
        }

        this.#renderer = null;
        this.#scene = null;
        this.#camera = null;
        this.#objects = {};
    }
}