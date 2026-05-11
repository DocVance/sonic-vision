import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class ObjectPlacer {
    constructor(echoShaderSystem, caveBuilder) {
        this.echoShaderSystem = echoShaderSystem;
        this.caveBuilder = caveBuilder;
    }

    build(scene, caveMaterials) {
        this.placeStalactites(scene, caveMaterials);
        this.placeBoulders(scene, caveMaterials);
        this.placeArchway(scene, caveMaterials);
    }

    placeStalactites(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.0, 1.0, 1.0],
            ringSharpness: 0.1,
            decayMultiplier: 0.8
        });

        const geometries = [];

        // Use a fixed set of positions to avoid randomness causing floating tips.
        // The formations are embedded 0.8 units INTO the ceiling/floor surface —
        // this guarantees they are never visually detached even after cave noise.
        const positions = [
            [-7, -5], [3, -9], [-4, -14], [8, -7], [-11, -10],
            [5, -3], [-9, 2], [2, 8], [-5, 6], [9, 4],
            [-13, -2], [6, 12], [-3, -8], [10, -12], [-8, 10]
        ];

        positions.forEach(([x, z], idx) => {
            // Alternate between stalactites (from ceiling) and stalagmites (from floor)
            const fromCeiling = idx % 2 === 0;
            const height = 2.0 + (idx * 0.37) % 3.5; // Deterministic height variation
            const radius = 0.35 + (idx * 0.17) % 1.2; // Deterministic radius variation

            const geo = new THREE.CylinderGeometry(
                fromCeiling ? radius : 0.05,    // top radius
                fromCeiling ? 0.05 : radius,    // bottom radius
                height,
                8,   // more radial segments = less faceted
                3    // height segments help noise look more organic
            );

            // Moderate random noise — not so much it breaks the silhouette
            this._applyNoise(geo, radius * 0.18);

            if (fromCeiling) {
                // Embed 0.8 units into the ceiling (y=10) to eliminate floating gaps
                geo.translate(x, 10 - (height / 2) + 0.8, z);
            } else {
                // Embed 0.5 units into the floor (y=0)
                geo.translate(x, (height / 2) - 0.5, z);
            }

            geometries.push(geo);
        });

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('stalactite');
        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
    }

    placeBoulders(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.2, 0.8, 0.4],
            ringSharpness: 0.3,
            decayMultiplier: 1.0
        });

        const geometries = [];

        // Fixed positions again — away from spawn (0,0,0) and archway path
        const configs = [
            { x: -9,  z: -6,  r: 1.8 },
            { x:  7,  z: -4,  r: 1.2 },
            { x: -13, z: 5,   r: 2.2 },
            { x:  11, z: 8,   r: 1.5 },
            { x: -5,  z: 12,  r: 1.0 },
            { x:  4,  z: -14, r: 1.7 },
            { x: -10, z: -13, r: 1.3 },
            { x:  13, z: -9,  r: 2.0 },
        ];

        configs.forEach(({ x, z, r }) => {
            // IcosahedronGeometry detail=2 gives smoother, more rock-like silhouette
            const geo = new THREE.IcosahedronGeometry(r, 2);
            this._applyNoise(geo, r * 0.22);

            // Embed the boulder 40% into the floor — it's a rock growing FROM the ground
            // not a sphere sitting ON it. This removes the floating gap entirely.
            geo.translate(x, r * 0.6 - r * 0.4, z);

            geometries.push(geo);
        });

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('cave');
        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
    }

    placeArchway(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.9, 0.2, 0.5],
            ringSharpness: 0.2,
            decayMultiplier: 1.2
        });

        const geometries = [];

        // The arch: a half-torus arch
        const archGeo = new THREE.TorusGeometry(3, 1.2, 16, 40, Math.PI);
        this._applyNoise(archGeo, 0.15);
        // Arch sits at z=-12, with the opening at y=0 up to y=6
        archGeo.rotateX(-Math.PI / 2);
        archGeo.translate(0, 3, -12);
        geometries.push(archGeo);

        // Two pillar bases anchoring the arch to the ground — closes the gap
        // between the torus endpoints and the floor
        for (const side of [-1, 1]) {
            const pillarGeo = new THREE.CylinderGeometry(1.1, 1.3, 3.5, 8, 2);
            this._applyNoise(pillarGeo, 0.12);
            // Embed 0.3 units into the ground
            pillarGeo.translate(side * 3, 3.5 / 2 - 0.3, -12);
            geometries.push(pillarGeo);
        }

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('archway');
        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
    }

    _applyNoise(geometry, magnitude = 0.3) {
        const posAttr = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const normal = new THREE.Vector3();

        // If normals exist, push along the surface normal for more organic bumping
        const hasNormals = !!geometry.attributes.normal;

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);

            const jitter = (Math.random() - 0.5) * 2 * magnitude;

            if (hasNormals) {
                normal.fromBufferAttribute(geometry.attributes.normal, i).normalize();
                vertex.addScaledVector(normal, jitter * 0.7);
            }

            // Always add a small random xyz jitter for surface roughness
            vertex.x += (Math.random() - 0.5) * magnitude * 0.4;
            vertex.y += (Math.random() - 0.5) * magnitude * 0.4;
            vertex.z += (Math.random() - 0.5) * magnitude * 0.4;

            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        posAttr.needsUpdate = true;
    }
}
