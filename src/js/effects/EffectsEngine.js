window.EffectsEngine = (function() {
    const REGISTRY = [
        { name: 'glow', label: 'Glow', category: 'Stylize', params: [{ name: 'intensity', type: 'number', min: 0, max: 2, default: 0.5, label: 'Intensity' }] },
        { name: 'filmGrain', label: 'Film Grain', category: 'Stylize', params: [{ name: 'amount', type: 'number', min: 0, max: 1, default: 0.2, label: 'Amount' }] },
        { name: 'vignette', label: 'Vignette', category: 'Lens', params: [{ name: 'radius', type: 'number', min: 0, max: 1, default: 0.5, label: 'Radius' }] },
        { name: 'chromaber', label: 'Chromatic Aberration', category: 'Lens', params: [{ name: 'shift', type: 'number', min: 0, max: 20, default: 5, label: 'Shift' }] },
        { name: 'glitch', label: 'Glitch', category: 'Stylize', params: [{ name: 'severity', type: 'number', min: 0, max: 1, default: 0.5, label: 'Severity' }] },
        { name: 'vhs', label: 'VHS', category: 'Stylize', params: [{ name: 'noise', type: 'number', min: 0, max: 1, default: 0.5, label: 'Noise' }] },
        { name: 'godrays', label: 'God Rays', category: 'Light', params: [{ name: 'threshold', type: 'number', min: 0, max: 1, default: 0.8, label: 'Threshold' }] },
        { name: 'heatDistortion', label: 'Heat Distortion', category: 'Distort', params: [{ name: 'strength', type: 'number', min: 0, max: 1, default: 0.5, label: 'Strength' }] },
        { name: 'motionBlur', label: 'Motion Blur', category: 'Blur', params: [{ name: 'samples', type: 'number', min: 1, max: 20, default: 10, label: 'Samples' }] },
        { name: 'tiltShift', label: 'Tilt Shift', category: 'Blur', params: [{ name: 'blurAmount', type: 'number', min: 0, max: 20, default: 5, label: 'Blur Amount' }] },
        { name: 'lensFlare', label: 'Lens Flare', category: 'Light', params: [{ name: 'brightness', type: 'number', min: 0, max: 2, default: 1, label: 'Brightness' }] },
        { name: 'pixelate', label: 'Pixelate', category: 'Stylize', params: [{ name: 'size', type: 'number', min: 1, max: 50, default: 10, label: 'Size' }] },
        { name: 'neon', label: 'Neon', category: 'Stylize', params: [{ name: 'brightness', type: 'number', min: 0, max: 2, default: 1, label: 'Brightness' }] },
        { name: 'bloom', label: 'Bloom', category: 'Light', params: [{ name: 'radius', type: 'number', min: 0, max: 50, default: 15, label: 'Radius' }] }
    ];

    class ParticleSystem {
        constructor() { this.particles = []; }
        emit(config) {
            this.particles.push({
                x: config.x || 0, y: config.y || 0,
                vx: config.vx || 0, vy: config.vy || 0,
                life: config.life || 1, maxLife: config.life || 1,
                color: config.color || '#fff', size: config.size || 5
            });
        }
        update(dt) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                let p = this.particles[i];
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.life -= dt;
                if (p.life <= 0) this.particles.splice(i, 1);
            }
        }
        render(ctx) {
            this.particles.forEach(p => {
                ctx.globalAlpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
        // Presets
        fire(x, y, ctx) { this.emit({ x, y, vx: (Math.random()-0.5)*50, vy: -50-Math.random()*50, life: 1, color: '#ff5500', size: 10 }); }
        smoke(x, y, ctx) { this.emit({ x, y, vx: (Math.random()-0.5)*20, vy: -20-Math.random()*20, life: 2, color: '#888888', size: 15 }); }
        rain(ctx, w, h) { this.emit({ x: Math.random()*w, y: -10, vx: 0, vy: 300+Math.random()*100, life: 2, color: 'rgba(255,255,255,0.5)', size: 2 }); }
        sparks(x, y, ctx) { this.emit({ x, y, vx: (Math.random()-0.5)*200, vy: (Math.random()-0.5)*200, life: 0.5, color: '#ffff00', size: 3 }); }
        snow(ctx, w, h) { this.emit({ x: Math.random()*w, y: -10, vx: (Math.random()-0.5)*20, vy: 50+Math.random()*30, life: 5, color: '#ffffff', size: 4 }); }
        bokeh(ctx, w, h) { this.emit({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 3, color: 'rgba(255,200,100,0.2)', size: 20+Math.random()*30 }); }
    }

    return {
        registry: REGISTRY,
        ParticleSystem,

        applyGlow: function(canvas, params) {
            const ctx = canvas.getContext('2d');
            ctx.shadowBlur = 20 * (params.intensity || 0.5);
            ctx.shadowColor = 'white';
            ctx.drawImage(canvas, 0, 0);
            ctx.shadowBlur = 0;
        },
        
        applyFilmGrain: function(canvas, params, time = 0) {
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const amt = (params.amount || 0.2) * 255;
            for(let i=0; i<data.length; i+=4) {
                const noise = (Math.random() - 0.5) * amt;
                data[i] = Math.min(255, Math.max(0, data[i] + noise));
                data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
                data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
            }
            ctx.putImageData(imgData, 0, 0);
        },

        applyVignette: function(canvas, params) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            const radius = params.radius || 0.5;
            const gradient = ctx.createRadialGradient(w/2, h/2, (1-radius)*Math.min(w,h), w/2, h/2, Math.min(w,h));
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, 'rgba(0,0,0,1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        },

        applyChromaber: function(canvas, params) {
            const ctx = canvas.getContext('2d');
            const shift = params.shift || 5;
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const copy = new Uint8ClampedArray(imgData.data);
            const data = imgData.data;
            for(let y=0; y<canvas.height; y++) {
                for(let x=0; x<canvas.width; x++) {
                    const idx = (y*canvas.width + x)*4;
                    const shiftIdx = (y*canvas.width + Math.max(0, x - shift))*4;
                    data[idx] = copy[shiftIdx]; // R channel shifted
                }
            }
            ctx.putImageData(imgData, 0, 0);
        },

        applyGlitch: function(canvas, params) { /* Placeholder */ },
        applyVHS: function(canvas, params, time) { /* Placeholder */ },
        applyPixelate: function(canvas, params) {
            const ctx = canvas.getContext('2d');
            const size = params.size || 10;
            const w = canvas.width, h = canvas.height;
            const off = document.createElement('canvas');
            off.width = w/size; off.height = h/size;
            off.getContext('2d').drawImage(canvas, 0, 0, w/size, h/size);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(off, 0, 0, w, h);
        },
        applyNeon: function(canvas, params) { /* Placeholder */ },
        applyBloom: function(canvas, params) { /* Placeholder */ },
        applyTiltShift: function(canvas, params) { /* Placeholder */ },
        applyLensFlare: function(canvas, params) { /* Placeholder */ },

        applyEffectStack: function(canvas, effectsList) {
            effectsList.forEach(eff => {
                switch(eff.name) {
                    case 'glow': this.applyGlow(canvas, eff.params); break;
                    case 'filmGrain': this.applyFilmGrain(canvas, eff.params); break;
                    case 'vignette': this.applyVignette(canvas, eff.params); break;
                    case 'chromaber': this.applyChromaber(canvas, eff.params); break;
                    case 'pixelate': this.applyPixelate(canvas, eff.params); break;
                    // others...
                }
            });
        },

        renderEffectParams: function(container, effectName, currentParams, onChange) {
            container.innerHTML = '';
            const effect = REGISTRY.find(e => e.name === effectName);
            if (!effect) return;
            effect.params.forEach(param => {
                const div = document.createElement('div');
                div.innerHTML = `<label>${param.label}</label>`;
                const input = document.createElement('input');
                input.type = 'range';
                input.min = param.min;
                input.max = param.max;
                input.step = (param.max - param.min) / 100;
                input.value = currentParams[param.name] !== undefined ? currentParams[param.name] : param.default;
                input.oninput = (e) => {
                    currentParams[param.name] = parseFloat(e.target.value);
                    onChange(currentParams);
                };
                div.appendChild(input);
                container.appendChild(div);
            });
        }
    };
})();
