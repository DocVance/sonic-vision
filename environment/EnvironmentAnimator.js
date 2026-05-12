import * as THREE from 'three';

/**
 * Per-frame animation driver for living environment elements.
 */
export class EnvironmentAnimator {
    constructor() {
        this.elapsed = 0;
        this.waterMesh = null;
        this.fungiEntries = [];
        this.batMesh = null;
        this._batBasePositions = null;
        this.waterfallMesh = null;
    }

    registerWater(mesh) { this.waterMesh = mesh; }

    registerFungus(mesh, phase) {
        this.fungiEntries.push({ mesh, phase, speed: 0.4 + Math.random() * 0.6 });
    }

    registerBats(mesh) {
        this.batMesh = mesh;
        const pos = mesh.geometry.attributes.position;
        this._batBasePositions = new Float32Array(pos.array);
    }

    registerWaterfall(mesh) {
        this.waterfallMesh = mesh;
    }

    update(dt) {
        this.elapsed += dt;
        const t = this.elapsed;

        if (this.waterMesh && this.waterMesh.material.normalMap) {
            this.waterMesh.material.normalMap.offset.x = t * 0.02;
            this.waterMesh.material.normalMap.offset.y = t * 0.015;
        }

        for (const entry of this.fungiEntries) {
            const mat = entry.mesh.material;
            if (mat.emissiveIntensity !== undefined) {
                mat.emissiveIntensity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * entry.speed + entry.phase));
            }
        }

        if (this.batMesh && this._batBasePositions) {
            const pos = this.batMesh.geometry.attributes.position;
            const base = this._batBasePositions;
            for (let i = 0; i < pos.count; i++) {
                // Deterministic jitter using sin waves — reproducible across sessions
                const phase = i * 1.7;
                const burst = Math.sin(t * 0.2 + phase) > 0.92 ? 0.06 : 0.008;
                const jx = Math.sin(t * 3.7 + phase * 2.3) * burst;
                const jy = Math.sin(t * 4.1 + phase * 1.9) * burst;
                const jz = Math.sin(t * 2.9 + phase * 3.1) * burst * 0.5;
                pos.array[i * 3]     = base[i * 3]     + jx;
                pos.array[i * 3 + 1] = base[i * 3 + 1] + jy;
                pos.array[i * 3 + 2] = base[i * 3 + 2] + jz;
            }
            pos.needsUpdate = true;
        }

        if (this.waterfallMesh && this.waterfallMesh.userData._basePositions) {
            const pos = this.waterfallMesh.geometry.attributes.position;
            const base = this.waterfallMesh.userData._basePositions;
            for (let i = 0; i < pos.count; i++) {
                const bx = base[i * 3];
                const bz = base[i * 3 + 2];
                const by = base[i * 3 + 1];
                const wave = Math.sin(by * 3.0 + t * 6.0 + i * 0.3) * 0.08;
                pos.array[i * 3]     = bx + wave;
                pos.array[i * 3 + 2] = bz + wave * 0.5;
            }
            pos.needsUpdate = true;
        }
    }
}
