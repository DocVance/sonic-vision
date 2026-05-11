import * as THREE from 'three';

export class CaveBuilder {
    constructor(echoShaderSystem) {
        this.echoShaderSystem = echoShaderSystem;
        this.echoTargets = [];
    }

    build(scene, caveMaterials) {
        // Use a single inside-out BoxGeometry instead of 6 separate planes.
        // This guarantees:
        //   (a) No seams or gaps at corners — the geometry is one continuous mesh
        //   (b) BackSide rendering means we see the inner faces naturally
        //   (c) Noise displacement on a connected mesh produces organic,
        //       rounded-looking cave walls rather than sharp-edged flat panels

        const segments = 24; // Resolution per face
        const geo = new THREE.BoxGeometry(40, 10, 40, segments, segments, segments);

        // Flip normals so the inside face is rendered
        geo.scale(-1, 1, 1); // Mirrors X axis, effectively flipping all normals inward

        // Shift the box so floor is at y=0, ceiling at y=10
        geo.translate(0, 5, 0);

        this._applyOrganicNoise(geo);
        geo.computeVertexNormals();

        // Echo (bat vision) material — completely dark, shader-lit
        const caveEchoMaterial = this.echoShaderSystem.createMaterial({
            colorTint: [0.8, 0.6, 0.2],
            ringSharpness: 0.5,
            decayMultiplier: 1.5
        });

        const caveMesh = new THREE.Mesh(geo, caveEchoMaterial);
        caveMesh.userData.echoMaterial = caveEchoMaterial;
        caveMesh.userData.realMaterial = caveMaterials.get('cave');

        scene.add(caveMesh);
        this.echoTargets.push(caveMesh);
    }

    /**
     * Displaces vertices with layered, deterministic sine noise + random jitter.
     * The noise is applied in the vertex's own outward direction from center,
     * which means it pushes walls inward and ceiling/floor toward each other —
     * producing natural cave constrictions rather than random jags.
     */
    _applyOrganicNoise(geometry) {
        const posAttr = geometry.attributes.position;
        const center = new THREE.Vector3(0, 5, 0);
        const vertex = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);

            // Layered noise: large-scale undulation + medium frequency detail + fine jitter
            const large = Math.sin(vertex.x * 0.18) * Math.cos(vertex.z * 0.18) * 1.4;
            const medium = Math.sin(vertex.x * 0.55 + vertex.y * 0.4) * Math.cos(vertex.z * 0.55) * 0.6;
            const fine = (Math.random() - 0.5) * 0.35;

            const totalNoise = large + medium + fine;

            // Push along the face normal (outward from center), not just Y.
            // This keeps walls thick-looking rather than just wavy on Y.
            const dir = vertex.clone().sub(center).normalize();

            vertex.addScaledVector(dir, totalNoise);

            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        posAttr.needsUpdate = true;
    }

    getEchoTargets() {
        return this.echoTargets;
    }
}
