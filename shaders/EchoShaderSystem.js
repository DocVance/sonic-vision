import * as THREE from 'three';

const MAX_PINGS = 4;
const MAX_PARTICLES = 10000;
const MAX_GRID_LINES = 8000; // Pairs of vertices for topology lines

export class EchoShaderSystem {
    constructor(scene) {
        this.scene = scene;
        
        // --- Wavefront Ring Uniforms (Layer A) ---
        this.pingData = {
            uTime: { value: 0 },
            uPingPositions: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Vector3()) },
            uPingDirections: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Vector3()) },
            uPingTimes: { value: new Array(MAX_PINGS).fill(-999.0) },
            uPingParams: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Vector4()) },
            uPingColors: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Color()) }
        };
        
        this.pingIndex = 0;
        
        // --- Particle System (Layer B — hit dots) ---
        this.particleIndex = 0;
        
        const positions = new Float32Array(MAX_PARTICLES * 3);
        const normals = new Float32Array(MAX_PARTICLES * 3);
        const creationTimes = new Float32Array(MAX_PARTICLES).fill(-999.0);
        const colors = new Float32Array(MAX_PARTICLES * 3);
        
        this.particleGeometry = new THREE.BufferGeometry();
        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        this.particleGeometry.setAttribute('creationTime', new THREE.BufferAttribute(creationTimes, 1));
        this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        this.particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: this.pingData.uTime,
                uPlayerPosition: { value: new THREE.Vector3() }
            },
            vertexShader: `
                attribute float creationTime;
                attribute vec3 color;
                
                uniform float uTime;
                uniform vec3 uPlayerPosition;
                
                varying vec3 vColor;
                varying float vAge;
                varying float vDist;
                
                void main() {
                    vColor = color;
                    vAge = uTime - creationTime;
                    vDist = distance(position, uPlayerPosition);
                    
                    float size = 0.0;
                    if (vAge >= 0.0 && vAge < 45.0) {
                        // Smaller, sharper dots — more like sonar pips
                        float decay = clamp(1.0 - (vAge / 4.0), 0.0, 1.0);
                        size = 6.0 * decay + 2.0;
                        
                        size *= clamp(8.0 / max(vDist, 1.0), 0.3, 1.0);
                    }
                    
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (10.0 / -mvPosition.z); 
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAge;
                varying float vDist;
                
                void main() {
                    if (vAge < 0.0 || vAge > 45.0) discard;
                    
                    vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
                    float distFromCenter = length(coord);
                    if (distFromCenter > 0.5) discard;
                    
                    // Sharper falloff — more crisp dot, less blobby glow
                    float alpha = smoothstep(0.5, 0.15, distFromCenter);
                    
                    float intensity = 0.0;
                    if (vAge < 4.0) {
                        intensity = 1.0 - (vAge / 4.0);
                    } else {
                        // Long persistent afterglow at low intensity
                        intensity = 0.15 * (1.0 - (vAge - 4.0) / 41.0); 
                    }
                    
                    intensity *= clamp(1.0 - (vDist / 40.0), 0.1, 1.0);
                    
                    gl_FragColor = vec4(vColor * intensity, alpha * intensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.particleSystem.frustumCulled = false;
        this.scene.add(this.particleSystem);
        
        // --- Topology Grid Lines (Layer C — sonar wireframe) ---
        this.gridLineIndex = 0;
        
        const linePositions = new Float32Array(MAX_GRID_LINES * 2 * 3); // 2 vertices per line
        const lineCreationTimes = new Float32Array(MAX_GRID_LINES * 2).fill(-999.0);
        const lineColors = new Float32Array(MAX_GRID_LINES * 2 * 3);
        
        this.gridGeometry = new THREE.BufferGeometry();
        this.gridGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        this.gridGeometry.setAttribute('creationTime', new THREE.BufferAttribute(lineCreationTimes, 1));
        this.gridGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
        
        this.gridMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: this.pingData.uTime,
                uPlayerPosition: { value: new THREE.Vector3() }
            },
            vertexShader: `
                attribute float creationTime;
                attribute vec3 color;
                
                uniform float uTime;
                uniform vec3 uPlayerPosition;
                
                varying vec3 vColor;
                varying float vAge;
                varying float vAlpha;
                
                void main() {
                    vColor = color;
                    vAge = uTime - creationTime;
                    float dist = distance(position, uPlayerPosition);
                    
                    // Lines fade in quickly then persist as faint grid
                    float fadeIn = smoothstep(0.0, 0.3, vAge);
                    float fadeOut = vAge < 5.0 
                        ? 1.0 
                        : clamp(1.0 - (vAge - 5.0) / 40.0, 0.0, 1.0);
                    float distFade = clamp(1.0 - (dist / 35.0), 0.05, 1.0);
                    
                    vAlpha = fadeIn * fadeOut * distFade * 0.35;
                    
                    if (vAge < 0.0 || vAge > 45.0) vAlpha = 0.0;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAge;
                varying float vAlpha;
                
                void main() {
                    if (vAlpha <= 0.0) discard;
                    
                    // Subtle grid color — dimmer than the dots
                    gl_FragColor = vec4(vColor * 0.6, vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.gridLines = new THREE.LineSegments(this.gridGeometry, this.gridMaterial);
        this.gridLines.frustumCulled = false;
        this.scene.add(this.gridLines);
        
        // --- Hit point spatial index for topology generation ---
        // Stores recent hits for connecting nearby points
        this._recentHits = [];
        this._gridConnectionRadius = 2.0; // Max distance to draw a topology line
    }
    
    createMaterial(acousticProfile = {}) {
        // Share the ping uniforms by reference so registerPing() updates
        // propagate to every material automatically.
        const uniforms = {
            uTime: this.pingData.uTime,
            uPingPositions: this.pingData.uPingPositions,
            uPingDirections: this.pingData.uPingDirections,
            uPingTimes: this.pingData.uPingTimes,
            uPingParams: this.pingData.uPingParams,
            uPingColors: this.pingData.uPingColors,
            uBaseColor: { value: new THREE.Color(...(acousticProfile.colorTint || [0.0, 1.0, 0.9])) },
            uRingSharpness: { value: acousticProfile.ringSharpness || 0.2 },
        };

        return new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vNormal = normalMatrix * normal;
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uPingPositions[${MAX_PINGS}];
                uniform vec3 uPingDirections[${MAX_PINGS}];
                uniform float uPingTimes[${MAX_PINGS}];
                uniform vec4 uPingParams[${MAX_PINGS}];
                uniform vec3 uPingColors[${MAX_PINGS}];
                
                uniform vec3 uBaseColor;
                uniform float uRingSharpness;
                
                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                
                void main() {
                    float totalGlow = 0.0;
                    vec3 finalColor = vec3(0.0, 0.0, 0.0);
                    
                    vec3 norm = normalize(vNormal);
                    
                    for (int i = 0; i < ${MAX_PINGS}; i++) {
                        float age = uTime - uPingTimes[i];
                        if (age < 0.0 || age > 3.0) continue; 
                        
                        vec3 pingPos = uPingPositions[i];
                        vec3 pingDir = uPingDirections[i];
                        float speed = uPingParams[i].x;
                        float maxRange = uPingParams[i].y;
                        float coneCos = uPingParams[i].z;
                        
                        vec3 toFrag = vWorldPosition - pingPos;
                        float dist = length(toFrag);
                        if (dist > maxRange) continue;
                        
                        toFrag /= dist; 
                        
                        float dotDir = dot(toFrag, pingDir);
                        if (dotDir < coneCos) continue;
                        float angularFalloff = smoothstep(coneCos, coneCos + 0.1, dotDir);
                        
                        float waveRadius = age * speed;
                        float ringWidth = uRingSharpness * 2.0 + 0.1;
                        float ring = 1.0 - abs(dist - waveRadius) / ringWidth;
                        ring = clamp(ring, 0.0, 1.0);
                        
                        float normalDot = dot(norm, -toFrag);
                        float reflectivity = pow(max(normalDot, 0.0), 0.7);
                        
                        vec3 dNdx = dFdx(norm);
                        vec3 dNdy = dFdy(norm);
                        float edgeStrength = length(dNdx) + length(dNdy);
                        edgeStrength = clamp(edgeStrength * 4.0, 0.0, 1.0);
                        
                        float glow = ring * (reflectivity + edgeStrength * 0.5) * angularFalloff;
                        
                        glow *= clamp(1.0 - (dist / maxRange), 0.0, 1.0);
                        glow *= clamp(1.0 - (age / 3.0), 0.0, 1.0);
                        
                        totalGlow += glow;
                        finalColor += uPingColors[i] * uBaseColor * glow;
                    }
                    
                    gl_FragColor = vec4(finalColor.r, finalColor.g, finalColor.b, clamp(totalGlow, 0.0, 1.0));
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            extensions: { derivatives: true }
        });
    }
    
    registerPing(position, direction, coneAngleDegrees, maxRange, isLowFreq) {
        const i = this.pingIndex;
        
        this.pingData.uPingPositions.value[i].copy(position);
        this.pingData.uPingDirections.value[i].copy(direction).normalize();
        this.pingData.uPingTimes.value[i] = this.pingData.uTime.value;
        
        const speed = 34.0;
        const coneCos = Math.cos(coneAngleDegrees * (Math.PI / 180) / 2);
        this.pingData.uPingParams.value[i].set(speed, maxRange, coneCos, 0);
        
        if (isLowFreq) {
            this.pingData.uPingColors.value[i].setRGB(1.0, 0.7, 0.2); 
        } else {
            this.pingData.uPingColors.value[i].setRGB(0.2, 0.9, 1.0);
        }
        
        this.pingIndex = (this.pingIndex + 1) % MAX_PINGS;
        
        // Clear recent hits for fresh topology generation per ping
        this._recentHits = [];
    }
    
    addHitPoint(hit, isLowFreq) {
        const i = this.particleIndex;
        
        const posAttr = this.particleGeometry.attributes.position;
        const normAttr = this.particleGeometry.attributes.normal;
        const timeAttr = this.particleGeometry.attributes.creationTime;
        const colorAttr = this.particleGeometry.attributes.color;
        
        posAttr.setXYZ(i, hit.point.x, hit.point.y, hit.point.z);
        normAttr.setXYZ(i, hit.normal.x, hit.normal.y, hit.normal.z);
        timeAttr.setX(i, this.pingData.uTime.value);
        
        const r = isLowFreq ? 1.0 : 0.2;
        const g = isLowFreq ? 0.7 : 0.9;
        const b = isLowFreq ? 0.2 : 1.0;
        
        colorAttr.setXYZ(i, r, g, b);
        
        posAttr.needsUpdate = true;
        normAttr.needsUpdate = true;
        timeAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        
        this.particleIndex = (this.particleIndex + 1) % MAX_PARTICLES;
        
        // --- Topology grid: structured horizontal lines along surfaces ---
        // Only connect hits that share the same surface (matching normals)
        // and are at the same height band (prevents cross-surface spaghetti).
        const now = this.pingData.uTime.value;
        const nx = hit.normal.x, ny = hit.normal.y, nz = hit.normal.z;
        const newHit = {
            x: hit.point.x, y: hit.point.y, z: hit.point.z,
            nx, ny, nz,
            isFloor: ny > 0.7   // nearly upward normal = floor/ceiling
        };
        
        const linePos   = this.gridGeometry.attributes.position;
        const lineTime  = this.gridGeometry.attributes.creationTime;
        const lineColor = this.gridGeometry.attributes.color;
        
        let connectionsForThisHit = 0;
        const MAX_CONN = 2;                // 2 connections max keeps lines clean
        const MAX_DIST = 1.6;              // tighter radius reduces long diagonal leaps

        for (let j = this._recentHits.length - 1; j >= 0 && connectionsForThisHit < MAX_CONN; j--) {
            const other = this._recentHits[j];

            // 1. Same surface: normals must be nearly parallel (dot > 0.85)
            const normalDot = nx * other.nx + ny * other.ny + nz * other.nz;
            if (normalDot < 0.85) continue;

            // 2. Same height band for wall hits (avoids vertical diagonals across floors)
            const dy = Math.abs(newHit.y - other.y);
            if (!newHit.isFloor && dy > 0.28) continue; // Wall hits: stay within 28cm band

            // 3. Horizontal distance check
            const dx = newHit.x - other.x;
            const dz = newHit.z - other.z;
            const hDist = Math.sqrt(dx*dx + dz*dz + dy*dy);
            if (hDist < 0.15 || hDist > MAX_DIST) continue;

            // Write line segment
            const v0 = this.gridLineIndex * 2;
            const v1 = v0 + 1;
            linePos.setXYZ(v0, newHit.x, newHit.y, newHit.z);
            linePos.setXYZ(v1, other.x,  other.y,  other.z);
            lineTime.setX(v0, now); lineTime.setX(v1, now);
            // Walls: 40% of dot color — subtle; floors: 30%
            const blend = newHit.isFloor ? 0.3 : 0.4;
            lineColor.setXYZ(v0, r*blend, g*blend, b*blend);
            lineColor.setXYZ(v1, r*blend, g*blend, b*blend);

            this.gridLineIndex = (this.gridLineIndex + 1) % MAX_GRID_LINES;
            connectionsForThisHit++;
        }
        
        if (connectionsForThisHit > 0) {
            linePos.needsUpdate  = true;
            lineTime.needsUpdate = true;
            lineColor.needsUpdate = true;
        }
        
        this._recentHits.push(newHit);
        if (this._recentHits.length > 500) {
            this._recentHits = this._recentHits.slice(-300);
        }
    }
    
    update(dt, playerPosition) {
        this.pingData.uTime.value += dt;
        this.particleMaterial.uniforms.uPlayerPosition.value.copy(playerPosition);
        this.gridMaterial.uniforms.uPlayerPosition.value.copy(playerPosition);
    }
}
