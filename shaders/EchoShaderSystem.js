import * as THREE from 'three';

const MAX_PINGS = 4;
const MAX_PARTICLES = 10000;

export class EchoShaderSystem {
    constructor(scene) {
        this.scene = scene;
        
        // --- Wavefront Ring Uniforms (Layer A) ---
        this.pingData = {
            uTime: { value: 0 },
            uPingPositions: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Vector3()) },
            uPingDirections: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Vector3()) },
            uPingTimes: { value: new Array(MAX_PINGS).fill(-999.0) },
            uPingParams: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Vector4()) }, // x=speed, y=maxRange, z=coneCos, w=unused
            uPingColors: { value: new Array(MAX_PINGS).fill(null).map(() => new THREE.Color()) }
        };
        
        this.pingIndex = 0;
        
        // --- Particle System (Layers B & C) ---
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
                        float decay = clamp(1.0 - (vAge / 3.0), 0.0, 1.0);
                        size = 20.0 * decay + 5.0; 
                        
                        size *= clamp(10.0 / max(vDist, 1.0), 0.2, 1.0);
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
                    
                    float alpha = 1.0 - (distFromCenter * 2.0); 
                    
                    float intensity = 0.0;
                    if (vAge < 3.0) {
                        intensity = 1.0 - (vAge / 3.0);
                    } else {
                        intensity = 0.1 * (1.0 - (vAge - 3.0)/42.0); 
                    }
                    
                    intensity *= clamp(1.0 - (vDist / 40.0), 0.1, 1.0);
                    
                    gl_FragColor = vec4(vColor.r * intensity, vColor.g * intensity, vColor.b * intensity, alpha * intensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.particleSystem.frustumCulled = false;
        this.scene.add(this.particleSystem);
    }
    
    createMaterial(acousticProfile = {}) {
        return new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                this.pingData,
                {
                    uBaseColor: { value: new THREE.Color(...(acousticProfile.colorTint || [0.0, 1.0, 0.9])) },
                    uRingSharpness: { value: acousticProfile.ringSharpness || 0.2 },
                }
            ]),
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
            extensions: { derivatives: true }
        });
    }
    
    registerPing(position, direction, coneAngleDegrees, maxRange, isLowFreq) {
        const i = this.pingIndex;
        
        this.pingData.uPingPositions.value[i].copy(position);
        this.pingData.uPingDirections.value[i].copy(direction).normalize();
        this.pingData.uPingTimes.value[i] = this.pingData.uTime.value;
        
        const speed = 34.0; // m/s
        const coneCos = Math.cos(coneAngleDegrees * (Math.PI / 180) / 2);
        this.pingData.uPingParams.value[i].set(speed, maxRange, coneCos, 0);
        
        if (isLowFreq) {
            this.pingData.uPingColors.value[i].setRGB(1.0, 0.7, 0.2); 
        } else {
            this.pingData.uPingColors.value[i].setRGB(0.2, 0.9, 1.0);
        }
        
        this.pingIndex = (this.pingIndex + 1) % MAX_PINGS;
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
    }
    
    update(dt, playerPosition) {
        this.pingData.uTime.value += dt;
        this.particleMaterial.uniforms.uPlayerPosition.value.copy(playerPosition);
    }
}
