import { categoryData } from './topicService.js';
import { getCurrentLevel } from './progressService.js';
import { NUM_QUESTIONS, MAX_LEVEL } from '../constants.js';
import { startQuizFlow } from './navigationService.js';

export class StellarMap {
    #canvas;
    #renderer;
    #scene;
    #camera;
    #controls; // For camera movement
    #raycaster;
    #mouse;
    #clock;
    #objects = { stars: [], constellations: [] };
    #intersected = null;

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

    init() {
        // Scene and Camera
        this.#scene = new THREE.Scene();
        this.#camera = new THREE.PerspectiveCamera(60, this.#canvas.clientWidth / this.#canvas.clientHeight, 0.1, 1000);
        this.#camera.position.z = 25;

        // Renderer
        this.#renderer = new THREE.WebGLRenderer({ canvas: this.#canvas, antialias: true });
        this.#renderer.setSize(this.#canvas.clientWidth, this.#canvas.clientHeight);
        this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lights
        this.#scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, 5, 5);
        this.#scene.add(dirLight);

        // Controls
        this.#controls = new THREE.OrbitControls(this.#camera, this.#renderer.domElement);
        this.#controls.enableDamping = true;
        this.#controls.enablePan = false;
        this.#controls.minDistance = 10;
        this.#controls.maxDistance = 50;
        this.#controls.target.set(0, 0, 0);

        this.#createBackground();
        this.#createConstellations();

        // Event Listeners
        window.addEventListener('resize', this.#onResize);
        this.#canvas.addEventListener('mousemove', this.#onMouseMove);
        this.#canvas.addEventListener('click', this.#onClick);
        
        this.#loadingOverlay.classList.add('hidden');
        this.#animate();
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
        const starGeo = new THREE.SphereGeometry(0.3, 24, 24);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.3 });

        for (const key in categoryData) {
            const category = categoryData[key];
            const categoryGroup = new THREE.Group();
            categoryGroup.position.set(category.pos.x, category.pos.y, category.pos.z);
            this.#scene.add(categoryGroup);
            this.#objects.constellations.push(categoryGroup);

            const points = [];
            category.topics.forEach(topic => {
                const level = getCurrentLevel(topic.name);
                const color = level > 1 ? 0x00ffff : 0xffffff;
                const starMat = new THREE.MeshPhongMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.5,
                    shininess: 100,
                });
                const star = new THREE.Mesh(starGeo, starMat);
                star.position.set(topic.pos.x, topic.pos.y, topic.pos.z);
                star.userData = { ...topic, categoryKey: key };
                categoryGroup.add(star);
                this.#objects.stars.push(star);
                points.push(star.position);
            });

            // Draw lines between stars in constellation
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeo, lineMat);
            categoryGroup.add(line);
        }
    }
    
    #onResize = () => {
        this.#camera.aspect = this.#canvas.clientWidth / this.#canvas.clientHeight;
        this.#camera.updateProjectionMatrix();
        this.#renderer.setSize(this.#canvas.clientWidth, this.#canvas.clientHeight);
    }
    
    #onMouseMove = (event) => {
        const rect = this.#canvas.getBoundingClientRect();
        this.#mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.#mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    #onClick = () => {
        if (this.#intersected) {
            this.#showInfoPanel(this.#intersected.userData);
        } else {
            this.#infoPanel.classList.add('hidden');
        }
    }
    
    #showInfoPanel(topicData) {
        this.#infoPanel.classList.remove('hidden');
        document.getElementById('info-panel-title').textContent = topicData.name;
        document.getElementById('info-panel-desc').textContent = topicData.description;
        const level = getCurrentLevel(topicData.name);
        document.getElementById('info-panel-level').textContent = `LVL ${level}`;

        const quizBtn = document.getElementById('info-panel-quiz-btn');
        quizBtn.onclick = () => {
            const descriptor = level >= 40 ? "Expert" : "Beginner"; // Simplified
            const prompt = `Create a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicData.name}". The difficulty should be for a user at Level ${level} of ${MAX_LEVEL} (${descriptor}).`;
            const quizContext = { topicName: topicData.name, level, returnHash: '#home', isLeveled: true, prompt, generationType: 'quiz' };
            startQuizFlow(quizContext);
        };
        
        const studyBtn = document.getElementById('info-panel-study-btn');
        studyBtn.onclick = () => {
             const prompt = `Generate a concise study guide about "${topicData.name}".`;
             const quizContext = { topicName: topicData.name, returnHash: '#home', prompt, generationType: 'study' };
             sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
             window.location.hash = '#loading';
        };
    }

    #animate = () => {
        requestAnimationFrame(this.#animate);

        this.#controls.update();

        // Raycasting for hover effect
        this.#raycaster.setFromCamera(this.#mouse, this.#camera);
        const intersects = this.#raycaster.intersectObjects(this.#objects.stars);

        if (intersects.length > 0) {
            if (this.#intersected !== intersects[0].object) {
                if (this.#intersected) {
                    this.#intersected.scale.set(1, 1, 1);
                }
                this.#intersected = intersects[0].object;
                this.#intersected.scale.set(1.5, 1.5, 1.5);
                this.#canvas.style.cursor = 'pointer';
            }
        } else {
            if (this.#intersected) {
                this.#intersected.scale.set(1, 1, 1);
            }
            this.#intersected = null;
            this.#canvas.style.cursor = 'grab';
        }
        
        const elapsedTime = this.#clock.getElapsedTime();
        this.#objects.constellations.forEach((group, i) => {
            group.rotation.y = elapsedTime * 0.05 * (i % 2 === 0 ? 1 : -1);
        });

        this.#renderer.render(this.#scene, this.#camera);
    }

    destroy() {
        window.removeEventListener('resize', this.#onResize);
        this.#canvas.removeEventListener('mousemove', this.#onMouseMove);
        this.#canvas.removeEventListener('click', this.#onClick);
        this.#controls.dispose();
        // Additional cleanup for Three.js objects if needed
    }
}

// Minimal OrbitControls for camera interaction
(function(){function r(a,b){if(a.length!=b.length)return!1;for(var c=0;c<a.length;c++)if(a[c]!==b[c])return!1;return!0}function v(a){return a.slice().sort(function(a,b){return a-b})}function x(a,b,c){var d=Math.abs(a-b),e=Math.abs(b-c),g=Math.abs(a-c);return d<e?e<g?c:b:d<g?a:b}var y=[1,1,2,6,24,120,720,5040,40320,362880,3628800,39916800,479001600,6227020800,87178291200,1307674368E3,20922789888E3,355687428096E3,6402373705728E3,121645100408832E3,243290200817664E4],
z=function(){function a(){}a.prototype.set=function(b){return Object.assign(this,b),this};return a}();THREE.OrbitControls=function(a,b){function c(a){a.preventDefault(),a.stopPropagation()}function d(a){a.preventDefault(),a.stopPropagation()}function e(a){a.preventDefault()}function g(a,b,c){var d;return function(){var e=this,g=arguments,h=c&&!d;clearTimeout(d),d=setTimeout(function(){d=null,c||a.apply(e,g)},b),h&&a.apply(e,g)}}function h(){return Math.pow(.95,na.zoomSpeed)}function l(a){ma.theta+=a}function n(a){ma.phi+=
a}function p(a){switch(a.type){case"touchstart":w=a.touches.length;break;case"touchend":case"touchcancel":w=a.touches.length;break;case"touchmove":w=a.touches.length;break;default:w=0}var b;switch(w){case 1:b=a.touches[0].pageX,a=a.touches[0].pageY;break;case 2:var c=a.touches[0].pageX,d=a.touches[0].pageY,e=a.touches[1].pageX,g=a.touches[1].pageY;b=(c+e)/2,a=(d+g)/2;break;default:b=a.pageX,a=a.pageY}return{x:b,y:a}}this.object=a,this.domElement=b,this.domElement.style.touchAction=
"none",this.enabled=!0,this.target=new THREE.Vector3,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",
RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN},this.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this.getPolarAngle=function(){return ma.phi},this.getAzimuthalAngle=function(){return ma.theta},this.getDistance=function(){return this.object.position.distanceTo(this.target)},this.saveState=function(){na.target0.copy(na.target),
na.position0.copy(na.object.position),na.zoom0=na.object.zoom},this.reset=function(){na.target.copy(na.target0),na.object.position.copy(na.position0),na.object.zoom=na.zoom0,na.object.updateProjectionMatrix(),na.dispatchEvent(A),na.update(),t=u},this.update=function(){var b=new THREE.Vector3,c=new THREE.Quaternion,d=(new THREE.Vector3,new THREE.Vector3),e=2*Math.PI;return function(){var g=na.object.position;b.copy(g).sub(na.target),b.applyQuaternion(c.setFromUnitVectors(na.object.up,new THREE.Vector3(0,
1,0))),ma.radius=b.length(),ma.theta=Math.atan2(b.x,b.z),ma.phi=Math.acos(THREE.MathUtils.clamp(b.y/ma.radius,-1,1)),na.autoRotate&&t!==B&&l(2*Math.PI/60/60*na.autoRotateSpeed),ma.theta<na.minAzimuthAngle?ma.theta=na.minAzimuthAngle:ma.theta>na.maxAzimuthAngle&&(ma.theta=na.maxAzimuthAngle),ma.phi=Math.max(na.minPolarAngle,Math.min(na.maxPolarAngle,ma.phi)),ma.makeSafe();var h=ma.radius*Math.sin(ma.phi)*Math.sin(ma.theta),p=ma.radius*Math.cos(ma.phi),q=ma.radius*Math.sin(ma.phi)*Math.cos(ma.theta);
return b.set(h,p,q),b.applyQuaternion(c),g.copy(na.target).add(b),na.object.lookAt(na.target),!0===na.enableDamping?(d.set(0,0,0),d.lerp(b,na.dampingFactor)):g.distanceToSquared(pa)>.000001&&(na.dispatchEvent(A),pa.copy(g),!0)}}(),this.dispose=function(){na.domElement.removeEventListener("contextmenu",e),na.domElement.removeEventListener("pointerdown",F),na.domElement.removeEventListener("pointercancel",G),na.domElement.removeEventListener("wheel",J),na.domElement.removeEventListener("touchstart",
H,{passive:!1}),na.domElement.removeEventListener("touchend",I),na.domElement.removeEventListener("touchmove",K,{passive:!1}),na.domElement.ownerDocument.removeEventListener("pointermove",L),na.domElement.ownerDocument.removeEventListener("pointerup",M)},this.domElement.addEventListener("contextmenu",e);var t=D,w=0,A={type:"change"},B={type:"start"},C={type:"end"},D=-1,E=0,F=function(a){na.enabled&&(na.domElement.ownerDocument.addEventListener("pointermove",L),na.domElement.ownerDocument.addEventListener("pointerup",
M),na.domElement.setPointerCapture(a.pointerId),na.dispatchEvent(B))},G=function(){},H=function(a){na.enabled&&(a.preventDefault(),a.touches.length)},I=function(){},J=function(a){na.enabled&&na.enableZoom&&(a.preventDefault(),a.stopPropagation(),na.dispatchEvent(B),function(a){a.deltaY<0?D.set(0,0,na.object.zoom*h()):a.deltaY>0&&(D.set(0,0,na.object.zoom/h())),D.applyQuaternion(na.object.quaternion),na.object.position.add(D),na.update()}(a),na.dispatchEvent(C))},K=function(a){na.enabled&&
(a.preventDefault(),a.stopPropagation(),na.dispatchEvent(B),function(a){var b=p(a);na.object.position.add(D.set((b.x-E.x)/na.domElement.clientWidth*na.panSpeed,0,0)),E.copy(b),na.update()}(a),na.dispatchEvent(C))},L=function(a){if(na.enabled){var b=p(a);E.copy(b)}},M=function(){na.enabled&&(na.domElement.releasePointerCapture(event.pointerId),na.domElement.ownerDocument.removeEventListener("pointermove",L),na.domElement.ownerDocument.removeEventListener("pointerup",M),na.dispatchEvent(C))};
this.domElement.addEventListener("pointerdown",F),this.domElement.addEventListener("pointercancel",G),this.domElement.addEventListener("wheel",J,{passive:!1}),this.domElement.addEventListener("touchstart",H,{passive:!1}),this.domElement.addEventListener("touchend",I),this.domElement.addEventListener("touchmove",K,{passive:!1});var ma=new THREE.Spherical,na=this,pa=new THREE.Vector3,qa=new THREE.Vector2,ra=new THREE.Vector2,sa=new THREE.Vector2,ta=new THREE.Vector2,ua=new THREE.Vector2,va=new THREE.Vector2,
wa=new THREE.Vector2,xa=new THREE.Vector2,ya=new THREE.Vector2,za=new THREE.Vector3,Aa=new THREE.Vector3,Ba=new THREE.Vector3,Ca=new THREE.Vector3;this.update()};THREE.OrbitControls.prototype=Object.create(THREE.EventDispatcher.prototype),THREE.OrbitControls.prototype.constructor=THREE.OrbitControls;}());
