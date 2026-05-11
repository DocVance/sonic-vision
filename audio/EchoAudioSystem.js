import * as THREE from 'three';

export class EchoAudioSystem {
    constructor(camera) {
        this.camera = camera;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        
        this.contextStarted = false;
        const startContext = () => {
            if (!this.contextStarted) {
                this.context.resume().then(() => {
                    this.contextStarted = true;
                    this.startAmbience();
                    // Flush any ambient sources that were registered before the context unlocked
                    if (this._pendingAmbientSources) {
                        this._startAmbientSourcesNow(this._pendingAmbientSources);
                        this._pendingAmbientSources = null;
                    }
                });
            }
        };
        
        window.addEventListener('click', startContext, { once: true });
        window.addEventListener('keydown', startContext, { once: true });
        window.addEventListener('touchstart', startContext, { once: true });
        
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 1.0;
        
        this.listener = this.context.listener;
        
        this.pannerPoolSize = 20;
        this.pannerPool = [];
        this.pannerIndex = 0;
        
        for (let i = 0; i < this.pannerPoolSize; i++) {
            const panner = this.context.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'exponential';
            panner.refDistance = 1.0;
            panner.maxDistance = 50.0;
            panner.rolloffFactor = 1.5;
            panner.connect(this.masterGain);
            this.pannerPool.push(panner);
        }
    }
    
    updateListener() {
        if (!this.contextStarted) return;
        
        const pos = new THREE.Vector3();
        this.camera.getWorldPosition(pos);
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        
        if (this.listener.positionX) {
            this.listener.positionX.value = pos.x;
            this.listener.positionY.value = pos.y;
            this.listener.positionZ.value = pos.z;
            this.listener.forwardX.value = forward.x;
            this.listener.forwardY.value = forward.y;
            this.listener.forwardZ.value = forward.z;
            this.listener.upX.value = up.x;
            this.listener.upY.value = up.y;
            this.listener.upZ.value = up.z;
        } else {
            this.listener.setPosition(pos.x, pos.y, pos.z);
            this.listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        }
    }
    
    playChirp(isLowFreq) {
        if (!this.contextStarted) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        const now = this.context.currentTime;
        
        if (isLowFreq) {
            osc.frequency.setValueAtTime(6000, now);
            osc.frequency.exponentialRampToValueAtTime(3000, now + 0.04);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.8, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        } else {
            osc.frequency.setValueAtTime(12000, now);
            osc.frequency.exponentialRampToValueAtTime(6000, now + 0.008);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.6, now + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.008);
            osc.start(now);
            osc.stop(now + 0.008);
        }
    }
    
    playEchoAt(hit, isLowFreq) {
        if (!this.contextStarted) return;
        
        const panner = this.pannerPool[this.pannerIndex];
        this.pannerIndex = (this.pannerIndex + 1) % this.pannerPoolSize;
        
        if (panner.positionX) {
            panner.positionX.value = hit.point.x;
            panner.positionY.value = hit.point.y;
            panner.positionZ.value = hit.point.z;
        } else {
            panner.setPosition(hit.point.x, hit.point.y, hit.point.z);
        }
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.connect(gain);
        gain.connect(panner);
        
        const now = this.context.currentTime;
        
        if (isLowFreq) {
            osc.frequency.setValueAtTime(5000, now);
            osc.frequency.exponentialRampToValueAtTime(2500, now + 0.035);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);
            osc.start(now);
            osc.stop(now + 0.035);
        } else {
            osc.frequency.setValueAtTime(10000, now);
            osc.frequency.exponentialRampToValueAtTime(5000, now + 0.006);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.4, now + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.006);
            osc.start(now);
            osc.stop(now + 0.006);
        }
        
        setTimeout(() => {
            gain.disconnect();
        }, 100);
    }
    
    playReadyClick() {
        if (!this.contextStarted) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        const now = this.context.currentTime;
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.02);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
        
        osc.start(now);
        osc.stop(now + 0.02);
    }
    
    startAmbience() {
        if (this.ambienceStarted) return;
        this.ambienceStarted = true;
        
        const bufferSize = this.context.sampleRate * 2; 
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.context.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        
        const filter2 = this.context.createBiquadFilter();
        filter2.type = 'highpass';
        filter2.frequency.value = 100;
        
        const gain = this.context.createGain();
        gain.gain.value = 0.05;
        
        noise.connect(filter);
        filter.connect(filter2);
        filter2.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start();
    }
    
    // ---------------------------------------------------------------
    // Spatial Ambient Sources
    // Provides constant, localized sound cues at fixed world positions.
    // These allow users to triangulate sound the way bats do passively —
    // by listening to the environment, not just their own pings.
    // ---------------------------------------------------------------
    startAmbientSources(sources) {
        if (!this.contextStarted) {
            // Queue for when context is ready
            this._pendingAmbientSources = sources;
            return;
        }
        this._startAmbientSourcesNow(sources);
    }

    _startAmbientSourcesNow(sources) {
        this.ambientNodes = [];
        
        sources.forEach(source => {
            const panner = this.context.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'exponential';
            panner.refDistance = 1.0;
            panner.maxDistance = 30.0;
            panner.rolloffFactor = 2.5; // Falls off quickly — must be close to hear it clearly
            
            if (panner.positionX) {
                panner.positionX.value = source.position.x;
                panner.positionY.value = source.position.y;
                panner.positionZ.value = source.position.z;
            } else {
                panner.setPosition(source.position.x, source.position.y, source.position.z);
            }
            
            panner.connect(this.masterGain);
            
            if (source.type === 'drip') {
                this._scheduleDrip(panner, source.rate || 1.5);
            } else if (source.type === 'stream') {
                this._startStream(panner, source.intensity || 0.4);
            }
            
            this.ambientNodes.push(panner);
        });
    }
    
    /**
     * Schedules recurring drip sounds at a panner node.
     * Each drip is a very short filtered noise burst — the
     * characteristic "plink" of water on stone.
     */
    _scheduleDrip(panner, avgIntervalSeconds) {
        const playDrip = () => {
            if (!this.contextStarted) return;
            
            const now = this.context.currentTime;
            
            // Short white-noise burst simulating water impact
            const impactDuration = 0.015 + Math.random() * 0.01;
            const sampleRate = this.context.sampleRate;
            const bufLen = Math.ceil(sampleRate * impactDuration);
            const buf = this.context.createBuffer(1, bufLen, sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
            
            const src = this.context.createBufferSource();
            src.buffer = buf;
            
            // Low-pass to shape it as a wet plop rather than a click
            const lpf = this.context.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = 1800 + Math.random() * 800;
            
            const env = this.context.createGain();
            env.gain.setValueAtTime(0.0, now);
            env.gain.linearRampToValueAtTime(0.6, now + 0.003);
            env.gain.exponentialRampToValueAtTime(0.01, now + impactDuration);
            
            src.connect(lpf);
            lpf.connect(env);
            env.connect(panner);
            src.start(now);
            src.stop(now + impactDuration + 0.01);
            
            // Small resonance tail — the cave reverb
            const tailOsc = this.context.createOscillator();
            const tailGain = this.context.createGain();
            tailOsc.type = 'sine';
            tailOsc.frequency.value = 200 + Math.random() * 300;
            tailGain.gain.setValueAtTime(0.08, now + impactDuration * 0.5);
            tailGain.gain.exponentialRampToValueAtTime(0.001, now + impactDuration + 0.25);
            tailOsc.connect(tailGain);
            tailGain.connect(panner);
            tailOsc.start(now + impactDuration * 0.5);
            tailOsc.stop(now + impactDuration + 0.3);
            
            // Schedule the next drip with natural jitter
            const jitter = (Math.random() * 0.6 - 0.3) * avgIntervalSeconds;
            const nextDelay = Math.max(0.3, avgIntervalSeconds + jitter) * 1000;
            setTimeout(playDrip, nextDelay);
        };
        
        // Stagger the start time so multiple drip sources don't sync up
        setTimeout(playDrip, Math.random() * avgIntervalSeconds * 1000);
    }
    
    /**
     * Creates a continuous trickling stream sound at a panner node.
     * Built from shaped noise filtered through a bandpass to mimic
     * the frequency character of running water.
     */
    _startStream(panner, intensity) {
        const sampleRate = this.context.sampleRate;
        const bufferDuration = 3.0;
        const bufLen = Math.ceil(sampleRate * bufferDuration);
        const buf = this.context.createBuffer(1, bufLen, sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
        
        const src = this.context.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        
        // Bandpass tuned to the character of trickling water (~500-4000 Hz)
        const bpf = this.context.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.value = 1200;
        bpf.Q.value = 0.8;
        
        // Second pass to add brightness
        const bpf2 = this.context.createBiquadFilter();
        bpf2.type = 'highshelf';
        bpf2.frequency.value = 3000;
        bpf2.gain.value = 6;
        
        const gain = this.context.createGain();
        gain.gain.value = intensity * 0.35;
        
        src.connect(bpf);
        bpf.connect(bpf2);
        bpf2.connect(gain);
        gain.connect(panner);
        src.start();
    }
}
