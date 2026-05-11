import * as THREE from 'three';

export class CaveMaterials {
    constructor() {
        this.textures = this.generateTextures();
        this.materials = new Map();
        
        this.materials.set('cave', new THREE.MeshPhysicalMaterial({
            color: 0x4a4a4f,
            roughness: 0.8,
            metalness: 0.1,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(2.0, 2.0),
            roughnessMap: this.textures.roughnessMap,
            side: THREE.BackSide  // The cave shell is an inside-out box
        }));
        
        this.materials.set('stalactite', new THREE.MeshPhysicalMaterial({
            color: 0x22aadd,
            roughness: 0.2,
            metalness: 0.1,
            transmission: 0.6, 
            thickness: 1.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(0.5, 0.5)
        }));
        
        this.materials.set('archway', new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            roughness: 0.1,
            metalness: 0.9, 
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            normalMap: this.textures.normalMap,
            normalScale: new THREE.Vector2(0.2, 0.2)
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
                data[i+1] = val;
                data[i+2] = val;
                data[i+3] = 255;
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
                nData[i+1] = Math.floor((normal.y * 0.5 + 0.5) * 255);
                nData[i+2] = Math.floor((normal.z * 0.5 + 0.5) * 255);
                nData[i+3] = 255;
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
}
