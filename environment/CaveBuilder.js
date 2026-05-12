import * as THREE from 'three';

/**
 * Builds a multi-chamber cave system with connected rooms and terrain floors.
 *
 * Layout (top-down, +Z = south, -Z = north):
 *
 *              [Crystal Grotto]        z ~ -25
 *                    |
 *              narrow passage
 *                    |
 * [Bat Alcove] -- [Main Chamber] -- [Archway Tunnel]
 *   x ~ -22          0,0              x ~ +22
 *                    |
 *              wide opening
 *                    |
 *           [Underground Lake]         z ~ +22
 */
export class CaveBuilder {
    constructor(echoShaderSystem) {
        this.echoShaderSystem = echoShaderSystem;
        this.echoTargets = [];
        this.colliders = [];
    }

    build(scene, caveMaterials) {
        // Each room is an inside-out box with organic noise displacement.
        // Passages are carved by pushing vertices outward in shared-wall regions.

        const rooms = [
            this._buildRoom('main',    30, 11, 30, 0,    0,  0,    8, caveMaterials),
            this._buildRoom('crystal', 16, 8,  16, 0,    0, -25,   8, caveMaterials),
            this._buildRoom('lake',    26, 7,  26, 0,   -1.5, 22,  8, caveMaterials),
            this._buildRoom('bats',    12, 13, 12, -22,  0,  0,    8, caveMaterials),
            this._buildRoom('tunnel',  8,  7,  22, 22,   0,  0,    6, caveMaterials),
        ];

        rooms.forEach(room => {
            scene.add(room.mesh);
            this.echoTargets.push(room.mesh);
            this.colliders.push(room.mesh);

            if (room.floor) {
                scene.add(room.floor);
                this.colliders.push(room.floor);
                this.echoTargets.push(room.floor);
            }
        });

        // Fill geometric gaps between rooms with corridor connectors
        this._buildCorridors(scene, caveMaterials);
    }

    /**
     * Build inside-out box corridors to bridge gaps between rooms.
     * Main↔Crystal: 2m gap at z=-15 to z=-17
     * Main↔Bats:    1m gap at x=-15 to x=-16
     * Main↔Tunnel:  3m gap at x=15  to x=18
     * Main↔Lake:    already overlapping, no corridor needed
     */
    _buildCorridors(scene, caveMaterials) {
        const corridorDefs = [
            { w: 6, h: 7, d: 6, cx: 0,     cy: 0, cz: -16,  tint: [0.6, 0.6, 0.8] },
            { w: 5, h: 6, d: 5, cx: -15.5, cy: 0, cz: 0,    tint: [0.9, 0.4, 0.3] },
            { w: 9, h: 7, d: 6, cx: 16.5,  cy: 0, cz: 0,    tint: [0.8, 0.3, 0.5] },
        ];

        corridorDefs.forEach(c => {
            const geo = new THREE.BoxGeometry(c.w, c.h, c.d, 6, 6, 6);
            geo.scale(-1, 1, 1);
            geo.translate(c.cx, c.cy + c.h / 2, c.cz);
            this._applyOrganicNoise(geo, 'tunnel'); // subtle noise
            geo.computeVertexNormals();

            const echoMat = this.echoShaderSystem.createMaterial({
                colorTint: c.tint,
                ringSharpness: 0.4,
                decayMultiplier: 1.2
            });

            const mesh = new THREE.Mesh(geo, echoMat);
            mesh.userData.echoMaterial = echoMat;
            mesh.userData.realMaterial = caveMaterials.get('cave');
            mesh.userData.roomName = 'corridor';
            scene.add(mesh);
            this.echoTargets.push(mesh);
            this.colliders.push(mesh);

            // Corridor floor plane
            const floorGeo = new THREE.PlaneGeometry(c.w * 0.9, c.d * 0.9, 4, 4);
            floorGeo.rotateX(-Math.PI / 2);
            floorGeo.translate(c.cx, c.cy, c.cz);
            floorGeo.computeVertexNormals();
            const floorEcho = this.echoShaderSystem.createMaterial({
                colorTint: c.tint, ringSharpness: 0.4, decayMultiplier: 1.0
            });
            const floorMesh = new THREE.Mesh(floorGeo, floorEcho);
            floorMesh.userData.echoMaterial = floorEcho;
            floorMesh.userData.realMaterial = caveMaterials.get('cave');
            scene.add(floorMesh);
            this.echoTargets.push(floorMesh);
            this.colliders.push(floorMesh);
        });
    }

    _buildRoom(name, w, h, d, cx, cy, cz, segments, caveMaterials) {
        const geo = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
        geo.scale(-1, 1, 1); // inside-out
        geo.translate(cx, cy + h / 2, cz);

        // Carve passage openings by pushing wall vertices outward in passage zones
        this._carvePassages(geo, name, cx, cy, cz, w, h, d);

        this._applyOrganicNoise(geo, name);
        geo.computeVertexNormals();

        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: this._roomEchoColor(name),
            ringSharpness: 0.5,
            decayMultiplier: 1.5
        });

        const mesh = new THREE.Mesh(geo, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('cave');
        mesh.userData.roomName = name;

        // Build a terrain floor for every room
        const floor = this._buildFloor(name, w, d, cx, cy, cz, caveMaterials);

        return { mesh, floor };
    }

    _roomEchoColor(name) {
        const colors = {
            main:    [0.8, 0.6, 0.2],
            crystal: [0.3, 0.7, 1.0],
            lake:    [0.2, 0.9, 0.6],
            bats:    [1.0, 0.4, 0.3],
            tunnel:  [0.9, 0.2, 0.5],
        };
        return colors[name] || [0.8, 0.6, 0.2];
    }

    /**
     * Carve passage openings by pushing vertices outward in specific wall regions.
     * This creates natural-looking openings between connected rooms.
     */
    _carvePassages(geo, roomName, cx, cy, cz, w, h, d) {
        const posAttr = geo.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);

            let carve = false;
            let carveDir = new THREE.Vector3();

            if (roomName === 'main') {
                // North wall opening → Crystal Grotto (narrow, 3m wide, 5m tall)
                if (v.z < cz - d / 2 + 1 && Math.abs(v.x - cx) < 2.0 && v.y - cy < 6) {
                    carve = true;
                    carveDir.set(0, 0, -1);
                }
                // South wall opening → Lake (wide, 8m, 4m tall)
                if (v.z > cz + d / 2 - 1 && Math.abs(v.x - cx) < 5.0 && v.y - cy < 5) {
                    carve = true;
                    carveDir.set(0, 0, 1);
                }
                // West wall opening → Bat alcove (narrow, 2.5m, 4m tall)
                if (v.x < cx - w / 2 + 1 && Math.abs(v.z - cz) < 1.8 && v.y - cy < 5) {
                    carve = true;
                    carveDir.set(-1, 0, 0);
                }
                // East wall opening → Tunnel (3m wide, 5m tall)
                if (v.x > cx + w / 2 - 1 && Math.abs(v.z - cz) < 2.0 && v.y - cy < 6) {
                    carve = true;
                    carveDir.set(1, 0, 0);
                }
            } else if (roomName === 'crystal') {
                // South wall → Main
                if (v.z > cz + d / 2 - 1 && Math.abs(v.x - cx) < 2.0 && v.y - cy < 6) {
                    carve = true;
                    carveDir.set(0, 0, 1);
                }
            } else if (roomName === 'lake') {
                // North wall → Main
                if (v.z < cz - d / 2 + 1 && Math.abs(v.x - cx) < 5.0 && v.y - cy - (-1.5) < 5) {
                    carve = true;
                    carveDir.set(0, 0, -1);
                }
            } else if (roomName === 'bats') {
                // East wall → Main
                if (v.x > cx + w / 2 - 1 && Math.abs(v.z - cz) < 1.8 && v.y - cy < 5) {
                    carve = true;
                    carveDir.set(1, 0, 0);
                }
            } else if (roomName === 'tunnel') {
                // West wall → Main
                if (v.x < cx + (-w / 2) + 1 && Math.abs(v.z - cz) < 2.0 && v.y - cy < 6) {
                    carve = true;
                    carveDir.set(-1, 0, 0);
                }
            }

            if (carve) {
                // Push the vertex outward to create the opening
                v.addScaledVector(carveDir, 3.0);
                posAttr.setXYZ(i, v.x, v.y, v.z);
            }
        }
        posAttr.needsUpdate = true;
    }

    _buildFloor(name, w, d, cx, cy, cz, caveMaterials) {
        const segs = 32;
        const geo = new THREE.PlaneGeometry(w * 0.95, d * 0.95, segs, segs);
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);
            let height = 0;

            if (name === 'main') {
                // Gentle undulation
                height = Math.sin(v.x * 0.3) * Math.cos(v.z * 0.25) * 0.4;
                height += Math.sin(v.x * 0.7 + v.z * 0.5) * 0.15;
            } else if (name === 'crystal') {
                // Rougher, more mineral terrain
                height = Math.sin(v.x * 0.5) * Math.cos(v.z * 0.6) * 0.5;
                height += (Math.random() - 0.5) * 0.15;
            } else if (name === 'lake') {
                // Step-down shelf then flat for water
                const distFromCenter = Math.sqrt(v.x * v.x + v.z * v.z);
                if (distFromCenter > 8) {
                    height = 1.2; // Raised shelf at edges
                } else {
                    height = -0.3; // Submerged center
                }
                height += Math.sin(v.x * 0.4) * 0.1;
            } else if (name === 'bats') {
                // Slightly uneven guano-covered floor
                height = Math.sin(v.x * 0.6) * Math.cos(v.z * 0.5) * 0.25;
                height += Math.sin(v.x * 1.2 + v.z * 0.9) * 0.1;
            } else if (name === 'tunnel') {
                // Gentle slope with gravel texture
                height = v.z * 0.02; // slight slope along length
                height += Math.sin(v.x * 0.8) * 0.15;
            }

            posAttr.setXYZ(i, v.x + cx, height + cy, v.z + cz);
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();

        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: this._roomEchoColor(name),
            ringSharpness: 0.4,
            decayMultiplier: 1.2
        });

        const floor = new THREE.Mesh(geo, echoMat);
        floor.userData.echoMaterial = echoMat;
        floor.userData.realMaterial = caveMaterials.get('cave');
        return floor;
    }

    _applyOrganicNoise(geometry, roomName) {
        const posAttr = geometry.attributes.position;
        const center = new THREE.Vector3();
        // Compute bounding box center for noise direction
        geometry.computeBoundingBox();
        geometry.boundingBox.getCenter(center);
        const vertex = new THREE.Vector3();

        const noiseMag = roomName === 'tunnel' ? 0.3 : 0.7;

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);

            const large = Math.sin(vertex.x * 0.18) * Math.cos(vertex.z * 0.18) * noiseMag;
            const medium = Math.sin(vertex.x * 0.55 + vertex.y * 0.4) * Math.cos(vertex.z * 0.55) * (noiseMag * 0.4);
            const fine = (Math.random() - 0.5) * 0.3;

            const totalNoise = large + medium + fine;
            const dir = vertex.clone().sub(center).normalize();
            vertex.addScaledVector(dir, totalNoise);

            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        posAttr.needsUpdate = true;
    }

    getEchoTargets() {
        return this.echoTargets;
    }

    getColliders() {
        return this.colliders;
    }
}
