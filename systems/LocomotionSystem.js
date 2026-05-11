import * as THREE from 'three';

export class LocomotionSystem {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        
        // Setup a dolly for moving the camera around
        this.dolly = new THREE.Group();
        this.dolly.add(camera);
        
        // VR Controllers
        this.controllers = [];
        for (let i = 0; i < 2; i++) {
            const controller = renderer.xr.getController(i);
            this.dolly.add(controller);
            this.controllers.push(controller);
        }

        // State for VR movement
        this.speed = 1.5; // m/s
        this.turnAngle = Math.PI / 4; // 45 degrees
        this.isMoving = false;
        
        // Desktop fallback state
        this.keys = {
            w: false, a: false, s: false, d: false,
            q: false, e: false
        };
        
        this.setupDesktopControls();
    }
    
    getDolly() {
        return this.dolly;
    }

    setupDesktopControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
        });
        
        // Simple drag to look for desktop
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        this.camera.rotation.order = 'YXZ'; // Important for FPS camera
        
        window.addEventListener('mousedown', () => { isDragging = true; });
        window.addEventListener('mouseup', () => { isDragging = false; });
        window.addEventListener('mousemove', (e) => {
            if (isDragging && !this.renderer.xr.isPresenting) {
                const deltaMove = {
                    x: e.movementX || e.offsetX - previousMousePosition.x,
                    y: e.movementY || e.offsetY - previousMousePosition.y
                };
                
                this.camera.rotation.y -= deltaMove.x * 0.005;
                this.camera.rotation.x -= deltaMove.y * 0.005;
                
                // Clamp pitch
                this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
            }
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        });
    }

    update(dt) {
        if (this.renderer.xr.isPresenting) {
            this.updateVR(dt);
        } else {
            this.updateDesktop(dt);
        }
    }
    
    updateVR(dt) {
        let moved = false;
        const session = this.renderer.xr.getSession();
        if (session && session.inputSources) {
            for (const source of session.inputSources) {
                if (source.gamepad) {
                    const axes = source.gamepad.axes;
                    if (axes.length >= 4) {
                        const x = axes[2];
                        const y = axes[3];
                        
                        if (Math.abs(x) > 0.2 || Math.abs(y) > 0.2) {
                            moved = true;
                            if (source.handedness === 'left') {
                                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                                forward.y = 0;
                                forward.normalize();
                                
                                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                                right.y = 0;
                                right.normalize();
                                
                                this.dolly.position.addScaledVector(forward, -y * this.speed * dt);
                                this.dolly.position.addScaledVector(right, x * this.speed * dt);
                            }
                            
                            if (source.handedness === 'right') {
                                if (!this.turnCooldown) this.turnCooldown = 0;
                                if (this.turnCooldown <= 0) {
                                    if (x > 0.5) {
                                        this.dolly.rotation.y -= this.turnAngle;
                                        this.turnCooldown = 0.5;
                                    } else if (x < -0.5) {
                                        this.dolly.rotation.y += this.turnAngle;
                                        this.turnCooldown = 0.5;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (this.turnCooldown > 0) this.turnCooldown -= dt;
        this.isMoving = moved;
    }
    
    updateDesktop(dt) {
        const moveDist = this.speed * dt;
        let moved = false;
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();
        
        if (this.keys.w) { this.dolly.position.addScaledVector(forward, moveDist); moved = true; }
        if (this.keys.s) { this.dolly.position.addScaledVector(forward, -moveDist); moved = true; }
        if (this.keys.a) { this.dolly.position.addScaledVector(right, -moveDist); moved = true; }
        if (this.keys.d) { this.dolly.position.addScaledVector(right, moveDist); moved = true; }
        
        if (this.keys.q) { this.dolly.rotation.y += this.turnAngle * dt * 2; }
        if (this.keys.e) { this.dolly.rotation.y -= this.turnAngle * dt * 2; }
        
        this.isMoving = moved;
    }
}
