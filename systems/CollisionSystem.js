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
        this.wallCheckDistance = 0.8;
        this.wallCheckHeight   = 0.9;
        this.floorCheckHeight  = 2.5;    // 2.5m above dolly — covers max 1.2m terrain undulation
        this.ceilingClearance  = 1.8;
        this.playerHeight      = 1.6;
        this.floorSmoothSpeed  = 12.0;   // Snappier for city flat ground

        // Absolute minimum Y the dolly can ever be placed at.
        // Prevents falling through the floor during the first frames before geometry is loaded,
        // or if a raycast misses entirely (e.g. in a corridor gap).
        this.hardFloorMinY = -1.8;

        // 16 directions on XZ for denser wall coverage
        this._wallDirs = [];
        for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            this._wallDirs.push(new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)));
        }

        this._tempVec = new THREE.Vector3();
        this._down = new THREE.Vector3(0, -1, 0);
        this._up   = new THREE.Vector3(0, 1, 0);

        // Hard AABB safety bounds for each room + corridor.
        // These prevent the player from ever escaping the cave.
        // Corridors use wider bounds so mid-transit the player is never rejected.
        // Each entry is { minX, maxX, minZ, maxZ, minY (optional), label }
        this.roomBounds = [
            { minX: -15, maxX: 15,  minZ: -15, maxZ: 15,  label: 'main'    },
            { minX: -8,  maxX: 8,   minZ: -33, maxZ: -13, label: 'crystal' },
            { minX: -13, maxX: 13,  minZ: 9,   maxZ: 35,  label: 'lake'    },
            { minX: -28, maxX: -12, minZ: -6,  maxZ: 6,   label: 'bats'    },
            { minX: 13,  maxX: 27,  minZ: -11, maxZ: 11,  label: 'tunnel'  },
            // Corridors: wider so mid-transit the player isn't suddenly outside all bounds
            { minX: -4,  maxX: 4,   minZ: -20, maxZ: -13, label: 'corridor_crystal' },
            { minX: -19, maxX: -12, minZ: -4,  maxZ: 4,   label: 'corridor_bats'   },
            { minX: 12,  maxX: 22,  minZ: -4,  maxZ: 4,   label: 'corridor_tunnel' },
        ];
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
        // Search far = floorCheckHeight + extra to catch the undulating lake shelf (~1.2m high)
        this.raycaster.far = this.floorCheckHeight + 2.5;
        const hits = this.raycaster.intersectObjects(this.colliders, false);

        if (hits.length > 0) {
            // Find the HIGHEST floor hit below origin (the ground under the player, not a ceiling)
            let bestY = -Infinity;
            for (const h of hits) {
                const hitY = h.point.y;
                if (hitY < origin.y && hitY > bestY) {
                    bestY = hitY;
                }
            }
            if (bestY > -Infinity) {
                dolly.position.y = THREE.MathUtils.lerp(
                    dolly.position.y,
                    bestY,
                    Math.min(1, this.floorSmoothSpeed * dt)
                );
            }
        }

        // Hard floor safety net: if raycaster missed entirely, don't let player fall to infinity.
        // The lake room has cy = -1.5, so the lowest valid floor is around y = -1.8.
        if (dolly.position.y < this.hardFloorMinY) {
            dolly.position.y = this.hardFloorMinY;
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

    /**
     * Hard boundary clamp — safety net over raycaster collision.
     * If the player has somehow escaped all room AABBs, push them
     * back to the nearest valid room boundary.
     */
    clampToBounds(dolly) {
        const x = dolly.position.x;
        const z = dolly.position.z;

        // Check if inside any valid room
        for (const room of this.roomBounds) {
            if (x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ) {
                return; // Player is inside a valid area
            }
        }

        // Player is outside all rooms — find nearest room and clamp
        let bestDist = Infinity;
        let bestRoom = this.roomBounds[0];

        for (const room of this.roomBounds) {
            // Distance from player to the nearest point inside this AABB
            const clampedX = Math.max(room.minX, Math.min(room.maxX, x));
            const clampedZ = Math.max(room.minZ, Math.min(room.maxZ, z));
            const dist = (x - clampedX) ** 2 + (z - clampedZ) ** 2;
            if (dist < bestDist) {
                bestDist = dist;
                bestRoom = room;
            }
        }

        dolly.position.x = Math.max(bestRoom.minX, Math.min(bestRoom.maxX, x));
        dolly.position.z = Math.max(bestRoom.minZ, Math.min(bestRoom.maxZ, z));
    }
}
