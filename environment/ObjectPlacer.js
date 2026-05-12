import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class ObjectPlacer {
    constructor(echoShaderSystem, caveBuilder) {
        this.echoShaderSystem = echoShaderSystem;
        this.caveBuilder = caveBuilder;
        this.featureLights = [];     // Sprint B: stored refs for toggle
        this.audioSourceConfigs = []; // Sprint B: co-located audio
    }

    build(scene, caveMaterials, animator) {
        this.placeStalactites(scene, caveMaterials);
        this.placeBoulders(scene, caveMaterials);
        this.placeArchway(scene, caveMaterials);
        this.placeCrystals(scene, caveMaterials);
        this.placeWater(scene, caveMaterials, animator);
        this.placeWaterfall(scene, caveMaterials, animator);
        this.placeFungi(scene, caveMaterials, animator);
        this.placeCavePainting(scene, caveMaterials);
        this.placeBatColony(scene, caveMaterials, animator);
        this.placeFlowstone(scene, caveMaterials);
        this.placeMineralVeins(scene, caveMaterials);
        this.placeRubbleField(scene, caveMaterials);
    }

    // ============================================================
    //  STALACTITES / STALAGMITES — Main Chamber + Crystal Grotto
    // ============================================================
    placeStalactites(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.0, 1.0, 1.0],
            ringSharpness: 0.1,
            decayMultiplier: 0.8
        });

        const geometries = [];
        const positions = [
            // Main chamber
            [-7, -5], [3, -9], [-4, -14], [8, -7], [-11, -10],
            [5, -3], [-9, 2], [2, 8], [-5, 6], [9, 4],
            [-13, -2], [6, 12], [-3, -8], [10, -12], [-8, 10],
            // Crystal grotto ceiling formations
            [1, -22], [-3, -27], [4, -24], [-5, -23], [2, -28],
        ];

        positions.forEach(([x, z], idx) => {
            const fromCeiling = idx % 2 === 0;
            const height = 2.0 + (idx * 0.37) % 3.5;
            const radius = 0.35 + (idx * 0.17) % 1.2;

            const geo = new THREE.CylinderGeometry(
                fromCeiling ? radius : 0.05,
                fromCeiling ? 0.05 : radius,
                height, 8, 3
            );
            this._applyNoise(geo, radius * 0.18);

            if (fromCeiling) {
                geo.translate(x, 10 - (height / 2) + 0.8, z);
            } else {
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
        this.caveBuilder.colliders.push(mesh);
    }

    // ============================================================
    //  BOULDERS — scattered across main chamber and lake entrance
    // ============================================================
    placeBoulders(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.2, 0.8, 0.4],
            ringSharpness: 0.3,
            decayMultiplier: 1.0
        });

        const geometries = [];
        const configs = [
            // Main chamber
            { x: -9,  z: -6,  r: 1.8 },
            { x:  7,  z: -4,  r: 1.2 },
            { x: -13, z: 5,   r: 2.2 },
            { x:  11, z: 8,   r: 1.5 },
            { x: -5,  z: 12,  r: 1.0 },
            { x:  4,  z: -14, r: 1.7 },
            { x: -10, z: -13, r: 1.3 },
            { x:  13, z: -9,  r: 2.0 },
            // Lake entrance area
            { x: -4,  z: 16,  r: 1.1 },
            { x:  6,  z: 18,  r: 0.9 },
            { x:  0,  z: 15,  r: 1.4 },
            // Bat alcove entrance
            { x: -16, z: -1,  r: 0.8 },
            { x: -17, z: 1,   r: 1.0 },
        ];

        configs.forEach(({ x, z, r }) => {
            const geo = new THREE.IcosahedronGeometry(r, 2);
            this._applyNoise(geo, r * 0.22);
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
        this.caveBuilder.colliders.push(mesh);
    }

    // ============================================================
    //  ARCHWAY — entrance to tunnel room
    // ============================================================
    placeArchway(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.9, 0.2, 0.5],
            ringSharpness: 0.2,
            decayMultiplier: 1.2
        });

        const geometries = [];
        const archGeo = new THREE.TorusGeometry(3, 1.2, 16, 40, Math.PI);
        this._applyNoise(archGeo, 0.15);
        archGeo.rotateX(-Math.PI / 2);
        archGeo.translate(15, 3, 0);
        geometries.push(archGeo);

        for (const side of [-1, 1]) {
            const pillarGeo = new THREE.CylinderGeometry(1.1, 1.3, 3.5, 8, 2);
            this._applyNoise(pillarGeo, 0.12);
            pillarGeo.translate(15 + side * 3, 3.5 / 2 - 0.3, 0);
            geometries.push(pillarGeo);
        }

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('archway');
        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
        this.caveBuilder.colliders.push(mesh);
    }

    // ============================================================
    //  CRYSTAL FORMATIONS — Crystal Grotto room
    // ============================================================
    placeCrystals(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.4, 0.8, 1.0],
            ringSharpness: 0.05,   // Very sharp — crystals are specular
            decayMultiplier: 0.6
        });

        const geometries = [];
        // 6 clusters in the crystal grotto
        const clusters = [
            { x: -3, z: -23, count: 7 },
            { x:  4, z: -26, count: 5 },
            { x: -5, z: -28, count: 6 },
            { x:  2, z: -22, count: 4 },
            { x: -1, z: -30, count: 5 },
            { x:  6, z: -24, count: 3 },
        ];

        clusters.forEach((cluster, ci) => {
            for (let j = 0; j < cluster.count; j++) {
                const length = 1.0 + Math.random() * 2.5;
                const radius = 0.1 + Math.random() * 0.25;
                const geo = new THREE.OctahedronGeometry(radius, 0);
                geo.scale(1, length / radius, 1);

                // Random tilt
                const tiltX = (Math.random() - 0.5) * 0.8;
                const tiltZ = (Math.random() - 0.5) * 0.8;
                geo.rotateX(tiltX);
                geo.rotateZ(tiltZ);

                // Spread within cluster
                const ox = cluster.x + (Math.random() - 0.5) * 2;
                const oz = cluster.z + (Math.random() - 0.5) * 2;

                // Alternate between floor-growing and wall-growing
                if (j % 3 === 0) {
                    geo.translate(ox, length * 0.4, oz);
                } else {
                    geo.translate(ox, 7.5 - length * 0.3, oz);
                }

                geometries.push(geo);
            }
        });

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('crystal');
        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
        this.caveBuilder.colliders.push(mesh);

        // Point lights inside crystal clusters for lights-on sparkle
        clusters.forEach(c => {
            const light = new THREE.PointLight(0x4488ff, 0, 8);
            light.position.set(c.x, 2, c.z);
            light.userData._isCrystalLight = true;
            scene.add(light);
            this.featureLights.push(light);
        });
    }

    // ============================================================
    //  UNDERGROUND LAKE — water plane
    // ============================================================
    placeWater(scene, caveMaterials, animator) {
        const geo = new THREE.PlaneGeometry(20, 20, 32, 32);
        geo.rotateX(-Math.PI / 2);

        const mesh = new THREE.Mesh(geo, caveMaterials.get('water'));
        mesh.position.set(0, -1.0, 22);

        // Echo material version — water returns a smooth, continuous echo
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.1, 0.6, 0.9],
            ringSharpness: 0.8,
            decayMultiplier: 2.0
        });
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('water');

        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);

        // Sprint B: register co-located audio for the water surface
        this.audioSourceConfigs.push(
            { type: 'drip', position: mesh.position.clone().add(new THREE.Vector3(5, 4, -2)), rate: 2.0 }
        );

        if (animator) animator.registerWater(mesh);
    }

    // ============================================================
    //  WATERFALL — cascade into the lake room
    // ============================================================
    placeWaterfall(scene, caveMaterials, animator) {
        const geo = new THREE.PlaneGeometry(3, 6, 8, 16);
        // Position along the back wall of the lake room
        geo.translate(0, 3, 0);

        const mesh = new THREE.Mesh(geo, caveMaterials.get('waterfall'));
        mesh.position.set(-8, -1.5, 30);
        mesh.rotation.y = Math.PI * 0.1;

        // Save base positions for animation
        mesh.userData._basePositions = new Float32Array(geo.attributes.position.array);

        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.5, 0.7, 1.0],
            ringSharpness: 0.6,
            decayMultiplier: 1.8
        });
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('waterfall');

        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);

        // Sprint B: co-located waterfall audio
        this.audioSourceConfigs.push(
            { type: 'waterfall', position: mesh.position.clone(), intensity: 0.7 }
        );

        if (animator) animator.registerWaterfall(mesh);
    }

    // ============================================================
    //  BIOLUMINESCENT FUNGI — scattered throughout cave junctions
    // ============================================================
    placeFungi(scene, caveMaterials, animator) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.0, 1.0, 0.5],
            ringSharpness: 0.15,
            decayMultiplier: 0.5
        });

        const fungiPositions = [
            // Main chamber floor/wall junctions
            { x: -12, y: 0.15, z: -8 },
            { x:  10, y: 0.15, z:  5 },
            { x:  -6, y: 0.15, z: 10 },
            { x:   3, y: 0.15, z: -4 },
            // Passage walls
            { x:  -2, y: 1.5,  z: -16 },
            { x:   1, y: 0.8,  z: -18 },
            // Bat alcove entrance
            { x: -16, y: 0.2,  z: -2 },
            { x: -18, y: 1.0,  z:  1 },
            // Lake room edges
            { x:  -8, y: -0.8, z: 18 },
            { x:   7, y: -0.8, z: 20 },
            // Tunnel
            { x:  20, y: 0.2,  z: -2 },
            { x:  24, y: 0.3,  z:  1 },
        ];

        fungiPositions.forEach((pos, idx) => {
            const radius = 0.15 + Math.random() * 0.15;
            const geo = new THREE.SphereGeometry(radius, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
            geo.scale(1, 0.6, 1);

            const realMat = caveMaterials.get('fungi').clone();
            const mesh = new THREE.Mesh(geo, realMat);
            mesh.position.set(pos.x, pos.y, pos.z);
            mesh.userData.echoMaterial = echoMat;
            mesh.userData.realMaterial = realMat;

            scene.add(mesh);
            this.caveBuilder.echoTargets.push(mesh);

            if (animator) animator.registerFungus(mesh, idx * 1.3);

            // Tiny point light for lights-on mode glow
            const glow = new THREE.PointLight(0x00ff66, 0, 3);
            glow.position.copy(mesh.position);
            glow.position.y += 0.1;
            glow.userData._isFungiLight = true;
            scene.add(glow);
            this.featureLights.push(glow);
        });
    }

    // ============================================================
    //  CAVE PAINTING — Main Chamber wall
    // ============================================================
    placeCavePainting(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.9, 0.6, 0.2],
            ringSharpness: 0.7,
            decayMultiplier: 1.0
        });

        const geo = new THREE.PlaneGeometry(6, 3);
        const mesh = new THREE.Mesh(geo, echoMat); // Start with echo material

        // Place on the north wall of the main chamber, slightly inset
        mesh.position.set(8, 4, -13.5);
        mesh.rotation.y = -0.3;

        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('painting');

        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
    }

    // ============================================================
    //  BAT COLONY — Bat Alcove ceiling
    // ============================================================
    placeBatColony(scene, caveMaterials, animator) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.8, 0.3, 0.2],
            ringSharpness: 0.1,
            decayMultiplier: 0.4
        });

        const geometries = [];
        const batCount = 25;

        for (let i = 0; i < batCount; i++) {
            // Tiny inverted cone body hanging from ceiling
            const bodyGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
            bodyGeo.rotateX(Math.PI); // Inverted — hanging

            const bx = -22 + (Math.random() - 0.5) * 8;
            const bz = (Math.random() - 0.5) * 8;
            const by = 12 - Math.random() * 1.5; // Near ceiling of tall alcove

            bodyGeo.translate(bx, by, bz);

            // Tiny wing flaps
            const wingL = new THREE.PlaneGeometry(0.25, 0.12);
            wingL.translate(bx - 0.15, by - 0.05, bz);
            const wingR = new THREE.PlaneGeometry(0.25, 0.12);
            wingR.translate(bx + 0.15, by - 0.05, bz);

            geometries.push(bodyGeo, wingL, wingR);
        }

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('bat');

        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);

        // Sprint B: co-located bat colony chittering audio
        this.audioSourceConfigs.push(
            { type: 'bats', position: new THREE.Vector3(-22, 10, 0), rate: 2.5 }
        );

        if (animator) animator.registerBats(mesh);
    }

    // ============================================================
    //  FLOWSTONE CURTAIN — Archway Tunnel wall
    // ============================================================
    placeFlowstone(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.7, 0.5, 0.3],
            ringSharpness: 0.6,
            decayMultiplier: 1.3
        });

        // Wavy plane along the tunnel wall
        const geo = new THREE.PlaneGeometry(8, 5, 20, 12);
        const posAttr = geo.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);
            // Create flowing ripple effect
            const wave = Math.sin(v.x * 1.5) * 0.3 + Math.sin(v.y * 2.0 + v.x * 0.5) * 0.2;
            posAttr.setZ(i, v.z + wave);
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, echoMat);
        mesh.position.set(22, 3.5, -3.5);
        mesh.rotation.y = -Math.PI / 2;

        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('flowstone');

        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
    }

    // ============================================================
    //  MINERAL VEINS — emissive lines on cave walls
    // ============================================================
    placeMineralVeins(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [1.0, 0.6, 0.1],
            ringSharpness: 0.05,
            decayMultiplier: 0.3
        });

        const veinPaths = [
            // Main chamber veins
            [[-12, 3, -14], [-10, 4, -13], [-8, 3.5, -12], [-6, 4.5, -11]],
            [[12, 5, -10], [11, 6, -8], [10, 5.5, -6], [9, 7, -4]],
            // Crystal grotto veins
            [[-6, 5, -22], [-4, 6, -24], [-3, 5.5, -26], [-2, 6.5, -28]],
        ];

        veinPaths.forEach(path => {
            const points = path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            const curve = new THREE.CatmullRomCurve3(points);
            const geo = new THREE.TubeGeometry(curve, 20, 0.06, 4, false);

            const mesh = new THREE.Mesh(geo, echoMat);
            mesh.userData.echoMaterial = echoMat;
            mesh.userData.realMaterial = caveMaterials.get('mineral');

            scene.add(mesh);
            this.caveBuilder.echoTargets.push(mesh);
        });
    }

    // ============================================================
    //  RUBBLE FIELD — Lake room entrance shelf
    // ============================================================
    placeRubbleField(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.5, 0.5, 0.4],
            ringSharpness: 0.35,
            decayMultiplier: 1.1
        });

        const geometries = [];

        for (let i = 0; i < 20; i++) {
            const r = 0.15 + Math.random() * 0.3;
            const geo = new THREE.IcosahedronGeometry(r, 1);
            this._applyNoise(geo, r * 0.3);

            const x = -6 + Math.random() * 12;
            const z = 14 + Math.random() * 4;
            geo.translate(x, r * 0.4, z);

            geometries.push(geo);
        }

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = caveMaterials.get('cave');

        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
        this.caveBuilder.colliders.push(mesh);
    }

    // ============================================================
    //  Utility
    // ============================================================
    _applyNoise(geometry, magnitude = 0.3) {
        const posAttr = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const hasNormals = !!geometry.attributes.normal;

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);
            const jitter = (Math.random() - 0.5) * 2 * magnitude;

            if (hasNormals) {
                normal.fromBufferAttribute(geometry.attributes.normal, i).normalize();
                vertex.addScaledVector(normal, jitter * 0.7);
            }

            vertex.x += (Math.random() - 0.5) * magnitude * 0.4;
            vertex.y += (Math.random() - 0.5) * magnitude * 0.4;
            vertex.z += (Math.random() - 0.5) * magnitude * 0.4;

            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        posAttr.needsUpdate = true;
    }

    // --- Sprint B: Public getters ---
    getFeatureLights() {
        return this.featureLights;
    }

    getAudioSourceConfigs() {
        // Add tunnel wind (not tied to a specific mesh but to the room)
        const configs = [...this.audioSourceConfigs];
        configs.push(
            { type: 'wind', position: new THREE.Vector3(22, 3, 0), intensity: 0.4 },
            { type: 'drip', position: new THREE.Vector3(-2, 6, -24), rate: 1.0 },
            { type: 'drip', position: new THREE.Vector3(3,  5, -27), rate: 1.5 },
        );
        return configs;
    }
}
