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
        this.speed = 1.5;       // m/s walk speed
        this.turnSpeed = 1.2;   // rad/s continuous turn speed
        this.isMoving = false;

        // Collision system reference (set after init)
        this.collisionSystem = null;

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

    setCollisionSystem(collisionSystem) {
        this.collisionSystem = collisionSystem;
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

        // Pointer lock for natural FPS-style look
        this.camera.rotation.order = 'YXZ';
        this.pointerLocked = false;

        this.renderer.domElement.addEventListener('click', () => {
            if (!this.renderer.xr.isPresenting && !this.pointerLocked) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
        });

        window.addEventListener('mousemove', (e) => {
            if (this.pointerLocked && !this.renderer.xr.isPresenting) {
                this.camera.rotation.y -= e.movementX * 0.002;
                this.camera.rotation.x -= e.movementY * 0.002;
                this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
            }
        });

        // Headbob state
        this._bobTimer = 0;
        this._bobAmplitude = 0;
    }

    update(dt) {
        if (this.renderer.xr.isPresenting) {
            this.updateVR(dt);
        } else {
            this.updateDesktop(dt);
        }

        // Apply floor tracking after movement
        if (this.collisionSystem) {
            this.collisionSystem.snapToFloor(this.dolly, dt);
            // Hard boundary safety net
            this.collisionSystem.clampToBounds(this.dolly);
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
                                // Use world quaternion so dolly rotation is included.
                                // camera.quaternion is LOCAL (only headset tilt/pan relative
                                // to the dolly). After continuous turning, the dolly has rotated
                                // but the local quat hasn't changed — getWorldQuaternion() combines both.
                                const worldQuat = new THREE.Quaternion();
                                this.camera.getWorldQuaternion(worldQuat);

                                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
                                forward.y = 0;
                                forward.normalize();

                                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuat);
                                right.y = 0;
                                right.normalize();

                                const desiredDelta = new THREE.Vector3();
                                desiredDelta.addScaledVector(forward, -y * this.speed * dt);
                                desiredDelta.addScaledVector(right, x * this.speed * dt);

                                const allowed = this.collisionSystem
                                    ? this.collisionSystem.constrainMovement(this.dolly, desiredDelta, dt)
                                    : desiredDelta;

                                this.dolly.position.add(allowed);
                            }

                            if (source.handedness === 'right') {
                                // Continuous turn: rotate proportional to stick deflection × turnSpeed × dt
                                if (Math.abs(x) > 0.2) {
                                    this.dolly.rotation.y -= x * this.turnSpeed * dt;
                                }
                            }
                        }
                    }
                }
            }
        }
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

        const desiredDelta = new THREE.Vector3();

        if (this.keys.w) { desiredDelta.addScaledVector(forward, moveDist); moved = true; }
        if (this.keys.s) { desiredDelta.addScaledVector(forward, -moveDist); moved = true; }
        if (this.keys.a) { desiredDelta.addScaledVector(right, -moveDist); moved = true; }
        if (this.keys.d) { desiredDelta.addScaledVector(right, moveDist); moved = true; }

        if (moved) {
            const allowed = this.collisionSystem
                ? this.collisionSystem.constrainMovement(this.dolly, desiredDelta, dt)
                : desiredDelta;
            this.dolly.position.add(allowed);
        }

        if (this.keys.q) { this.dolly.rotation.y += this.turnSpeed * dt; }
        if (this.keys.e) { this.dolly.rotation.y -= this.turnSpeed * dt; }

        // Subtle headbob when walking — increases embodiment
        const targetBob = moved ? 0.012 : 0;
        this._bobAmplitude = THREE.MathUtils.lerp(this._bobAmplitude, targetBob, dt * 6);
        if (this._bobAmplitude > 0.001) {
            this._bobTimer += dt * 8;
            this.camera.position.y = 1.6 + Math.sin(this._bobTimer) * this._bobAmplitude;
        } else {
            this._bobTimer = 0;
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 1.6, dt * 6);
        }

        this.isMoving = moved;
    }
}
