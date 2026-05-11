import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { LocomotionSystem } from './systems/LocomotionSystem.js';
import { EchoShaderSystem } from './shaders/EchoShaderSystem.js';
import { CaveBuilder } from './environment/CaveBuilder.js';
import { CaveMaterials } from './environment/CaveMaterials.js';
import { ObjectPlacer } from './environment/ObjectPlacer.js';
import { PingSystem } from './systems/PingSystem.js';
import { EchoAudioSystem } from './audio/EchoAudioSystem.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, locomotion;
let echoShaderSystem, caveBuilder, objectPlacer, pingSystem, echoAudioSystem;
let composer;
let lastTime = performance.now();
let isRegularVision = false;
let realWorldLights;
let bloomPass;

export let echoTargets = []; // We will export this for PingSystem later

init();
animate();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);
    scene.fog = new THREE.FogExp2(0x000005, 0.1);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.03);
    scene.add(ambientLight);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 0); 
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    
    const renderScene = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.05;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    document.body.appendChild(VRButton.createButton(renderer));
    
    const fallbackUI = document.getElementById('fallback-ui');
    fallbackUI.style.display = 'block';
    
    renderer.xr.addEventListener('sessionstart', () => {
        fallbackUI.style.display = 'none';
        camera.position.set(0, 0, 0);
    });
    renderer.xr.addEventListener('sessionend', () => {
        fallbackUI.style.display = 'block';
        camera.position.set(0, 1.6, 0);
    });

    locomotion = new LocomotionSystem(camera, renderer);
    scene.add(locomotion.getDolly());

    echoShaderSystem = new EchoShaderSystem(scene);
    caveBuilder = new CaveBuilder(echoShaderSystem);
    objectPlacer = new ObjectPlacer(echoShaderSystem, caveBuilder);

    const caveMaterials = new CaveMaterials();

    caveBuilder.build(scene, caveMaterials);
    objectPlacer.build(scene, caveMaterials);
    
    echoTargets = caveBuilder.getEchoTargets();
    
    // --- Facilitator Mode / Regular Vision ---
    realWorldLights = new THREE.Group();
    const hemiLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.4);
    realWorldLights.add(hemiLight);
    
    const headlamp = new THREE.PointLight(0xffffff, 1.5, 30);
    camera.add(headlamp);
    
    const blueLight = new THREE.PointLight(0x0044ff, 2.0, 40);
    blueLight.position.set(10, 5, -15);
    realWorldLights.add(blueLight);
    
    const pinkLight = new THREE.PointLight(0xff0088, 2.0, 40);
    pinkLight.position.set(-10, 5, -5);
    realWorldLights.add(pinkLight);
    
    realWorldLights.visible = false;
    scene.add(realWorldLights);
    
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'l') {
            isRegularVision = !isRegularVision;
            realWorldLights.visible = isRegularVision;
            
            if (bloomPass) {
                bloomPass.threshold = isRegularVision ? 0.8 : 0.05;
                bloomPass.strength = isRegularVision ? 0.6 : 1.2;
            }
            
            echoTargets.forEach(target => {
                if (target.userData) {
                    target.material = isRegularVision ? target.userData.realMaterial : target.userData.echoMaterial;
                }
            });
        }
    });
    // -----------------------------------------
    
    pingSystem = new PingSystem(camera, locomotion, echoShaderSystem);
    echoAudioSystem = new EchoAudioSystem(camera);
    pingSystem.echoAudioSystem = echoAudioSystem;
    
    // Register spatial ambient sound sources.
    // These are fixed-world-position HRTF sound emitters that give the
    // user passive spatial cues — demonstrating that bats use ALL environmental
    // sounds, not only their own echolocation, to orient themselves.
    echoAudioSystem.startAmbientSources([
        // A slow, isolated ceiling drip — far left, near the wall
        { type: 'drip', position: new THREE.Vector3(-8, 6, -6),  rate: 2.2 },
        // A faster drip cluster — to the right, near the archway
        { type: 'drip', position: new THREE.Vector3(6,  7, -10), rate: 0.9 },
        // Another sparse drip behind and above the player
        { type: 'drip', position: new THREE.Vector3(-3, 5, 8),   rate: 3.5 },
        // A trickling stream running along the back-left wall
        { type: 'stream', position: new THREE.Vector3(-14, 0.5, -8), intensity: 0.5 },
    ]);

    // Setup Onboarding Text
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.font = '60px sans-serif';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('It is pitch black.', 512, 100);
    ctx.fillText('Press Trigger or Spacebar to Ping.', 512, 180);
    
    const tex = new THREE.CanvasTexture(canvas);
    const planeGeo = new THREE.PlaneGeometry(4, 1);
    const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const textMesh = new THREE.Mesh(planeGeo, planeMat);
    textMesh.position.set(0, 1.5, -3);
    scene.add(textMesh);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    
    locomotion.update(dt);
    if (pingSystem) pingSystem.update(dt);
    if (echoAudioSystem) echoAudioSystem.updateListener();
    
    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
    if (echoShaderSystem) echoShaderSystem.update(dt, playerPos);
    
    if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
    } else {
        composer.render();
    }
}
