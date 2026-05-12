import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { LocomotionSystem } from './systems/LocomotionSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { EchoShaderSystem } from './shaders/EchoShaderSystem.js';
import { CaveBuilder } from './environment/CaveBuilder.js';
import { CaveMaterials } from './environment/CaveMaterials.js';
import { ObjectPlacer } from './environment/ObjectPlacer.js';
import { EnvironmentAnimator } from './environment/EnvironmentAnimator.js';
import { CityBuilder } from './environment/CityBuilder.js';
import { CityMaterials } from './environment/CityMaterials.js';
import { CitySkySphere } from './environment/CitySkySphere.js';
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
let environmentAnimator, citySkySphere;
let currentSceneType = 'cave';
let composer;
let lastTime = performance.now();
let isRegularVision = false;
let realWorldLights;
let bloomPass;

let echoTargets = [];
// Sprint B: stored light references (no scene.traverse needed)
let featureLights = [];

// Subtle polish state
let onboardingMesh = null;
let firstPingFired = false;
let firstPingTime = 0;
let bloomPulse = 0; // Decaying bloom spike on ping fire

// Wait for scene selection before starting
window.addEventListener('sceneSelected', (e) => {
    currentSceneType = e.detail.scene;
    init();
    animate();
});

function buildEnvironment(scene) {
    if (currentSceneType === 'city') {
        // ── City Scene ──────────────────────────────────
        scene.fog = new THREE.FogExp2(0x000208, 0.015);
        scene.background = new THREE.Color(0x000208);

        const cityMats = new CityMaterials();
        const cityBuilder = new CityBuilder(echoShaderSystem);
        window._cityBuilder = cityBuilder;
        cityBuilder.build(scene, cityMats);

        echoTargets = cityBuilder.getEchoTargets();
        featureLights = cityBuilder.getFeatureLights();

        echoTargets.forEach(t => {
            if (t.userData && t.userData.echoMaterial) t.material = t.userData.echoMaterial;
        });

        // Sky sphere (shown only in lit mode)
        citySkySphere = new CitySkySphere(scene);

        // Start ambient city audio (2 low, localized sources)
        const cityAudioSources = cityBuilder.getAudioSourceConfigs();
        // audio wired after EchoAudioSystem init in init()
        window._pendingCityAudio = cityAudioSources;

    } else {
        // ── Cave Scene ──────────────────────────────────
        scene.fog = new THREE.FogExp2(0x000005, 0.06);
        scene.background = new THREE.Color(0x000005);

        caveBuilder = new CaveBuilder(echoShaderSystem);
        environmentAnimator = new EnvironmentAnimator();
        const caveMaterials = new CaveMaterials();
        caveBuilder.build(scene, caveMaterials);

        objectPlacer = new ObjectPlacer(echoShaderSystem, caveBuilder);
        objectPlacer.build(scene, caveMaterials, environmentAnimator);

        echoTargets = caveBuilder.getEchoTargets();
        echoTargets.forEach(t => {
            if (t.userData && t.userData.echoMaterial) t.material = t.userData.echoMaterial;
        });
        featureLights = objectPlacer.getFeatureLights();
    }
}

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG_DARK);
    scene.fog = new THREE.FogExp2(SCENE_BG_DARK, ECHO_FOG_DENSITY);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.03);
    scene.add(ambientLight);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 0); // Eye height above dolly

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // Scene-specific spawn point applied after locomotion is created
    // City: street-level at the N-S/E-W intersection center
    // Cave: default at origin
    window._spawnPoint = currentSceneType === 'city'
        ? new THREE.Vector3(0, 0, 0)
        : new THREE.Vector3(0, 0, 0);

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

    // --- Build environment (scene-aware) ---
    locomotion = new LocomotionSystem(camera, renderer);
    scene.add(locomotion.getDolly());

    // City: spawn at street-level center, facing north (into the scene)
    if (currentSceneType === 'city') {
        locomotion.getDolly().position.set(0, 0, 3); // Slightly south of center, on N-S street
        locomotion.getDolly().rotation.y = 0;        // Facing north (into city blocks)
    }

    echoShaderSystem = new EchoShaderSystem(scene);

    buildEnvironment(scene);

    // --- Collision system ---
    collisionSystem = new CollisionSystem();
    collisionSystem.addColliders(...(caveBuilder || window._cityBuilder).getColliders());
    // Override roomBounds with scene-specific ones
    if (currentSceneType === 'city') {
        collisionSystem.roomBounds = window._cityBuilder.roomBounds;
    }
    locomotion.setCollisionSystem(collisionSystem);

    // --- Facilitator Mode / Regular Vision ---
    realWorldLights = new THREE.Group();
    if (currentSceneType === 'city') {
        // City night: soft moonlight + distributed warm street fills
        const moonAmbient = new THREE.AmbientLight(0x1a2040, 0.6);
        realWorldLights.add(moonAmbient);
        const hemi = new THREE.HemisphereLight(0x203060, 0x0a0a10, 0.5);
        realWorldLights.add(hemi);
        // 4 fill lights spread across the 2×3 grid
        [[-15,-30],[15,-30],[-15,15],[15,15]].forEach(([x,z]) => {
            const fl = new THREE.PointLight(0xffd080, 0.6, 35, 2);
            fl.position.set(x, 8, z);
            realWorldLights.add(fl);
        });
    } else {
        // Cave: coloured atmospheric lights per room
        const hemiLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.4);
        realWorldLights.add(hemiLight);
        const headlamp = new THREE.PointLight(0xffffff, 1.5, 30);
        camera.add(headlamp);
        const blueLight  = new THREE.PointLight(0x0044ff, 2.0, 40); blueLight.position.set(10,5,-15);  realWorldLights.add(blueLight);
        const pinkLight  = new THREE.PointLight(0xff0088, 2.0, 40); pinkLight.position.set(-10,5,-5);  realWorldLights.add(pinkLight);
        const crystalLight = new THREE.PointLight(0x4488ff, 3.0, 25); crystalLight.position.set(0,4,-25); realWorldLights.add(crystalLight);
        const lakeLight  = new THREE.PointLight(0x00aaaa, 2.5, 30); lakeLight.position.set(0,1,22);    realWorldLights.add(lakeLight);
        const batLight   = new THREE.PointLight(0xff6633, 1.5, 20); batLight.position.set(-22,6,0);    realWorldLights.add(batLight);
        const tunnelLight= new THREE.PointLight(0x9966cc, 1.5, 25); tunnelLight.position.set(22,3,0);  realWorldLights.add(tunnelLight);
    }

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
            if (currentSceneType === 'city') {
                // City: transparent bg in lit mode so sky sphere shows; dark in echo
                scene.background = isRegularVision ? null : new THREE.Color(0x000208);
                scene.fog.color.setHex(isRegularVision ? 0x081830 : 0x000208);
                scene.fog.density = isRegularVision ? 0.008 : 0.015;
                if (citySkySphere) isRegularVision ? citySkySphere.show() : citySkySphere.hide();
            } else {
                scene.background.setHex(isRegularVision ? SCENE_BG_LIT : SCENE_BG_DARK);
                scene.fog.color.setHex(isRegularVision ? SCENE_BG_LIT : SCENE_BG_DARK);
                scene.fog.density = isRegularVision ? LIT_FOG_DENSITY : ECHO_FOG_DENSITY;
            }

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

            // Toggle feature lights (city lamps or cave crystals/fungi)
            const isVR = renderer.xr.isPresenting;
            featureLights.forEach(light => {
                if (isRegularVision) {
                    if (light.userData._isCityLamp) {
                        light.intensity = isVR ? 0.8 : 1.2; // Warm street lamp
                    } else {
                        light.intensity = (isVR && light.userData._isFungiLight) ? 0 : (light.userData._isCrystalLight ? 2.0 : 0.8);
                    }
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

    // Wire ping callback for polish effects
    pingSystem.onPing = (isLowFreq) => {
        bloomPulse = isLowFreq ? 0.8 : 1.0; // Stronger pulse for high-freq pings
        if (!firstPingFired) {
            firstPingFired = true;
            firstPingTime = performance.now();
        }
    };

    // Sprint B: co-locate audio sources with ObjectPlacer mesh positions
    const audioSources = (objectPlacer ? objectPlacer.getAudioSourceConfigs() : []);
    if (currentSceneType === 'city') {
        const cityAudio = window._pendingCityAudio || [];
        echoAudioSystem.startAmbientSources(cityAudio);
    } else {
        // Add a few independent cave drips not tied to specific objects
        audioSources.push(
            { type: 'drip',   position: new THREE.Vector3(-8, 6, -6),      rate: 2.2 },
            { type: 'drip',   position: new THREE.Vector3(6,  7, -10),     rate: 0.9 },
            { type: 'drip',   position: new THREE.Vector3(-3, 5, 8),       rate: 3.5 },
            { type: 'stream', position: new THREE.Vector3(-14, 0.5, -8),   intensity: 0.5 },
        );
        echoAudioSystem.startAmbientSources(audioSources);
    }

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
    onboardingMesh = new THREE.Mesh(planeGeo, planeMat);
    onboardingMesh.position.set(0, 0, -3);
    locomotion.getDolly().add(onboardingMesh);

    // Desktop cooldown HUD — radial arc showing ping readiness
    const cooldownHud = document.createElement('canvas');
    cooldownHud.id = 'cooldown-hud';
    cooldownHud.width = 80;
    cooldownHud.height = 80;
    cooldownHud.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);pointer-events:none;opacity:0.6;z-index:10;';
    document.body.appendChild(cooldownHud);

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
    if (citySkySphere) citySkySphere.update(dt);

    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
    if (echoShaderSystem) echoShaderSystem.update(dt, playerPos);

    // --- Onboarding fade: dissolve after first ping ---
    if (onboardingMesh && firstPingFired) {
        const elapsed = (now - firstPingTime) / 1000;
        if (elapsed > 2) {
            const fade = 1 - Math.min(1, (elapsed - 2) / 2); // 2s delay then 2s fade
            onboardingMesh.material.opacity = fade;
            if (fade <= 0) {
                onboardingMesh.parent.remove(onboardingMesh);
                onboardingMesh = null;
            }
        }
    }

    // --- Bloom pulse: brief spike decaying back to baseline ---
    if (bloomPass && bloomPulse > 0) {
        bloomPulse *= 0.92; // Exponential decay
        if (bloomPulse < 0.01) bloomPulse = 0;
        const baseStrength = isRegularVision ? LIT_BLOOM_STRENGTH : ECHO_BLOOM_STRENGTH;
        bloomPass.strength = baseStrength + bloomPulse * 1.5;
    }

    // --- Desktop cooldown HUD ---
    if (!renderer.xr.isPresenting && pingSystem) {
        const hudCanvas = document.getElementById('cooldown-hud');
        if (hudCanvas) {
            const ctx2 = hudCanvas.getContext('2d');
            ctx2.clearRect(0, 0, 80, 80);
            const ratio = Math.max(0, 1 - (pingSystem.cooldown / pingSystem.highFreqCooldown));
            const ready = ratio >= 1;
            ctx2.beginPath();
            ctx2.arc(40, 40, 28, -Math.PI/2, -Math.PI/2 + ratio * Math.PI * 2);
            ctx2.strokeStyle = ready ? 'rgba(0,255,255,0.7)' : 'rgba(255,80,80,0.5)';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            // Small center dot
            ctx2.beginPath();
            ctx2.arc(40, 40, 3, 0, Math.PI * 2);
            ctx2.fillStyle = ready ? 'rgba(0,255,255,0.8)' : 'rgba(255,80,80,0.4)';
            ctx2.fill();
        }
    }

    if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
    } else {
        composer.render();
    }
}
