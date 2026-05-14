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
        this.placeEnhancements(scene, caveMaterials);
    }

    // ============================================================
    //  STALACTITES / STALAGMITES — Main Chamber + Crystal Grotto
    // ============================================================
    placeStalactites(scene, caveMaterials) {
        const echoMat = this.echoShaderSystem.createMaterial({
            colorTint: [0.0, 1.0, 1.0], ringSharpness: 0.15, decayMultiplier: 0.8
        });
        const geometries = [];

        // Stalactites (ceiling) and stalagmites (floor) — 6-sided cones for clean facets
        const spikes = [
            // [x, z, fromCeiling, height, radius]
            [-7, -5,  1, 2.8, 0.30],  [3, -9,   1, 3.5, 0.45],  [-4,-14, 1, 2.2, 0.28],
            [ 8, -7,  1, 3.0, 0.38],  [-11,-10, 1, 4.0, 0.52],  [5, -3,  1, 2.5, 0.32],
            [-9,  2,  1, 3.2, 0.40],  [ 2,  8,  1, 2.0, 0.25],  [-5, 6,  1, 3.8, 0.48],
            [ 9,  4,  1, 2.7, 0.35],  [-13,-2,  1, 4.5, 0.55],
            // Stalagmites (floor-up)
            [-6,-12,  0, 1.8, 0.22],  [5, -8,   0, 2.4, 0.30],  [10,-11, 0, 1.5, 0.18],
            [-3,  9,  0, 2.0, 0.26],  [7,  6,   0, 1.6, 0.20],
            // Crystal grotto formations
            [1,-22,   1, 3.0, 0.35],  [-3,-27,  1, 4.2, 0.50],  [4,-24, 1, 2.5, 0.30],
            [-5,-23,  1, 3.5, 0.42],  [2,-28,   0, 2.8, 0.34],
        ];

        spikes.forEach(([x, z, ceil, h, r]) => {
            const geo = new THREE.ConeGeometry(ceil ? 0.03 : r, h, 6, 1); // 6-sided = clear flat faces
            if (ceil) {
                geo.scale(1, 1, 1);
                geo.translate(x, 10 - h * 0.5, z); // hang from ceiling at y≈10
            } else {
                geo.rotateX(Math.PI); // point up
                geo.translate(x, h * 0.5 - 0.2, z);
            }
            // Very light jitter — preserves flat faces
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.04);
                pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.04);
            }
            pos.needsUpdate = true;
            geometries.push(geo);
        });

        // Stalactite curtain in crystal grotto — uniform row of cones
        for (let i = 0; i < 8; i++) {
            const h = 1.5 + (i % 3) * 0.8;
            const geo = new THREE.ConeGeometry(0.08, h, 6, 1);
            geo.translate(-3 + i * 1.0, 7.5 - h * 0.5, -21);
            geometries.push(geo);
        }

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
            colorTint: [0.2, 0.8, 0.4], ringSharpness: 0.3, decayMultiplier: 1.0
        });
        const geometries = [];
        const configs = [
            { x: -9,  z: -6,  r: 1.8 }, { x:  7,  z: -4,  r: 1.2 },
            { x: -13, z: 5,   r: 2.2 }, { x: 11,  z: 8,   r: 1.5 },
            { x: -5,  z: 12,  r: 1.0 }, { x:  4,  z: -14, r: 1.7 },
            { x: -10, z: -13, r: 1.3 }, { x: 13,  z: -9,  r: 2.0 },
            { x: -4,  z: 16,  r: 1.1 }, { x:  6,  z: 18,  r: 0.9 },
            { x:  0,  z: 15,  r: 1.4 }, { x: -16, z: -1,  r: 0.8 },
            { x: -17, z: 1,   r: 1.0 },
        ];
        configs.forEach(({ x, z, r }) => {
            // DodecahedronGeometry(0) = 12 flat pentagonal faces — clean low-poly chunk
            const geo = new THREE.DodecahedronGeometry(r, 0);
            // Very light positional jitter — keeps flat faces, just breaks uniformity
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                pos.setX(i, pos.getX(i) + (Math.random()-0.5)*r*0.12);
                pos.setY(i, pos.getY(i) + (Math.random()-0.5)*r*0.12);
                pos.setZ(i, pos.getZ(i) + (Math.random()-0.5)*r*0.12);
            }
            pos.needsUpdate = true;
            geo.translate(x, r * 0.55, z);
            geometries.push(geo);
        });

        // Rock ledge shelves — toNonIndexed() so they match DodecahedronGeometry (non-indexed)
        [
            { x:-14, y:3.5, z:-4,  w:0.4, h:0.5, d:6 },
            { x: 14, y:5.0, z: 3,  w:0.4, h:0.5, d:4 },
            { x: -4, y:2.5, z:-14, w:5,   h:0.5, d:0.4 },
        ].forEach(({ x, y, z, w, h, d }) => {
            const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
            g.translate(x, y, z);
            geometries.push(g);
        });

        // Normalise: ensure all are non-indexed before merge
        const toMerge = geometries.map(g => g.index ? g.toNonIndexed() : g);
        const merged = BufferGeometryUtils.mergeGeometries(toMerge);
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
            colorTint: [0.9, 0.2, 0.5], ringSharpness: 0.25, decayMultiplier: 1.2
        });
        const geometries = [];

        // Lintel — flat box across the top (clean horizontal line in sonar)
        const lintel = new THREE.BoxGeometry(8, 1.0, 1.2);
        lintel.translate(15, 5.8, 0);
        geometries.push(lintel);

        // Two hexagonal pillars (6-segment cylinders = clear flat faces)
        for (const side of [-1, 1]) {
            const pillar = new THREE.CylinderGeometry(0.8, 1.0, 6, 6, 1);
            pillar.translate(15 + side * 3.5, 3.0, 0);
            geometries.push(pillar);
        }

        // Corbel blocks under lintel corners
        for (const side of [-1, 1]) {
            const corbel = new THREE.BoxGeometry(1.2, 0.5, 1.4);
            corbel.translate(15 + side * 3.5, 5.2, 0);
            geometries.push(corbel);
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
            colorTint: [0.5, 0.5, 0.4], ringSharpness: 0.35, decayMultiplier: 1.1
        });
        const geometries = [];

        // Low-poly rubble: OctahedronGeometry(0) = 8 flat triangular faces
        const rubbleSeeds = [
            [-5,14,0.25],[-3,15,0.30],[0,14.5,0.20],[2,15,0.28],[4,14,0.22],
            [-4,16,0.18],[1,16,0.32],[-2,17,0.24],[3,17,0.19],[-1,15.5,0.26],
            [5,15,0.21],[6,14,0.29],[-6,15,0.27],[2,14,0.23],[-3,16.5,0.31],
        ];
        rubbleSeeds.forEach(([x,z,r]) => {
            const geo = new THREE.OctahedronGeometry(r, 0); // 0 detail = pure 8-face
            geo.rotateY(Math.random() * Math.PI);
            geo.rotateX((Math.random()-0.5) * 0.6);
            geo.translate(x, r*0.5, z);
            geometries.push(geo);
        });

        // Bone-dry shallow pool — toNonIndexed() to match OctahedronGeometry (non-indexed)
        const poolGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.15, 8, 1).toNonIndexed();
        poolGeo.translate(0, -1.0, 22);
        geometries.push(poolGeo);

        // Normalise before merge
        const toMerge = geometries.map(g => g.index ? g.toNonIndexed() : g);
        const merged = BufferGeometryUtils.mergeGeometries(toMerge);
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

    // ============================================================
    //  LOW-POLY ENHANCEMENTS
    // ============================================================
    placeEnhancements(scene, mats) {
        this._eCols(scene, mats);
        this._eTunnelRibs(scene, mats);
        this._eCrystalShelf(scene, mats);
        this._eTideMarks(scene, mats);
        this._eMushrooms(scene, mats);
        this._eChandelier(scene, mats);
        this._eArtifacts(scene, mats);

        // Sprint D: Four-part cave improvement
        this._eLakeIsland(scene, mats);        // Part 1
        this._eGeodeWall(scene, mats);         // Part 2
        this._eCeremonialArea(scene, mats);    // Part 3
        this._eBatAlcoveDetail(scene, mats);   // Part 4
    }

    // helper: build mesh from geometries array (all toNonIndexed), add to scene
    _lp(scene, geos, echoMat, realMat, collider = false) {
        const toMerge = geos.map(g => g.index ? g.toNonIndexed() : g);
        const merged = BufferGeometryUtils.mergeGeometries(toMerge);
        if (!merged) return;
        merged.computeVertexNormals();
        const mesh = new THREE.Mesh(merged, echoMat);
        mesh.userData.echoMaterial = echoMat;
        mesh.userData.realMaterial = realMat;
        scene.add(mesh);
        this.caveBuilder.echoTargets.push(mesh);
        if (collider) this.caveBuilder.colliders.push(mesh);
        return mesh;
    }

    // Hexagonal cave columns where stalactite meets stalagmite (main chamber)
    _eCols(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.8,0.6,0.2], ringSharpness:0.35, decayMultiplier:1.3 });
        const geos = [];
        [{ x:-4, z:-2, h:6.5 }, { x:8, z:3, h:5.5 }, { x:-7, z:7, h:7.0 }].forEach(({x,z,h}) => {
            // Shaft: tapered hexagonal prism
            const shaft = new THREE.CylinderGeometry(0.22, 0.32, h, 6, 1).toNonIndexed();
            shaft.translate(x, h*0.5, z);
            geos.push(shaft);
            // Capital: flat hexagonal cap at top
            const cap = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 6, 1).toNonIndexed();
            cap.translate(x, h + 0.11, z);
            geos.push(cap);
            // Base: wider flat disk
            const base = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 6, 1).toNonIndexed();
            base.translate(x, 0.09, z);
            geos.push(base);
        });
        this._lp(scene, geos, echo, mats.get('cave'), true);
    }

    // Tunnel ceiling ribs + wall tabs (tunnel room cx=22, runs N-S along Z=-11 to 11)
    _eTunnelRibs(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.9,0.2,0.5], ringSharpness:0.3, decayMultiplier:1.1 });
        const geos = [];
        // Ceiling ribs spanning X at Z intervals — clean horizontal echo bands
        [-8,-4,0,4,8].forEach(z => {
            const g = new THREE.BoxGeometry(7.5, 0.35, 0.35).toNonIndexed();
            g.translate(22, 6.5, z); geos.push(g);
        });
        // West-wall tabs (x≈19) — vertical slabs, clear rectangular surfaces
        [-6,-2,2,6].forEach(z => {
            const g = new THREE.BoxGeometry(0.35, 4.5, 0.35).toNonIndexed();
            g.translate(19, 3.0, z); geos.push(g);
        });
        // East-wall tabs (x≈25)
        [-6,-2,2,6].forEach(z => {
            const g = new THREE.BoxGeometry(0.35, 4.5, 0.35).toNonIndexed();
            g.translate(25, 3.0, z); geos.push(g);
        });
        this._lp(scene, geos, echo, mats.get('cave'));
    }

    // Crystal shelf: flat slab + spike cluster on top (crystal grotto z=-24)
    _eCrystalShelf(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.4,0.8,1.0], ringSharpness:0.05, decayMultiplier:0.6 });
        const geos = [];
        // Shelf slab
        const shelf = new THREE.BoxGeometry(4, 0.45, 2).toNonIndexed();
        shelf.translate(0, 1.5, -24); geos.push(shelf);
        // Two support legs
        [[-1.5,-24],[1.5,-24]].forEach(([lx,lz]) => {
            const leg = new THREE.BoxGeometry(0.2, 1.5, 0.2).toNonIndexed();
            leg.translate(lx, 0.75, lz); geos.push(leg);
        });
        // Crystal spikes on surface — OctahedronGeometry (non-indexed, compatible)
        [[-1,-23.5,1.6],[0.4,-24.5,1.2],[1.2,-23.9,0.9],[-0.3,-24.2,1.4],[0.8,-23.7,1.1]]
            .forEach(([sx,sz,sh]) => {
                const g = new THREE.OctahedronGeometry(0.12, 0);
                g.scale(1, sh * 4, 1);
                g.translate(sx, 2.0 + sh * 0.5, sz);
                geos.push(g);
            });
        this._lp(scene, geos, echo, mats.get('crystal'));
    }

    // Ancient tide-mark shelves on lake room walls (lake cx=0, cz=22, w=26, d=26)
    _eTideMarks(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.2,0.9,0.6], ringSharpness:0.5, decayMultiplier:1.0 });
        const geos = [];
        [0.5, 1.8].forEach(yOff => {
            const y = -1.5 + yOff; // lake floor at cy=-1.5
            // North inner wall
            const gN = new THREE.BoxGeometry(24, 0.1, 0.22).toNonIndexed(); gN.translate(0, y, 11); geos.push(gN);
            // South inner wall
            const gS = new THREE.BoxGeometry(24, 0.1, 0.22).toNonIndexed(); gS.translate(0, y, 33); geos.push(gS);
            // East inner wall
            const gE = new THREE.BoxGeometry(0.22, 0.1, 22).toNonIndexed(); gE.translate(12, y, 22); geos.push(gE);
            // West inner wall
            const gW = new THREE.BoxGeometry(0.22, 0.1, 22).toNonIndexed(); gW.translate(-12, y, 22); geos.push(gW);
        });
        this._lp(scene, geos, echo, mats.get('cave'));
    }

    // Geometric mushrooms in bat alcove — 6-face cap + 6-face stem
    _eMushrooms(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.0,1.0,0.5], ringSharpness:0.2, decayMultiplier:0.8 });
        const geos = [];
        [
            { x:-20, z:-3, r:0.38, capH:0.55, stemH:0.65 },
            { x:-23, z: 2, r:0.58, capH:0.72, stemH:0.95 },
            { x:-21, z: 3, r:0.29, capH:0.44, stemH:0.50 },
            { x:-24, z:-1, r:0.42, capH:0.62, stemH:0.78 },
            { x:-19, z: 1, r:0.23, capH:0.34, stemH:0.42 },
        ].forEach(({ x, z, r, capH, stemH }) => {
            const stem = new THREE.CylinderGeometry(r*0.34, r*0.40, stemH, 6, 1).toNonIndexed();
            stem.translate(x, stemH*0.5, z); geos.push(stem);
            const cap = new THREE.ConeGeometry(r, capH, 6, 1).toNonIndexed();
            cap.translate(x, stemH + capH*0.5, z); geos.push(cap);
            // Flat rim under cap
            const rim = new THREE.CylinderGeometry(r*1.1, r*0.9, 0.06, 6, 1).toNonIndexed();
            rim.translate(x, stemH + 0.03, z); geos.push(rim);
        });
        this._lp(scene, geos, echo, mats.get('fungi'));
    }

    // Central stalactite chandelier — 1 large + 6-ring in main chamber ceiling
    _eChandelier(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.0,1.0,1.0], ringSharpness:0.18, decayMultiplier:0.9 });
        const geos = [];
        // Central dominant spike
        const centre = new THREE.ConeGeometry(0.42, 5.2, 6, 1).toNonIndexed();
        centre.translate(0, 10 - 2.6, 0); geos.push(centre);
        // Ring of 6 alternating short/tall spikes
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const h = 1.8 + (i % 2) * 1.6;
            const g = new THREE.ConeGeometry(0.14, h, 6, 1).toNonIndexed();
            g.translate(Math.cos(ang)*1.9, 10 - h*0.5, Math.sin(ang)*1.9); geos.push(g);
        }
        // Outer ring of 6 thin drips
        for (let i = 0; i < 6; i++) {
            const ang = ((i + 0.5) / 6) * Math.PI * 2;
            const h = 0.9 + (i % 3) * 0.5;
            const g = new THREE.ConeGeometry(0.07, h, 6, 1).toNonIndexed();
            g.translate(Math.cos(ang)*3.0, 10 - h*0.5, Math.sin(ang)*3.0); geos.push(g);
        }
        this._lp(scene, geos, echo, mats.get('stalactite'));
    }

    // Abstract artifacts: crossed bones + stone tool + skull (main chamber floor)
    _eArtifacts(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({ colorTint:[0.9,0.6,0.2], ringSharpness:0.4, decayMultiplier:1.0 });
        const geos = [];
        // Crossed cylinders (bones)
        const b1 = new THREE.CylinderGeometry(0.055, 0.055, 1.8, 6, 1).toNonIndexed();
        b1.rotateZ(Math.PI * 0.25); b1.translate(-3, 0.45, 10); geos.push(b1);
        const b2 = new THREE.CylinderGeometry(0.055, 0.055, 1.8, 6, 1).toNonIndexed();
        b2.rotateZ(-Math.PI * 0.25); b2.translate(-3, 0.45, 10); geos.push(b2);
        // Triangular prism "flint tool"
        const tool = new THREE.CylinderGeometry(0, 0.28, 0.55, 3, 1).toNonIndexed();
        tool.rotateX(Math.PI * 0.5); tool.translate(-2.5, 0.18, 11); geos.push(tool);
        // Low-poly "skull": cranium box + jaw box
        const cranium = new THREE.BoxGeometry(0.52, 0.44, 0.46).toNonIndexed();
        cranium.translate(5, 0.52, -3); geos.push(cranium);
        const jaw = new THREE.BoxGeometry(0.50, 0.18, 0.30).toNonIndexed();
        jaw.translate(5, 0.20, -3.1); geos.push(jaw);
        // Teeth (tiny boxes)
        [-0.12, 0, 0.12].forEach(tx => {
            const tooth = new THREE.BoxGeometry(0.08, 0.12, 0.06).toNonIndexed();
            tooth.translate(5 + tx, 0.10, -2.96); geos.push(tooth);
        });
        this._lp(scene, geos, echo, mats.get('cave'));
    }

    // ============================================================
    //  PART 1 — Lake Room: Rock Island & Shoreline
    // ============================================================
    _eLakeIsland(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({
            colorTint: [0.2, 0.9, 0.6], ringSharpness: 0.45, decayMultiplier: 1.1
        });
        const geos = [];

        // Central island — flat-topped mound
        const island = new THREE.CylinderGeometry(3.5, 4.2, 0.9, 8, 1).toNonIndexed();
        island.translate(0, -0.6, 22);
        geos.push(island);
        const top = new THREE.CylinderGeometry(1.8, 2.2, 0.55, 6, 1).toNonIndexed();
        top.translate(0, 0.0, 22);
        geos.push(top);

        // Rock spire on the island
        const spire = new THREE.ConeGeometry(0.55, 2.4, 6, 1).toNonIndexed();
        spire.translate(0.5, 1.5, 22);
        geos.push(spire);
        const spireBase = new THREE.CylinderGeometry(0.62, 0.75, 0.4, 6, 1).toNonIndexed();
        spireBase.translate(0.5, 0.25, 22);
        geos.push(spireBase);

        // Stepping stones: 5 flat discs from shore to island
        [10.5, 12.0, 13.8, 15.5, 17.2].forEach((z, i) => {
            const off = (i % 2 === 0 ? 0.6 : -0.5);
            const stone = new THREE.CylinderGeometry(0.65 - i * 0.04, 0.7 - i * 0.04, 0.22, 6, 1).toNonIndexed();
            stone.translate(off, -1.05, z);
            geos.push(stone);
        });

        // Shoreline boulders around the lake perimeter
        [
            { x: -10, z: 12, r: 0.9 }, { x: 10, z: 12, r: 0.75 },
            { x: -11, z: 22, r: 1.1 }, { x: 11, z: 22, r: 0.85 },
            { x:  -9, z: 32, r: 0.7 }, { x:  9, z: 32, r: 1.0 },
            { x:   0, z: 33, r: 0.8 },
        ].forEach(({ x, z, r }) => {
            const b = new THREE.DodecahedronGeometry(r, 0).toNonIndexed();
            b.translate(x, -1.2 + r * 0.4, z);
            geos.push(b);
        });

        this._lp(scene, geos, echo, mats.get('cave'), true);
    }

    // ============================================================
    //  PART 2 — Crystal Grotto: Geode South Wall
    // ============================================================
    _eGeodeWall(scene, mats) {
        const echo = this.echoShaderSystem.createMaterial({
            colorTint: [0.3, 0.7, 1.0], ringSharpness: 0.04, decayMultiplier: 0.5
        });
        const geos = [];

        const rows = [
            { y: 0.8, count: 9, minL: 0.8,  maxL: 2.2 },
            { y: 2.5, count: 7, minL: 1.2,  maxL: 3.0 },
            { y: 4.5, count: 6, minL: 1.5,  maxL: 3.8 },
            { y: 6.2, count: 5, minL: 0.6,  maxL: 1.5 },
        ];
        const pseudo = (i) => Math.abs(Math.sin(i * 127.1 + 311.7));

        let idx = 0;
        rows.forEach(({ y, count, minL, maxL }) => {
            for (let i = 0; i < count; i++) {
                const t  = pseudo(idx);
                const t2 = pseudo(idx + 50);
                const t3 = pseudo(idx + 100);
                const length = minL + t * (maxL - minL);
                const radius = 0.07 + t2 * 0.18;
                const x = -5.5 + (i / Math.max(count - 1, 1)) * 11 + (t3 - 0.5) * 0.8;
                const geo = new THREE.OctahedronGeometry(radius, 0).toNonIndexed();
                geo.scale(1, length / (radius * 2), 1);
                geo.rotateX(0.2 + t * 0.4);
                geo.rotateZ((t2 - 0.5) * 0.5);
                geo.translate(x, y + length * 0.3, -32.5);
                geos.push(geo);
                idx++;
            }
        });

        // Backing slab fills wall gaps between spikes
        const slab = new THREE.BoxGeometry(14, 8, 0.5).toNonIndexed();
        slab.translate(0, 4, -32.8);
        geos.push(slab);

        this._lp(scene, geos, echo, mats.get('crystal'));

        const wallLight = new THREE.PointLight(0x66aaff, 0, 18);
        wallLight.position.set(0, 4, -31);
        wallLight.userData._isCrystalLight = true;
        scene.add(wallLight);
        this.featureLights.push(wallLight);
    }

    // ============================================================
    //  PART 3 — Main Chamber: Ceremonial Focal Point
    // ============================================================
    _eCeremonialArea(scene, mats) {
        const echoStone = this.echoShaderSystem.createMaterial({
            colorTint: [0.9, 0.6, 0.2], ringSharpness: 0.45, decayMultiplier: 1.1
        });
        const stoneGeos = [];

        // Altar stone
        const altar = new THREE.BoxGeometry(2.5, 0.55, 1.2).toNonIndexed();
        altar.translate(-2, 1.0, -6);
        stoneGeos.push(altar);
        [[-1.0, -6], [-3.0, -6]].forEach(([ax, az]) => {
            const leg = new THREE.BoxGeometry(0.45, 0.95, 0.45).toNonIndexed();
            leg.translate(ax, 0.475, az);
            stoneGeos.push(leg);
        });
        [[-1.6, -5.8], [-2.4, -6.2]].forEach(([bx, bz]) => {
            const rim = new THREE.CylinderGeometry(0.18, 0.14, 0.15, 6, 1).toNonIndexed();
            rim.translate(bx, 1.36, bz);
            stoneGeos.push(rim);
        });

        // Fire pit ring
        const ring = new THREE.TorusGeometry(0.9, 0.22, 4, 8).toNonIndexed();
        ring.rotateX(Math.PI / 2);
        ring.translate(5, 0.22, -2);
        stoneGeos.push(ring);
        [0, 1, 2, 3].forEach(i => {
            const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
            const seat = new THREE.BoxGeometry(0.9, 0.28, 0.5).toNonIndexed();
            seat.rotateY(ang);
            seat.translate(5 + Math.cos(ang) * 1.8, 0.14, -2 + Math.sin(ang) * 1.8);
            stoneGeos.push(seat);
        });
        this._lp(scene, stoneGeos, echoStone, mats.get('cave'), true);

        // Emissive fire disc in pit center
        const echoFire = this.echoShaderSystem.createMaterial({
            colorTint: [1.0, 0.4, 0.1], ringSharpness: 0.05, decayMultiplier: 0.3
        });
        const fireGeo = new THREE.CylinderGeometry(0.6, 0.65, 0.06, 8).toNonIndexed();
        fireGeo.translate(5, 0.07, -2);
        this._lp(scene, [fireGeo], echoFire, mats.get('mineral'));

        // West wall painting panel
        const echoPaint2 = this.echoShaderSystem.createMaterial({
            colorTint: [0.8, 0.5, 0.2], ringSharpness: 0.6, decayMultiplier: 0.9
        });
        const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.5), echoPaint2);
        mesh2.position.set(-13.5, 4.5, -3);
        mesh2.rotation.y = Math.PI / 2;
        mesh2.userData.echoMaterial = echoPaint2;
        mesh2.userData.realMaterial = mats.get('painting');
        scene.add(mesh2);
        this.caveBuilder.echoTargets.push(mesh2);

        // South wall painting panel
        const echoPaint3 = this.echoShaderSystem.createMaterial({
            colorTint: [0.8, 0.5, 0.2], ringSharpness: 0.6, decayMultiplier: 0.9
        });
        const mesh3 = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.8), echoPaint3);
        mesh3.position.set(-3, 4.0, 14.5);
        mesh3.rotation.y = Math.PI;
        mesh3.userData.echoMaterial = echoPaint3;
        mesh3.userData.realMaterial = mats.get('painting');
        scene.add(mesh3);
        this.caveBuilder.echoTargets.push(mesh3);
    }

    // ============================================================
    //  PART 4 — Bat Alcove: Ecological Detail
    // ============================================================
    _eBatAlcoveDetail(scene, mats) {
        // Guano mounds on the floor
        const echoGuano = this.echoShaderSystem.createMaterial({
            colorTint: [0.7, 0.5, 0.3], ringSharpness: 0.2, decayMultiplier: 0.9
        });
        const guanoGeos = [];
        [
            { x: -21, z: -3, r: 0.55 }, { x: -23, z:  1, r: 0.80 },
            { x: -20, z:  3, r: 0.45 }, { x: -24, z: -2, r: 0.70 },
            { x: -22, z:  2, r: 0.60 }, { x: -19, z:  0, r: 0.38 },
            { x: -25, z:  0, r: 0.50 }, { x: -23, z: -4, r: 0.42 },
            { x: -20, z: -1, r: 0.65 }, { x: -22, z:  4, r: 0.35 },
        ].forEach(({ x, z, r }) => {
            const dome = new THREE.SphereGeometry(r, 6, 4, 0, Math.PI*2, 0, Math.PI*0.55).toNonIndexed();
            dome.translate(x, r * 0.18, z);
            guanoGeos.push(dome);
        });
        this._lp(scene, guanoGeos, echoGuano, mats.get('cave'));

        // Wall drip formations on east wall
        const echoDrip = this.echoShaderSystem.createMaterial({
            colorTint: [0.6, 0.4, 0.2], ringSharpness: 0.55, decayMultiplier: 0.8
        });
        const dripGeos = [];
        [-4, -2, 0, 2, 4].forEach((z, i) => {
            const h = 2.0 + (i % 2) * 1.2;
            const drip = new THREE.PlaneGeometry(0.18, h, 2, 6).toNonIndexed();
            const pa = drip.attributes.position;
            for (let vi = 0; vi < pa.count; vi++) {
                pa.setX(vi, pa.getX(vi) + Math.sin(pa.getY(vi) * 3.5 + i) * 0.04);
            }
            pa.needsUpdate = true;
            drip.rotateY(Math.PI / 2);
            drip.translate(-15.8, 3.5 - h * 0.5, z);
            dripGeos.push(drip);
        });
        this._lp(scene, dripGeos, echoDrip, mats.get('flowstone'));

        // Dense stalactite roost cluster above bat colony
        const echoRoost = this.echoShaderSystem.createMaterial({
            colorTint: [0.8, 0.3, 0.2], ringSharpness: 0.15, decayMultiplier: 0.7
        });
        const roostGeos = [];
        for (let i = 0; i < 18; i++) {
            const pseudo = (n) => Math.abs(Math.sin(n * 91.3 + i * 47.7));
            const h  = 1.0 + pseudo(0) * 2.8;
            const r  = 0.06 + pseudo(1) * 0.18;
            const bx = -22 + (pseudo(2) - 0.5) * 9;
            const bz = (pseudo(3) - 0.5) * 7;
            const g  = new THREE.ConeGeometry(r, h, 5, 1).toNonIndexed();
            g.translate(bx, 13 - h * 0.5, bz);
            roostGeos.push(g);
        }
        this._lp(scene, roostGeos, echoRoost, mats.get('stalactite'));
    }


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
