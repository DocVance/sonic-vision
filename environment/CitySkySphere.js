import * as THREE from 'three';

export class CitySkySphere {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.visible = false;
        this._clouds = [];
        this._buildSky();
        this._buildStars();
        this._buildMoon();
        this._buildClouds();
        scene.add(this.group);
    }

    show() { this.group.visible = true; }
    hide() { this.group.visible = false; }

    update(dt) {
        this._clouds.forEach(c => {
            c.position.x += c.userData.dx * dt;
            c.position.z += c.userData.dz * dt;
            if (c.position.x >  100) c.position.x = -100;
            if (c.position.x < -100) c.position.x =  100;
        });
    }

    _buildSky() {
        const geo = new THREE.SphereGeometry(220, 20, 14);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            uniforms: {},
            vertexShader: `
                varying float vY;
                void main() {
                    vY = normalize(position).y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying float vY;
                void main() {
                    float t = clamp(vY * 1.2 + 0.1, 0.0, 1.0);
                    vec3 zenith  = vec3(0.02, 0.06, 0.18);
                    vec3 horizon = vec3(0.07, 0.14, 0.32);
                    gl_FragColor = vec4(mix(horizon, zenith, t), 1.0);
                }
            `
        });
        this.group.add(new THREE.Mesh(geo, mat));
    }

    _buildStars() {
        const N = 380;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(1 - Math.random() * 0.7); // upper sky only
            const r = 210;
            pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
            pos[i*3+1] = r * Math.cos(phi) + 10;
            pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff, size: 0.9, sizeAttenuation: false,
            transparent: true, opacity: 0.75, depthWrite: false, fog: false
        });
        this.group.add(new THREE.Points(geo, mat));
    }

    _buildMoon() {
        const geo = new THREE.SphereGeometry(5, 14, 10);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xddeeff, emissive: 0xaabbcc, emissiveIntensity: 0.7,
            roughness: 0.95, fog: false
        });
        const moon = new THREE.Mesh(geo, mat);
        moon.position.set(70, 130, -160);
        this.group.add(moon);
        // Soft directional light from moon
        const ml = new THREE.DirectionalLight(0x7799bb, 0.35);
        ml.position.set(70, 130, -160);
        this.group.add(ml);
    }

    _buildClouds() {
        const tex = this._cloudTex();
        [
            { x: -40, y: 48, z: -70, w: 70, d: 28, dx:  0.9, dz:  0.2 },
            { x:  55, y: 58, z: -50, w: 90, d: 34, dx: -0.6, dz:  0.3 },
            { x: -65, y: 52, z:  35, w: 65, d: 24, dx:  0.7, dz: -0.1 },
            { x:  25, y: 62, z:  65, w: 80, d: 30, dx: -0.8, dz:  0.15 },
        ].forEach(({ x, y, z, w, d, dx, dz }) => {
            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(w, d),
                new THREE.MeshBasicMaterial({
                    map: tex, transparent: true, opacity: 0.2,
                    depthWrite: false, fog: false, side: THREE.DoubleSide
                })
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, y, z);
            mesh.userData = { dx, dz };
            this.group.add(mesh);
            this._clouds.push(mesh);
        });
    }

    _cloudTex() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');
        [[256,128,110],[170,110,75],[340,140,85],[200,155,60],[320,110,65],[256,80,50]]
            .forEach(([cx, cy, r]) => {
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                g.addColorStop(0, 'rgba(210,228,255,0.65)');
                g.addColorStop(1, 'rgba(190,215,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            });
        return new THREE.CanvasTexture(c);
    }
}
