import * as THREE from 'three';

export class CityMaterials {
    constructor() {
        this.materials = new Map();
        this._build();
    }

    _build() {
        this.materials.set('asphalt', new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.95, metalness: 0.0 }));
        this.materials.set('concrete', new THREE.MeshStandardMaterial({ color: 0x9090a0, roughness: 0.8, metalness: 0.0 }));
        this.materials.set('building', new THREE.MeshPhysicalMaterial({ color: 0x8a8a96, roughness: 0.8, metalness: 0.05, clearcoat: 0.1 }));
        this.materials.set('glass', new THREE.MeshPhysicalMaterial({ color: 0x2244aa, roughness: 0.05, metalness: 0.1, transmission: 0.6, thickness: 0.3, clearcoat: 1.0, transparent: true, opacity: 0.75 }));
        this.materials.set('brick', new THREE.MeshStandardMaterial({ color: 0x8b3a2a, roughness: 0.85, metalness: 0.0 }));
        this.materials.set('metal', new THREE.MeshPhysicalMaterial({ color: 0x556677, roughness: 0.3, metalness: 0.8, clearcoat: 0.4 }));
        this.materials.set('mailbox', new THREE.MeshStandardMaterial({ color: 0x1155bb, roughness: 0.45, metalness: 0.5 }));
        this.materials.set('hydrant', new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.5, metalness: 0.3 }));
        this.materials.set('foliage', new THREE.MeshStandardMaterial({ color: 0x2d5a1b, roughness: 1.0, metalness: 0.0 }));
        this.materials.set('trunk', new THREE.MeshStandardMaterial({ color: 0x5c3d1a, roughness: 0.9, metalness: 0.0 }));
        this.materials.set('wood', new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8, metalness: 0.0 }));
        this.materials.set('window', new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffcc44, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.0 }));
        this.materials.set('lampGlobe', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeebb, emissiveIntensity: 2.0, roughness: 0.1, metalness: 0.0 }));
        this.materials.set('dumpster', new THREE.MeshStandardMaterial({ color: 0x1a3d1a, roughness: 0.7, metalness: 0.2 }));
        this.materials.set('institutional', new THREE.MeshPhysicalMaterial({ color: 0xd0ccbe, roughness: 0.6, metalness: 0.02, clearcoat: 0.2 }));
        this.materials.set('residential', new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 0.75, metalness: 0.0 }));
        this.materials.set('stone', new THREE.MeshPhysicalMaterial({ color: 0xaaa898, roughness: 0.6, metalness: 0.02 }));
        this.materials.set('grass', new THREE.MeshStandardMaterial({ color: 0x3a6b20, roughness: 1.0, metalness: 0.0 }));
        this.materials.set('roof', new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.9, metalness: 0.05 }));
        this.materials.set('awning', new THREE.MeshStandardMaterial({ color: 0x992222, roughness: 0.85, metalness: 0.0 }));
    }

    get(name) { return this.materials.get(name); }
}
