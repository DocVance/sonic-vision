import * as THREE from 'three';

export class CaveMaterials {
    constructor() {
        this.textures = this.generateTextures();
        this.materials = new Map();

        // --- Cave walls / general stone ---
        this.materials.set('cave', new THREE.MeshStandardMaterial({
            color: 0x4a4a4f,
            roughness: 0.85,
            metalness: 0.05,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(1.5, 1.5),
            roughnessMap: this.textures.roughnessMap,
            side: THREE.DoubleSide
        }));

        // Stalactite: emissive blue-white tint fakes translucency without transmission cost
        this.materials.set('stalactite', new THREE.MeshStandardMaterial({
            color: 0x4499bb,
            roughness: 0.25,
            metalness: 0.15,
            emissive: 0x113344,
            emissiveIntensity: 0.4,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(0.4, 0.4)
        }));

        // --- Archway obsidian ---
        this.materials.set('archway', new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            roughness: 0.1,
            metalness: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(0.2, 0.2)
        }));

        // Crystal: emissive glow + mild transparency — no transmission pass needed
        this.materials.set('crystal', new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            roughness: 0.05,
            metalness: 0.2,
            emissive: 0x2255ff,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.82,
            side: THREE.DoubleSide
        }));

        // Water: emissive dark teal, no transmission pass
        this.materials.set('water', new THREE.MeshStandardMaterial({
            color: 0x0a2a3a,
            roughness: 0.05,
            metalness: 0.3,
            emissive: 0x001a2a,
            emissiveIntensity: 0.35,
            transparent: true,
            opacity: 0.80
        }));

        // --- Bioluminescent fungi ---
        this.materials.set('fungi', new THREE.MeshStandardMaterial({
            color: 0x22ff88,
            roughness: 0.6,
            metalness: 0.0,
            emissive: 0x00ff66,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        }));

        // --- Cave painting surface ---
        this.materials.set('painting', new THREE.MeshBasicMaterial({
            map: this._generatePaintingTexture(),
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        }));

        // --- Mineral vein (emissive lines on walls) ---
        this.materials.set('mineral', new THREE.MeshStandardMaterial({
            color: 0x553311,
            roughness: 0.3,
            metalness: 0.7,
            emissive: 0xff8800,
            emissiveIntensity: 0.4
        }));

        // --- Bat body ---
        this.materials.set('bat', new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.9,
            metalness: 0.0
        }));

        // --- Flowstone curtain ---
        this.materials.set('flowstone', new THREE.MeshPhysicalMaterial({
            color: 0x8b7355,
            roughness: 0.4,
            metalness: 0.05,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(1.5, 1.5),
            side: THREE.DoubleSide
        }));

        // --- Waterfall ---
        this.materials.set('waterfall', new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            roughness: 0.1,
            metalness: 0.0,
            emissive: 0x224466,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        }));
    }

    get(name) {
        return this.materials.get(name);
    }

    generateTextures() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const nx = x / size;
                const ny = y / size;
                let noise = Math.sin(nx * 50) * Math.cos(ny * 50) * 0.5 + 0.5;
                noise += (Math.random() * 0.2 - 0.1);
                const val = Math.floor(Math.max(0, Math.min(1, noise)) * 255);
                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
                data[i + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const normalCanvas = document.createElement('canvas');
        normalCanvas.width = size;
        normalCanvas.height = size;
        const nCtx = normalCanvas.getContext('2d');
        const nImgData = nCtx.createImageData(size, size);
        const nData = nImgData.data;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const xl = (x - 1 + size) % size;
                const xr = (x + 1) % size;
                const yb = (y - 1 + size) % size;
                const yt = (y + 1) % size;
                const hL = data[(y * size + xl) * 4] / 255.0;
                const hR = data[(y * size + xr) * 4] / 255.0;
                const hB = data[(yb * size + x) * 4] / 255.0;
                const hT = data[(yt * size + x) * 4] / 255.0;
                const dzdx = (hR - hL) * 2.0;
                const dzdy = (hT - hB) * 2.0;
                const normal = new THREE.Vector3(-dzdx, -dzdy, 1.0).normalize();
                nData[i] = Math.floor((normal.x * 0.5 + 0.5) * 255);
                nData[i + 1] = Math.floor((normal.y * 0.5 + 0.5) * 255);
                nData[i + 2] = Math.floor((normal.z * 0.5 + 0.5) * 255);
                nData[i + 3] = 255;
            }
        }
        nCtx.putImageData(nImgData, 0, 0);

        const normalMap = new THREE.CanvasTexture(normalCanvas);
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(8, 8);

        const roughnessMap = new THREE.CanvasTexture(canvas);
        roughnessMap.wrapS = THREE.RepeatWrapping;
        roughnessMap.wrapT = THREE.RepeatWrapping;
        roughnessMap.repeat.set(8, 8);

        return { normalMap, roughnessMap };
    }

    _generateWaterNormalMap() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        const d = imgData.data;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const nx = x / size * Math.PI * 8;
                const ny = y / size * Math.PI * 8;
                const wave1 = Math.sin(nx * 1.5 + ny * 0.8) * 0.5;
                const wave2 = Math.sin(nx * 3.2 - ny * 2.1) * 0.3;
                const wave3 = Math.sin(nx * 0.7 + ny * 4.3) * 0.2;
                const h = (wave1 + wave2 + wave3);
                d[i]     = Math.floor((h * 0.3 + 0.5) * 255);
                d[i + 1] = Math.floor((-h * 0.3 + 0.5) * 255);
                d[i + 2] = 200;
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        return tex;
    }

    _generatePaintingTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Transparent base
        ctx.clearRect(0, 0, 1024, 512);

        // Ochre pigment style
        ctx.strokeStyle = 'rgba(180, 100, 40, 0.9)';
        ctx.fillStyle = 'rgba(180, 100, 40, 0.7)';
        ctx.lineWidth = 3;

        // Draw stylized bat silhouettes
        const drawBat = (cx, cy, s) => {
            ctx.beginPath();
            // Body
            ctx.ellipse(cx, cy, s * 0.3, s * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Left wing
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.3, cy - s * 0.1);
            ctx.quadraticCurveTo(cx - s * 1.2, cy - s * 0.8, cx - s * 1.0, cy + s * 0.3);
            ctx.quadraticCurveTo(cx - s * 0.5, cy, cx - s * 0.3, cy + s * 0.1);
            ctx.fill();
            // Right wing
            ctx.beginPath();
            ctx.moveTo(cx + s * 0.3, cy - s * 0.1);
            ctx.quadraticCurveTo(cx + s * 1.2, cy - s * 0.8, cx + s * 1.0, cy + s * 0.3);
            ctx.quadraticCurveTo(cx + s * 0.5, cy, cx + s * 0.3, cy + s * 0.1);
            ctx.fill();
        };

        // Scattered bats
        drawBat(200, 200, 50);
        drawBat(400, 150, 35);
        drawBat(300, 300, 45);
        drawBat(550, 250, 40);
        drawBat(700, 180, 30);

        // Handprints in charcoal
        ctx.fillStyle = 'rgba(60, 50, 45, 0.6)';
        const drawHand = (cx, cy, s) => {
            // Palm
            ctx.beginPath();
            ctx.ellipse(cx, cy, s * 0.6, s * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            // Fingers
            for (let f = 0; f < 5; f++) {
                const angle = -0.5 + f * 0.25;
                const fx = cx + Math.sin(angle) * s * 1.2;
                const fy = cy - Math.cos(angle) * s * 1.2;
                ctx.beginPath();
                ctx.ellipse(fx, fy, s * 0.15, s * 0.4, angle, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        drawHand(150, 400, 30);
        drawHand(850, 350, 35);
        drawHand(600, 420, 25);

        // Wavy lines suggesting echolocation waves
        ctx.strokeStyle = 'rgba(200, 120, 50, 0.5)';
        ctx.lineWidth = 2;
        for (let arc = 0; arc < 4; arc++) {
            ctx.beginPath();
            const r = 60 + arc * 30;
            ctx.arc(400, 150, r, -0.8, 0.8);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }
}
