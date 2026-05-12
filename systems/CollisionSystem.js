import * as THREE from 'three';

/**
 * Raycaster-based collision system for the cave environment.
 *
 * Wall collision:  8 horizontal rays (45° apart) from chest height.
 *                  Movement is projected along the collision normal ("wall slide").
 * Floor tracking:  1 downward ray snaps the player Y to the terrain surface.
 * Ceiling check:   1 upward ray prevents clipping through low overhangs.
 *
 * Performance: 10 raycasts/frame with short far distances — negligible cost.
 */
export class CollisionSystem {
    constructor() {
        this.colliders = [];

        this.raycaster = new THREE.Raycaster();

        // --- tunables ---
        this.wallCheckDistance = 0.55;   // How far ahead to check for walls (metres)
        this.wallCheckHeight   = 0.9;   // Ray origin height above dolly base (chest level)
        this.floorCheckHeight  = 10.0;  // How far above to start the floor ray
        this.ceilingClearance  = 1.8;   // Min gap between floor and ceiling before blocking
        this.playerHeight      = 1.6;   // Standing eye height above floor
        this.floorSmoothSpeed  = 8.0;   // Lerp speed for Y tracking (higher = snappier)

        // 8 cardinal + ordinal directions on XZ
        this._wallDirs = [];
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            this._wallDirs.push(new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)));
        }

        this._tempVec = new THREE.Vector3();
        this._down = new THREE.Vector3(0, -1, 0);
        this._up   = new THREE.Vector3(0, 1, 0);
    }

    /**
     * Register meshes as collision geometry.
     * @param {...THREE.Mesh} meshes
     */
    addColliders(...meshes) {
        meshes.forEach(m => {
            if (m) this.colliders.push(m);
        });
    }

    /**
     * Constrain a proposed movement delta so the dolly cannot pass through colliders.
     * Returns a new (possibly shortened / redirected) delta.
     *
     * @param {THREE.Group} dolly           The camera dolly
     * @param {THREE.Vector3} desiredDelta  Proposed movement this frame (world space)
     * @param {number} dt                   Frame delta time
     * @returns {THREE.Vector3}             The allowed movement delta
     */
    constrainMovement(dolly, desiredDelta, dt) {
        if (this.colliders.length === 0) return desiredDelta;

        const allowed = desiredDelta.clone();

        // --- Wall collision (XZ plane) ---
        const origin = this._tempVec.copy(dolly.position);
        origin.y += this.wallCheckHeight;

        // Also check in the direction of movement
        const moveDir = new THREE.Vector3(allowed.x, 0, allowed.z);
        const moveLen = moveDir.length();

        if (moveLen > 0.0001) {
            moveDir.normalize();

            this.raycaster.set(origin, moveDir);
            this.raycaster.far = this.wallCheckDistance;
            const hits = this.raycaster.intersectObjects(this.colliders, false);

            if (hits.length > 0) {
                const hit = hits[0];
                // Slide along the wall: project movement onto the wall tangent
                const normal = hit.face
                    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
                    : moveDir.clone().negate();
                normal.y = 0;
                normal.normalize();

                // Remove the component of movement going into the wall
                const dot = allowed.x * normal.x + allowed.z * normal.z;
                if (dot < 0) {
                    allowed.x -= normal.x * dot;
                    allowed.z -= normal.z * dot;
                }
            }
        }

        // Radial safety: cast the 8 fixed directions to prevent getting pushed into walls
        for (const dir of this._wallDirs) {
            this.raycaster.set(origin, dir);
            this.raycaster.far = this.wallCheckDistance * 0.7;
            const hits = this.raycaster.intersectObjects(this.colliders, false);
            if (hits.length > 0 && hits[0].distance < this.wallCheckDistance * 0.5) {
                const normal = hits[0].face
                    ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld).normalize()
                    : dir.clone().negate();
                normal.y = 0;
                normal.normalize();

                // Push-back: nudge the allowed delta away from the wall
                const penetration = this.wallCheckDistance * 0.5 - hits[0].distance;
                allowed.x += normal.x * penetration * 0.5;
                allowed.z += normal.z * penetration * 0.5;
            }
        }

        return allowed;
    }

    /**
     * Snap the dolly's Y position to the floor surface, smoothed.
     *
     * @param {THREE.Group} dolly
     * @param {number} dt
     */
    snapToFloor(dolly, dt) {
        if (this.colliders.length === 0) return;

        const origin = this._tempVec.set(
            dolly.position.x,
            dolly.position.y + this.floorCheckHeight,
            dolly.position.z
        );

        this.raycaster.set(origin, this._down);
        this.raycaster.far = this.floorCheckHeight + 5;
        const hits = this.raycaster.intersectObjects(this.colliders, false);

        if (hits.length > 0) {
            // Find the highest floor hit (ignore ceiling hits which would be far away)
            let bestY = -Infinity;
            for (const h of hits) {
                const hitY = h.point.y;
                // Only consider hits below the ray origin (i.e. actual floor surfaces)
                if (hitY < origin.y && hitY > bestY) {
                    bestY = hitY;
                }
            }
            if (bestY > -Infinity) {
                const targetY = bestY;
                dolly.position.y = THREE.MathUtils.lerp(
                    dolly.position.y,
                    targetY,
                    Math.min(1, this.floorSmoothSpeed * dt)
                );
            }
        }

        // --- Ceiling check ---
        const ceilingOrigin = this._tempVec.set(
            dolly.position.x,
            dolly.position.y + 0.1,
            dolly.position.z
        );
        this.raycaster.set(ceilingOrigin, this._up);
        this.raycaster.far = this.ceilingClearance + this.playerHeight;
        const ceilHits = this.raycaster.intersectObjects(this.colliders, false);

        if (ceilHits.length > 0) {
            const ceilY = ceilHits[0].point.y;
            const maxY = ceilY - this.playerHeight - 0.1;
            if (dolly.position.y > maxY) {
                dolly.position.y = maxY;
            }
        }
    }
}
