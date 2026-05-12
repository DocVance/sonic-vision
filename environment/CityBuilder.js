import * as THREE from 'three';

export class CityBuilder {
    constructor(echoShaderSystem) {
        this.ess = echoShaderSystem;
        this._echoTargets = [];
        this._colliders = [];
        this._featureLights = [];
        this._audioSources = [];
    }

    getEchoTargets() { return this._echoTargets; }
    getColliders()   { return this._colliders; }
    getFeatureLights() { return this._featureLights; }
    getAudioSourceConfigs() { return this._audioSources; }

    build(scene, mats) {
        this._ground(scene, mats);
        this._blockCommercial(scene, mats);
        this._blockPark(scene, mats);
        this._blockResidential(scene, mats);
        this._blockApartment(scene, mats);
        this._blockPublicSquare(scene, mats);
        this._blockMixedRetail(scene, mats);
        this._streetFurniture(scene, mats);
        this._cityLighting(scene);
        this._detailPass(scene, mats);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    _box(scene, mats, matKey, x, y, z, w, h, d, echoTint, asCollider = true) {
        const geo  = new THREE.BoxGeometry(w, h, d);
        const real = mats.get(matKey);
        const echo = this.ess.createMaterial({ colorTint: echoTint || [0.3,0.9,1.0], ringSharpness: 0.4 });
        const mesh = new THREE.Mesh(geo, echo);
        mesh.position.set(x, y, z);
        mesh.userData.echoMaterial = echo;
        mesh.userData.realMaterial = real;
        scene.add(mesh);
        this._echoTargets.push(mesh);
        if (asCollider) this._colliders.push(mesh);
        return mesh;
    }

    _cyl(scene, mats, matKey, x, y, z, rt, rb, h, seg, echoTint) {
        const geo  = new THREE.CylinderGeometry(rt, rb, h, seg);
        const real = mats.get(matKey);
        const echo = this.ess.createMaterial({ colorTint: echoTint || [0.3,0.9,1.0], ringSharpness: 0.4 });
        const mesh = new THREE.Mesh(geo, echo);
        mesh.position.set(x, y, z);
        mesh.userData.echoMaterial = echo;
        mesh.userData.realMaterial = real;
        scene.add(mesh);
        this._echoTargets.push(mesh);
        this._colliders.push(mesh);
        return mesh;
    }

    // Variable window: irregular lit/dark + warm/cool tint variation
    _win(scene, mats, x, y, z, w, h, idx = 0) {
        const dark   = (idx % 7 === 0) || (idx % 11 === 3); // ~25% dark
        const cool   = (idx % 3 === 1);                     // some windows slightly cooler
        if (dark) {
            // Dark window — still a sonar target, uses glass material
            this._box(scene, mats, 'glass', x, y, z, w, h, 0.1, [0.3,0.35,0.55], false);
        } else {
            const tint = cool ? [0.85,0.92,1.0] : [1.0,0.9,0.5];
            this._box(scene, mats, 'window', x, y, z, w, h, 0.1, tint, false);
        }
    }

    // Low-poly parked car: body + cabin + 4 wheels (fixed N-S orientation)
    _car(scene, mats, x, z, echoTint) {
        const t = echoTint || [0.4,0.5,0.65];
        this._box(scene, mats, 'metal', x, 0.45, z,   1.8, 0.8, 4.2, t);          // body
        this._box(scene, mats, 'metal', x, 0.95, z-0.3, 1.4, 0.55, 2.4, t, false); // cabin
        // Wheels
        [[0.85,-1.5],[0.85,1.5],[-0.85,-1.5],[-0.85,1.5]].forEach(([wx,wz]) => {
            const wm = this._cyl(scene, mats, 'metal', x+wx, 0.22, z+wz, 0.26, 0.26, 0.22, 8, [0.15,0.15,0.15]);
            wm.rotation.z = Math.PI / 2;
        });
        // Headlights
        this._box(scene, mats, 'window', x-0.5, 0.46, z+2.12, 0.35, 0.2, 0.05, [1,0.95,0.8], false);
        this._box(scene, mats, 'window', x+0.5, 0.46, z+2.12, 0.35, 0.2, 0.05, [1,0.95,0.8], false);
    }

    _cone(scene, mats, matKey, x, y, z, r, h, seg, echoTint) {
        const geo  = new THREE.ConeGeometry(r, h, seg);
        const real = mats.get(matKey);
        const echo = this.ess.createMaterial({ colorTint: echoTint || [0.2,0.8,0.3], ringSharpness: 0.3 });
        const mesh = new THREE.Mesh(geo, echo);
        mesh.position.set(x, y, z);
        mesh.userData.echoMaterial = echo;
        mesh.userData.realMaterial = real;
        scene.add(mesh);
        this._echoTargets.push(mesh);
        return mesh;
    }

    _tree(scene, mats, x, z) {
        this._cyl(scene, mats, 'trunk', x, 1.2, z, 0.15, 0.18, 2.4, 6, [0.4,0.25,0.1]);
        this._cone(scene, mats, 'foliage', x, 4.2, z, 1.2, 3.0, 7, [0.2,0.8,0.3]);
        this._cone(scene, mats, 'foliage', x, 5.8, z, 0.85, 2.2, 7, [0.2,0.8,0.3]);
        this._cone(scene, mats, 'foliage', x, 7.0, z, 0.5,  1.4, 7, [0.2,0.8,0.3]);
    }

    _lamp(scene, mats, x, z) {
        this._cyl(scene, mats, 'metal', x, 2.5, z, 0.07, 0.09, 5.0, 6, [0.5,0.7,0.9]);
        this._box(scene, mats, 'metal', x + 0.5, 5.1, z, 1.0, 0.12, 0.12, [0.5,0.7,0.9], false);
        const globe = this._cyl(scene, mats, 'lampGlobe', x + 1.0, 5.0, z, 0.22, 0.22, 0.35, 8, [1.0,0.95,0.7]);
        const pl = new THREE.PointLight(0xffd080, 1.2, 14, 2);
        pl.position.set(x + 1.0, 5.0, z);
        pl.userData._isCityLamp = true;
        pl.intensity = 0; // starts dark
        scene.add(pl);
        this._featureLights.push(pl);
    }

    _hydrant(scene, mats, x, z) {
        this._cyl(scene, mats, 'hydrant', x, 0.3, z, 0.13, 0.15, 0.6, 8, [0.9,0.2,0.1]);
        this._box(scene, mats, 'hydrant', x - 0.2, 0.35, z, 0.12, 0.1, 0.3, [0.9,0.2,0.1], false);
        this._box(scene, mats, 'hydrant', x + 0.2, 0.35, z, 0.12, 0.1, 0.3, [0.9,0.2,0.1], false);
    }

    _mailbox(scene, mats, x, z) {
        this._cyl(scene, mats, 'metal', x, 0.6, z, 0.04, 0.04, 1.2, 6, [0.4,0.6,0.9]);
        this._box(scene, mats, 'mailbox', x, 1.35, z, 0.45, 0.4, 0.35, [0.3,0.5,1.0], false);
    }

    _bench(scene, mats, x, z, ry = 0) {
        const g = new THREE.Group();
        const seat  = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.08,0.45), mats.get('wood'));
        const back  = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.4,0.06),  mats.get('wood'));
        const legL  = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.4,0.45), mats.get('metal'));
        const legR  = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.4,0.45), mats.get('metal'));
        seat.position.set(0, 0.44, 0);
        back.position.set(0, 0.7, -0.2);
        legL.position.set(-0.7, 0.2, 0);
        legR.position.set( 0.7, 0.2, 0);
        [seat,back,legL,legR].forEach(m => g.add(m));
        g.position.set(x, 0, z);
        g.rotation.y = ry;
        scene.add(g);
        [seat,back].forEach(m => {
            const echo = this.ess.createMaterial({ colorTint:[0.7,0.5,0.2], ringSharpness:0.4 });
            m.userData.echoMaterial = echo;
            m.userData.realMaterial = mats.get('wood');
            m.material = echo;
            this._echoTargets.push(m);
        });
    }

    _fence(scene, mats, x, z, len, axis = 'x') {
        const count = Math.floor(len / 0.9);
        for (let i = 0; i < count; i++) {
            const px = axis === 'x' ? x + i * 0.9 : x;
            const pz = axis === 'z' ? z + i * 0.9 : z;
            this._box(scene, mats, 'wood', px, 0.6, pz, 0.06, 1.2, 0.06, [0.7,0.5,0.2], false);
        }
        const railY = [0.3, 0.95];
        railY.forEach(ry => {
            const rx = axis === 'x' ? x + len/2 : x;
            const rz = axis === 'z' ? z + len/2 : z;
            const rw = axis === 'x' ? len : 0.06;
            const rd = axis === 'z' ? len : 0.06;
            this._box(scene, mats, 'wood', rx, ry, rz, rw, 0.06, rd, [0.7,0.5,0.2], false);
        });
    }

    // ── ground ─────────────────────────────────────────────────────────────

    _ground(scene, mats) {
        // Street asphalt (N-S + E-W) — colliders so snapToFloor works
        this._box(scene, mats, 'asphalt', 0, -0.05, 0,   8, 0.1, 84, [0.2,0.2,0.25], true);
        this._box(scene, mats, 'asphalt', 0, -0.05, -19, 48, 0.1, 8,  [0.2,0.2,0.25], true);
        this._box(scene, mats, 'asphalt', 0, -0.05,  19, 48, 0.1, 8,  [0.2,0.2,0.25], true);
        // Sidewalk slabs — colliders for floor snap
        const swData = [
            [-15,-0.02,-30, 22,0.08,22], [15,-0.02,-30, 22,0.08,22],
            [-15,-0.02,  0, 22,0.08,22], [15,-0.02,  0, 22,0.08,22],
            [-15,-0.02, 30, 22,0.08,22], [15,-0.02, 30, 22,0.08,22],
        ];
        swData.forEach(d => this._box(scene, mats, 'concrete', d[0],d[1],d[2],d[3],d[4],d[5],[0.6,0.6,0.65], true));
        // Curb strips
        [[-4.3,-0.02,0],[4.3,-0.02,0]].forEach(([x,y,z]) =>
            this._box(scene,mats,'concrete',x,y,z,0.3,0.15,84,[0.6,0.6,0.65],false));
    }

    // ── Block [0,0] Commercial Strip (NW, center -15, -30) ─────────────────

    _blockCommercial(scene, mats) {
        const cx=-15, cz=-30;
        // Wide retail ground floor
        this._box(scene,mats,'building',cx,2,cz-4, 18,4,10,[0.5,0.6,0.8]);
        // Awning
        this._box(scene,mats,'awning',cx,4.15,cz+1, 16,0.25,2,[0.8,0.2,0.2],false);
        // Tall office behind
        this._box(scene,mats,'glass',cx,9,cz-8, 10,18,8,[0.3,0.5,0.9]);
        this._box(scene,mats,'building',cx,9,cz-8, 10,18,8,[0.4,0.5,0.8]);
        // Side stairwell
        this._box(scene,mats,'building',cx+7,5,cz-6, 3,10,6,[0.4,0.5,0.8]);
        // Window rows on office tower — variable lit/dark
        for(let fl=0;fl<5;fl++) for(let wd=0;wd<3;wd++) {
            this._win(scene,mats,cx-3+wd*3,3+fl*3,cz-4.05,1.2,1.6,fl*3+wd);
            // Window ledge below each window
            this._box(scene,mats,'building',cx-3+wd*3,2.1+fl*3,cz-4.1,1.4,0.08,0.15,[0.5,0.6,0.8],false);
        }
        // Cornice at retail roofline
        this._box(scene,mats,'building',cx,4.2,cz+1.1,18.4,0.25,0.2,[0.5,0.6,0.8],false);
        // Door frame on retail
        this._box(scene,mats,'metal',cx,2.2,cz+1.05,1.2,4.2,0.1,[0.5,0.7,0.9],false);
        this._box(scene,mats,'metal',cx-0.6,4.3,cz+1.05,0.1,0.25,0.1,[0.5,0.7,0.9],false);
        this._box(scene,mats,'metal',cx+0.6,4.3,cz+1.05,0.1,0.25,0.1,[0.5,0.7,0.9],false);
        // Trees along east sidewalk
        [cz-6, cz, cz+6].forEach(z => this._tree(scene,mats,cx+12,z));
        // Lamp
        this._lamp(scene,mats,cx+10, cz-9);
        // Audio: quiet café ambience at retail center
        this._audioSources.push({ position:new THREE.Vector3(cx,1.5,cz-2), type:'wind', intensity:0.08 });
    }

    // ── Block [1,0] Corner Park + Café (NE, center 15, -30) ────────────────

    _blockPark(scene, mats) {
        const cx=15, cz=-30;
        // Grass
        this._box(scene,mats,'grass',cx,-0.01,cz, 20,0.05,20,[0.2,0.7,0.2],false);
        // Café building (small, north corner)
        this._box(scene,mats,'brick',cx+4,2.5,cz-7, 10,5,8,[0.7,0.3,0.2]);
        this._box(scene,mats,'roof',cx+4,5.15,cz-7, 10.4,0.3,8.4,[0.3,0.3,0.35],false);
        // Café windows
        [[cx+4,3,cz-3.05],[cx,3,cz-3.05],[cx+8,3,cz-3.05]].forEach(([x,y,z]) =>
            this._box(scene,mats,'window',x,y,z,1.4,1.6,0.1,[1,0.9,0.5],false));
        // Fountain (center of park)
        this._cyl(scene,mats,'stone',cx-2,0.3,cz+3, 2,2.2,0.5,12,[0.6,0.6,0.65]);
        this._cyl(scene,mats,'stone',cx-2,0.6,cz+3, 1.3,1.3,0.15,12,[0.6,0.6,0.65]);
        // Park trees
        [[-4,-4],[0,-2],[3,4],[-6,2],[2,-7]].forEach(([dx,dz]) => this._tree(scene,mats,cx+dx,cz+dz));
        // Benches
        this._bench(scene,mats,cx-2,cz+5);
        this._bench(scene,mats,cx-2,cz+1,Math.PI);
        // Lamps
        this._lamp(scene,mats,cx-9,cz-9);
        this._lamp(scene,mats,cx+9,cz-9);
        // Audio: gentle wind in park
        this._audioSources.push({ position:new THREE.Vector3(cx,1.5,cz+2), type:'wind', intensity:0.12 });
    }

    // ── Block [0,1] Residential Row (MW, center -15, 0) ────────────────────

    _blockResidential(scene, mats) {
        const cx=-15, cz=0;
        // Three townhouses with slight variation
        const houses = [
            { x:cx-6, h:6.5, w:5.5, d:8, mat:'residential' },
            { x:cx,   h:7.8, w:5.5, d:8, mat:'residential' },
            { x:cx+6, h:5.8, w:5.5, d:8, mat:'brick'       },
        ];
        houses.forEach(({x,h,w,d,mat}) => {
            this._box(scene,mats,mat,        x,h/2,cz-4,  w,h,d,[0.8,0.6,0.4]);
            this._box(scene,mats,'roof',     x,h+0.2,cz-4,w+0.3,0.4,d+0.3,[0.3,0.3,0.35],false);
            // Door stoop
            this._box(scene,mats,'stone',    x,0.12,cz+0.5,1.0,0.25,0.8,[0.7,0.7,0.7],false);
            // Lit window
            this._box(scene,mats,'window',   x-0.8,h*0.55,cz-0.05,1.0,1.2,0.1,[1,0.9,0.5],false);
            this._box(scene,mats,'window',   x+0.8,h*0.55,cz-0.05,1.0,1.2,0.1,[1,0.9,0.5],false);
        });
        // Front fences
        this._fence(scene,mats,cx-9,cz+1, 18,'x');
        // Mailboxes near curb
        [cx-7, cx-1, cx+5].forEach(x => this._mailbox(scene,mats,x,cz+2.5));
        // Street tree
        this._tree(scene,mats,cx+10,cz);
        this._lamp(scene,mats,cx+10,cz-9);
        this._hydrant(scene,mats,cx+9,cz+2);
    }

    // ── Block [1,1] Apartment Complex (ME, center 15, 0) ───────────────────

    _blockApartment(scene, mats) {
        const cx=15, cz=0;
        // Main block
        this._box(scene,mats,'building',cx,6,cz, 16,12,14,[0.5,0.6,0.8]);
        this._box(scene,mats,'roof',cx,12.15,cz, 16.4,0.3,14.4,[0.3,0.3,0.35],false);
        // Lobby extension
        this._box(scene,mats,'glass',cx,2.5,cz+7.5, 6,5,3,[0.4,0.6,0.9]);
        // Window grid — variable (4 floors × 5 wide)
        for(let fl=0;fl<4;fl++) for(let wd=0;wd<5;wd++) {
            this._win(scene,mats,cx-8+wd*4,2.5+fl*2.5,cz-7.05,1.4,1.6,fl*5+wd);
        }
        // Cornice at roofline + mid-floor ledge band
        this._box(scene,mats,'building',cx,12.5,cz-7.15,16.6,0.3,0.25,[0.5,0.6,0.8],false);
        this._box(scene,mats,'building',cx,7.5,cz-7.15,16.6,0.15,0.2,[0.5,0.6,0.8],false);
        // Fire escape on south facade
        for(let fl=0;fl<4;fl++) {
            this._box(scene,mats,'metal',cx+7,1.5+fl*2.5,cz-7.1, 2.2,0.07,1.4,[0.5,0.7,0.9],false);
        }
        this._box(scene,mats,'metal',cx+8,5.5,cz-7.1, 0.08,10,0.08,[0.5,0.7,0.9],false);
        // AC units on roof
        [[cx-5,12.35,cz-3],[cx+3,12.35,cz+2],[cx-1,12.35,cz-6]].forEach(([ax,ay,az]) =>
            this._box(scene,mats,'metal',ax,ay,az,1.0,0.5,0.7,[0.4,0.5,0.6],false));
        // Dumpster enclosure at back
        this._box(scene,mats,'dumpster',cx-6,0.7,cz-9, 2.5,1.4,1.5,[0.2,0.4,0.2],false);
        this._box(scene,mats,'metal',cx+6,0.7,cz-9,   2.5,1.4,1.5,[0.3,0.4,0.3],false);
        // Parking meters at curb
        [cz-3, cz+3].forEach(z => {
            this._cyl(scene,mats,'metal',cx-9,0.7,z, 0.04,0.04,1.4,6,[0.5,0.7,0.9]);
            this._box(scene,mats,'metal',cx-9,1.5,z, 0.18,0.26,0.18,[0.5,0.7,0.9],false);
        });
        this._lamp(scene,mats,cx+9,cz-9);
        this._lamp(scene,mats,cx+9,cz+9);
        this._tree(scene,mats,cx-10,cz+6);
    }

    // ── Block [0,2] Public Square (SW, center -15, 30) ─────────────────────

    _blockPublicSquare(scene, mats) {
        const cx=-15, cz=30;
        // Plaza platform
        this._box(scene,mats,'stone',cx,0.15,cz, 18,0.3,18,[0.7,0.7,0.65],false);
        // Abstract sculpture (stacked prisms)
        this._box(scene,mats,'metal',cx,1.5,cz, 1.2,3,1.2,[0.6,0.8,0.9]);
        this._box(scene,mats,'metal',cx,3.5,cz, 0.8,1.5,2.2,[0.6,0.8,0.9]);
        this._box(scene,mats,'metal',cx-0.4,4.5,cz, 0.5,1,0.5,[0.6,0.8,0.9]);
        // Small kiosk
        this._box(scene,mats,'building',cx+5,1.5,cz+4, 2.5,3,2.5,[0.6,0.7,0.8]);
        this._box(scene,mats,'roof',cx+5,3.15,cz+4, 3,0.3,3,[0.3,0.3,0.35],false);
        // Benches around sculpture
        [[cx-3,cz+1,0],[cx+3,cz-1,Math.PI],[cx,cz+3,Math.PI/2],[cx,cz-3,-Math.PI/2]]
            .forEach(([x,z,r]) => this._bench(scene,mats,x,z,r));
        // Lamps at corners
        [[cx-8,cz-8],[cx+8,cz-8],[cx-8,cz+8],[cx+8,cz+8]]
            .forEach(([x,z]) => this._lamp(scene,mats,x,z));
        // Trees at square edges
        [[cx-9,cz+3],[cx+9,cz-3],[cx-9,cz-3]].forEach(([x,z]) => this._tree(scene,mats,x,z));
        // Audio: subtle wind on open plaza
        this._audioSources.push({ position:new THREE.Vector3(cx,1,cz), type:'wind', intensity:0.1 });
    }

    // ── Block [1,2] Mixed Retail + Library (SE, center 15, 30) ─────────────

    _blockMixedRetail(scene, mats) {
        const cx=15, cz=30;
        // Library (long, low, institutional)
        this._box(scene,mats,'institutional',cx,3.5,cz-5, 14,7,12,[0.7,0.7,0.65]);
        this._box(scene,mats,'roof',cx,7.15,cz-5, 14.4,0.3,12.4,[0.3,0.3,0.35],false);
        // Library windows (tall)
        [-4,0,4].forEach(dx =>
            this._box(scene,mats,'glass',cx+dx,3.5,cz+1.05, 1.8,5,0.1,[0.4,0.6,0.9],false));
        // Small retail box
        this._box(scene,mats,'brick',cx-4,2.5,cz+7, 8,5,6,[0.7,0.35,0.25]);
        this._box(scene,mats,'awning',cx-4,5.15,cz+4.05, 8,0.25,2,[0.8,0.2,0.2],false);
        // Retail window
        this._box(scene,mats,'window',cx-4,2.5,cz+4.05, 4,3,0.1,[1,0.9,0.5],false);
        // Newspaper boxes
        [[cx+4,cz+2],[cx+5,cz+2]].forEach(([x,z]) =>
            this._box(scene,mats,'metal',x,0.45,z, 0.45,0.9,0.35,[0.5,0.6,0.7],false));
        // Bike rack (thin bar)
        this._box(scene,mats,'metal',cx+6,0.6,cz+3, 1.8,0.06,0.06,[0.5,0.7,0.9],false);
        this._cyl(scene,mats,'metal',cx+5.2,0.3,cz+3, 0.04,0.04,0.6,6,[0.5,0.7,0.9]);
        this._cyl(scene,mats,'metal',cx+6.8,0.3,cz+3, 0.04,0.04,0.6,6,[0.5,0.7,0.9]);
        // Trees + lamp
        this._tree(scene,mats,cx+9,cz+5);
        this._tree(scene,mats,cx-9,cz+8);
        this._lamp(scene,mats,cx+9,cz+9);
        this._hydrant(scene,mats,cx-9,cz+2);
    }

    // ── Street furniture shared across all blocks ───────────────────────────

    _streetFurniture(scene, mats) {
        // Intersection lamps
        [[-4,-19],[4,-19],[-4,-11],[4,-11],[-4,11],[4,11],[-4,19],[4,19]]
            .forEach(([x,z]) => this._lamp(scene,mats,x,z));
        // Mid-block lamps on N-S street
        [[-4,-30],[4,-30],[-4,0],[4,0],[-4,30],[4,30]]
            .forEach(([x,z]) => this._lamp(scene,mats,x,z));
        // Scattered hydrants + mailboxes on N-S street edges
        [[4,  -24],[4, 6],[-4,-6],[-4, 24]].forEach(([x,z]) => this._hydrant(scene,mats,x,z));
        [[-4,-35],[4,-35],[-4,35],[4,35]].forEach(([x,z]) => this._mailbox(scene,mats,x,z));
        // Curb edge boxes along N-S street
        for(let z=-40; z<=40; z+=6) {
            this._box(scene,mats,'concrete',-4.15,0.06,z, 0.25,0.12,5.5,[0.7,0.7,0.7],false);
            this._box(scene,mats,'concrete', 4.15,0.06,z, 0.25,0.12,5.5,[0.7,0.7,0.7],false);
        }
    }

    // ── Lighting setup ──────────────────────────────────────────────────────

    _cityLighting(scene) {
        const moon = new THREE.AmbientLight(0x1a2240, 0.08);
        scene.add(moon);
        const hemi = new THREE.HemisphereLight(0x1a2035, 0x0a0a0a, 0.12);
        scene.add(hemi);
    }

    // ── Detail pass: cornices, ledges, cars, crosswalks, manholes, planters ──

    _detailPass(scene, mats) {
        // Parked cars on N-S street at staggered positions
        this._car(scene, mats, -2.5,  -8,  [0.35,0.45,0.6]);
        this._car(scene, mats,  2.5,   6,  [0.5,0.3,0.25]);
        this._car(scene, mats, -2.5,  22,  [0.25,0.4,0.3]);
        this._car(scene, mats,  2.5, -35,  [0.45,0.4,0.5]);

        // Crosswalk stripes (5 stripes) at top and bottom intersections
        for(let s=0;s<5;s++) {
            this._box(scene,mats,'concrete', 0,0.01,-16.5+s*0.7, 7.5,0.02,0.42,[0.85,0.85,0.85],false);
            this._box(scene,mats,'concrete', 0,0.01, 15.8+s*0.7, 7.5,0.02,0.42,[0.85,0.85,0.85],false);
        }

        // Manhole covers
        [[0,0,0],[0,0,-22],[0,0,22]].forEach(([x,y,z]) =>
            this._cyl(scene,mats,'metal',x,0.01,z,0.4,0.4,0.02,10,[0.5,0.5,0.55]));

        // Planters near café entrance
        [[15+2,0.35,-30-2.8],[15-2,0.35,-30-2.8]].forEach(([px,py,pz]) => {
            this._box(scene,mats,'stone',px,py,pz,0.7,0.7,0.7,[0.7,0.7,0.65],false);
            this._cone(scene,mats,'foliage',px,py+0.8,pz,0.45,1.0,6,[0.2,0.8,0.3]);
        });

        // Library entrance steps (3 steps)
        [0.22,0.44,0.66].forEach((h,i) =>
            this._box(scene,mats,'stone',15,h,30+7.5-i*0.35,5,0.22,0.7,[0.7,0.7,0.65],false));

        // Residential window ledges (under each townhouse window)
        [-21,-15,-9].forEach(x => {
            this._box(scene,mats,'building',x-0.8,3.4,0-0.1,1.1,0.07,0.15,[0.7,0.6,0.45],false);
            this._box(scene,mats,'building',x+0.8,3.4,0-0.1,1.1,0.07,0.15,[0.7,0.6,0.45],false);
        });

        // Awning supports on commercial strip (vertical posts)
        [-22,-14,-6].forEach(x =>
            this._box(scene,mats,'metal',x,2.2,-30+2,0.06,4.4,0.06,[0.5,0.6,0.7],false));

        // Trash cans near public square kiosk
        [[-10,30],[-10,32]].forEach(([x,z]) =>
            this._cyl(scene,mats,'metal',x,0.4,z,0.2,0.22,0.8,8,[0.4,0.45,0.5]));

        // Extra bench near library entrance
        this._bench(scene,mats, 10, 37, Math.PI/2);
        this._bench(scene,mats, 20, 37, -Math.PI/2);
    }

    // City-specific AABB safety bounds
    get roomBounds() {
        return [
            { minX: -27, maxX: 27, minZ: -43, maxZ: 43 }, // full city outer boundary
            // Streets (wider than visual to include sidewalks)
            { minX: -5,  maxX: 5,  minZ: -43, maxZ: 43 },
            { minX: -26, maxX: 26, minZ: -21, maxZ: -9  },
            { minX: -26, maxX: 26, minZ:   9, maxZ:  21 },
            // Block open areas (park, plaza, sidewalks)
            { minX: 5,   maxX: 26, minZ: -41, maxZ: -21 }, // park
            { minX: -26, maxX: -5, minZ:  19, maxZ:  41 }, // public square
        ];
    }
}
