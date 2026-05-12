import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { LocomotionSystem } from './systems/LocomotionSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { EchoShaderSystem } from './shaders/EchoShaderSystem.js';
import { CaveBuilder } from './environment/CaveBuilder.js';
import { CaveMaterials } from './environment/CaveMaterials.js';
import { ObjectPlacer } from './environment/ObjectPlacer.js';
import { EnvironmentAnimator } from './environment/EnvironmentAnimator.js';
import { PingSystem } from './systems/PingSystem.js';
import { EchoAudioSystem } from './audio/EchoAudioSystem.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- Tunable constants (Sprint C: parameterize magic numbers) ---
const ECHO_FOG_DENSITY = 0.06;
const LIT_FOG_DENSITY = 0.02;
const ECHO_BLOOM_THRESHOLD = 0.05;
const ECHO_BLOOM_STRENGTH = 1.2;
const LIT_BLOOM_THRESHOLD = 0.8;
const LIT_BLOOM_STRENGTH = 0.6;
const SCENE_BG_DARK = 0x000005;
const SCENE_BG_LIT = 0x060812;

let scene, camera, renderer, locomotion, collisionSystem;
let echoShaderSystem, caveBuilder, objectPlacer, pingSystem, echoAudioSystem;
let environmentAnimator;
let composer;
let lastTime = performance.now();
let isRegularVision = false;
let realWorldLights;
let bloomPass;

let echoTargets = [];
// Sprint B: stored light references (no scene.traverse needed)
let featureLights = [];

init();
animate();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG_DARK);
    scene.fog = new THREE.FogExp2(SCENE_BG_DARK, ECHO_FOG_DENSITY);

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
    bloomPass.threshold = ECHO_BLOOM_THRESHOLD;
    bloomPass.strength = ECHO_BLOOM_STRENGTH;
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

    // --- Build environment ---
    locomotion = new LocomotionSystem(camera, renderer);
    scene.add(locomotion.getDolly());

    echoShaderSystem = new EchoShaderSystem(scene);
    caveBuilder = new CaveBuilder(echoShaderSystem);
    environmentAnimator = new EnvironmentAnimator();

    const caveMaterials = new CaveMaterials();

    caveBuilder.build(scene, caveMaterials);

    objectPlacer = new ObjectPlacer(echoShaderSystem, caveBuilder);
    objectPlacer.build(scene, caveMaterials, environmentAnimator);

    echoTargets = caveBuilder.getEchoTargets();

    // Sprint B: Collect crystal/fungi light references from ObjectPlacer
    featureLights = objectPlacer.getFeatureLights();

    // --- Collision system ---
    collisionSystem = new CollisionSystem();
    collisionSystem.addColliders(...caveBuilder.getColliders());
    locomotion.setCollisionSystem(collisionSystem);

    // --- Facilitator Mode / Regular Vision ---
    realWorldLights = new THREE.Group();
    const hemiLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.4);
    realWorldLights.add(hemiLight);

    const headlamp = new THREE.PointLight(0xffffff, 1.5, 30);
    camera.add(headlamp);

    // Atmospheric room lights for lights-on mode
    const blueLight = new THREE.PointLight(0x0044ff, 2.0, 40);
    blueLight.position.set(10, 5, -15);
    realWorldLights.add(blueLight);

    const pinkLight = new THREE.PointLight(0xff0088, 2.0, 40);
    pinkLight.position.set(-10, 5, -5);
    realWorldLights.add(pinkLight);

    // Crystal grotto accent light
    const crystalLight = new THREE.PointLight(0x4488ff, 3.0, 25);
    crystalLight.position.set(0, 4, -25);
    realWorldLights.add(crystalLight);

    // Lake room water glow
    const lakeLight = new THREE.PointLight(0x00aaaa, 2.5, 30);
    lakeLight.position.set(0, 1, 22);
    realWorldLights.add(lakeLight);

    // Bat alcove warm tone
    const batLight = new THREE.PointLight(0xff6633, 1.5, 20);
    batLight.position.set(-22, 6, 0);
    realWorldLights.add(batLight);

    // Tunnel atmosphere
    const tunnelLight = new THREE.PointLight(0x9966cc, 1.5, 25);
    tunnelLight.position.set(22, 3, 0);
    realWorldLights.add(tunnelLight);

    realWorldLights.visible = false;
    scene.add(realWorldLights);

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'l') {
            isRegularVision = !isRegularVision;
            realWorldLights.visible = isRegularVision;

            if (bloomPass) {
                bloomPass.threshold = isRegularVision ? LIT_BLOOM_THRESHOLD : ECHO_BLOOM_THRESHOLD;
                bloomPass.strength = isRegularVision ? LIT_BLOOM_STRENGTH : ECHO_BLOOM_STRENGTH;
            }

            // Sprint C: toggle scene background and fog
            scene.background.setHex(isRegularVision ? SCENE_BG_LIT : SCENE_BG_DARK);
            scene.fog.color.setHex(isRegularVision ? SCENE_BG_LIT : SCENE_BG_DARK);
            scene.fog.density = isRegularVision ? LIT_FOG_DENSITY : ECHO_FOG_DENSITY;

            // Toggle echo/real materials — force DoubleSide for collision safety
            echoTargets.forEach(target => {
                if (target.userData) {
                    target.material = isRegularVision ? target.userData.realMaterial : target.userData.echoMaterial;
                    // Sprint A P0: ensure collision raycaster always works regardless of material
                    if (target.material.side !== THREE.DoubleSide) {
                        target.material.side = THREE.DoubleSide;
                    }
                }
            });

            // Sprint B: use stored refs instead of scene.traverse
            const isVR = renderer.xr.isPresenting;
            featureLights.forEach(light => {
                if (isRegularVision) {
                    // Sprint C: cap lights in VR to save perf
                    light.intensity = (isVR && light.userData._isFungiLight) ? 0 : (light.userData._isCrystalLight ? 2.0 : 0.8);
                } else {
                    light.intensity = 0;
                }
            });
        }
    });
    // -----------------------------------------

    pingSystem = new PingSystem(camera, locomotion, echoShaderSystem, echoTargets);
    echoAudioSystem = new EchoAudioSystem(camera);
    pingSystem.echoAudioSystem = echoAudioSystem;

    // Sprint B: co-locate audio sources with ObjectPlacer mesh positions
    const audioSources = objectPlacer.getAudioSourceConfigs();
    // Add a few independent cave drips not tied to specific objects
    audioSources.push(
        { type: 'drip', position: new THREE.Vector3(-8, 6, -6),  rate: 2.2 },
        { type: 'drip', position: new THREE.Vector3(6,  7, -10), rate: 0.9 },
        { type: 'drip', position: new THREE.Vector3(-3, 5, 8),   rate: 3.5 },
        { type: 'stream', position: new THREE.Vector3(-14, 0.5, -8), intensity: 0.5 },
    );
    echoAudioSystem.startAmbientSources(audioSources);

    // Sprint B: Onboarding text — head-locked to camera dolly
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
    textMesh.position.set(0, 0, -3); // In front of camera, inside dolly
    // Attach to dolly so it moves with the player (head-locked in VR)
    locomotion.getDolly().add(textMesh);

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
    if (environmentAnimator) environmentAnimator.update(dt);

    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
    if (echoShaderSystem) echoShaderSystem.update(dt, playerPos);

    if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
    } else {
        composer.render();
    }
}
