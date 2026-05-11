import * as THREE from 'three';
import { echoTargets } from '../main.js';

export class PingSystem {
    constructor(camera, locomotionSystem, echoShaderSystem) {
        this.camera = camera;
        this.locomotion = locomotionSystem;
        this.echoShaderSystem = echoShaderSystem;
        
        this.raycaster = new THREE.Raycaster();
        
        this.cooldown = 0;
        this.highFreqCooldown = 1.5;
        this.lowFreqCooldown = 0.8;
        
        this.spacePressed = false;
        this.spacePressStart = 0;
        
        this.vrButtonStates = [false, false];
        this.vrPressStart = [0, 0];
        
        this.setupInputs();
        
        this.cooldownRings = [];
        for (let i = 0; i < 2; i++) {
            const geo = new THREE.TorusGeometry(0.05, 0.005, 8, 32);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
            const ring = new THREE.Mesh(geo, mat);
            ring.rotation.x = Math.PI / 2;
            this.cooldownRings.push(ring);
            
            if (this.locomotion.controllers && this.locomotion.controllers[i]) {
                this.locomotion.controllers[i].add(ring);
            }
        }
        
        this.debugSpheres = new THREE.Group();
        this.locomotion.getDolly().parent.add(this.debugSpheres); 
        this.debugSphereGeo = new THREE.SphereGeometry(0.1, 4, 4);
        this.debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    }
    
    setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.spacePressed) {
                this.spacePressed = true;
                this.spacePressStart = performance.now();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this.spacePressed) {
                this.spacePressed = false;
                const duration = performance.now() - this.spacePressStart;
                this.triggerPing(duration > 400); 
            }
        });
    }
    
    update(dt) {
        if (this.cooldown > 0) {
            this.cooldown -= dt;
            if (this.cooldown <= 0 && this.echoAudioSystem && this.echoAudioSystem.playReadyClick) {
                this.echoAudioSystem.playReadyClick();
            }
        }
        
        const ratio = Math.max(0, 1 - (this.cooldown / this.highFreqCooldown));
        this.cooldownRings.forEach(ring => {
            ring.material.opacity = ratio * 0.8 + 0.1;
            ring.scale.setScalar(ratio * 0.5 + 0.5);
            if (ratio >= 1.0) {
                ring.material.color.setHex(0x00ffff);
            } else {
                ring.material.color.setHex(0xff0000);
            }
        });
        
        const session = this.locomotion.renderer.xr.getSession();
        if (session && session.inputSources) {
            for (let i = 0; i < session.inputSources.length; i++) {
                const source = session.inputSources[i];
                if (source.gamepad && source.gamepad.buttons[0]) {
                    const pressed = source.gamepad.buttons[0].pressed;
                    if (pressed && !this.vrButtonStates[i]) {
                        this.vrButtonStates[i] = true;
                        this.vrPressStart[i] = performance.now();
                    } else if (!pressed && this.vrButtonStates[i]) {
                        this.vrButtonStates[i] = false;
                        const duration = performance.now() - this.vrPressStart[i];
                        this.triggerPing(duration > 400);
                    }
                }
            }
        }
    }
    
    triggerPing(isLowFreq) {
        if (this.cooldown > 0) return;
        
        this.cooldown = isLowFreq ? this.lowFreqCooldown : this.highFreqCooldown;
        
        const numRays = isLowFreq ? 90 : 240;
        const maxRange = isLowFreq ? 30.0 : 12.0;
        const forwardBiasAngles = isLowFreq ? 120 : 60;
        
        this.firePing(numRays, maxRange, forwardBiasAngles, isLowFreq);
        
        if (this.echoAudioSystem && this.echoAudioSystem.playChirp) {
            this.echoAudioSystem.playChirp(isLowFreq);
        }
        this.triggerHaptics(isLowFreq ? 1.0 : 0.6, isLowFreq ? 100 : 40);
    }
    
    triggerHaptics(intensity, durationMs) {
        const session = this.locomotion.renderer.xr.getSession();
        if (session && session.inputSources) {
            for (const source of session.inputSources) {
                if (source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators.length > 0) {
                    const actuator = source.gamepad.hapticActuators[0];
                    if (actuator.pulse) {
                        actuator.pulse(intensity, durationMs);
                    }
                }
            }
        }
    }
    
    firePing(numRays, maxRange, forwardBiasAngles, isLowFreq) {
        this.debugSpheres.clear();
        
        const cameraPos = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPos);
        
        const cameraForward = new THREE.Vector3(0, 0, -1);
        cameraForward.applyQuaternion(this.camera.quaternion).normalize();
        
        const hitData = [];
        const phiLimit = (forwardBiasAngles / 2) * (Math.PI / 180);
        
        const totalSampleRays = numRays * 3;
        let validRays = 0;
        let i = 0;
        
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angleIncrement = Math.PI * 2 * goldenRatio;
        
        while (validRays < numRays && i < totalSampleRays * 2) {
            const t = i / totalSampleRays;
            const inclination = Math.acos(1 - 2 * t);
            const azimuth = angleIncrement * i;
            
            const dir = new THREE.Vector3(
                Math.sin(inclination) * Math.cos(azimuth),
                Math.sin(inclination) * Math.sin(azimuth),
                Math.cos(inclination)
            );
            
            dir.applyQuaternion(this.camera.quaternion);
            
            const dot = dir.dot(cameraForward);
            const angleFromForward = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
            
            let accept = false;
            if (angleFromForward <= phiLimit) {
                accept = true;
            } else {
                const chance = Math.pow((1 - (angleFromForward - phiLimit) / Math.PI), 2) * 0.3;
                if (Math.random() < chance) accept = true;
            }
            
            if (accept) {
                validRays++;
                
                this.raycaster.set(cameraPos, dir);
                this.raycaster.far = maxRange;
                
                const intersects = this.raycaster.intersectObjects(echoTargets, false);
                
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    hitData.push({
                        point: hit.point.clone(),
                        distance: hit.distance,
                        normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0,1,0),
                        object: hit.object
                    });
                }
            }
            
            i++;
        }
        
        const effectiveSoundSpeed = 34;
        
        if (this.echoShaderSystem.registerPing) {
            this.echoShaderSystem.registerPing(cameraPos, cameraForward, forwardBiasAngles, maxRange, isLowFreq);
        }
        
        hitData.forEach(hit => {
            const delayMs = (hit.distance / effectiveSoundSpeed) * 1000;
            setTimeout(() => {
                if (this.echoShaderSystem.addHitPoint) {
                    this.echoShaderSystem.addHitPoint(hit, isLowFreq);
                }
                if (this.echoAudioSystem && this.echoAudioSystem.playEchoAt) {
                    this.echoAudioSystem.playEchoAt(hit, isLowFreq);
                }
                
                // Micro haptic pulse for the echo return
                // Only a very small chance per hit to prevent overwhelming the actuator
                // The overlapping calls will create a textured rumble
                if (Math.random() < 0.1) {
                    this.triggerHaptics(0.2, 10);
                }
            }, delayMs);
        });
    }
}
