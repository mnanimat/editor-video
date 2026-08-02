window.ColorGrading = (function() {
    // Math Utils
    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if(max === min) { h = s = 0; }
        else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if(s === 0) { r = g = b = l; }
        else {
            const hue2rgb = (p, q, t) => {
                if(t < 0) t += 1;
                if(t > 1) t -= 1;
                if(t < 1/6) return p + (q - p) * 6 * t;
                if(t < 1/2) return q;
                if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [r * 255, g * 255, b * 255];
    }
    
    function rgbToHsv(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) { h = 0; }
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, v];
    }

    function hsvToRgb(h, s, v) {
        let r, g, b;
        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return [r * 255, g * 255, b * 255];
    }

    const LUTS = {
        cinematic: (r, g, b) => [r * 1.1, g, b * 0.9],
        vintage: (r, g, b) => [r * 1.2, g * 1.1, b * 0.8],
        bleach: (r, g, b) => [r * 0.9, g * 0.9, b * 0.9],
        noir: (r, g, b) => { const avg = (r+g+b)/3; return [avg, avg, avg]; }
    };

    return {
        rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb,
        
        drawColorWheel: function(canvas, wheelType, currentOffset) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            const cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 2 - 10;
            const imageData = ctx.createImageData(w, h);
            const data = imageData.data;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const dx = x - cx, dy = y - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        const angle = Math.atan2(dy, dx) + Math.PI;
                        const hue = angle / (Math.PI * 2);
                        const sat = dist / radius;
                        const [R, G, B] = hslToRgb(hue, sat, 0.5);
                        const idx = (y * w + x) * 4;
                        data[idx] = R; data[idx+1] = G; data[idx+2] = B; data[idx+3] = 255;
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);

            if (currentOffset) {
                const ox = cx + Math.cos(currentOffset.angle) * currentOffset.radius * radius;
                const oy = cy + Math.sin(currentOffset.angle) * currentOffset.radius * radius;
                ctx.beginPath();
                ctx.arc(ox, oy, 5, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        },

        setupColorWheelInteraction: function(canvas, wheelType, onUpdate) {
            let isDragging = false;
            canvas.addEventListener('mousedown', (e) => { isDragging = true; update(e); });
            window.addEventListener('mouseup', () => isDragging = false);
            window.addEventListener('mousemove', (e) => { if(isDragging) update(e); });
            
            function update(e) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const cx = canvas.width/2, cy = canvas.height/2, r = Math.min(canvas.width, canvas.height)/2 - 10;
                let dx = x - cx, dy = y - cy;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if(dist > r) { dx *= r/dist; dy *= r/dist; dist = r; }
                const angle = Math.atan2(dy, dx);
                onUpdate({ angle, radius: dist/r, wheelType });
            }
        },

        drawCurvesEditor: function(canvas, channel, points) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, w, h);
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath(); ctx.moveTo(0, h * i/4); ctx.lineTo(w, h * i/4); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(w * i/4, 0); ctx.lineTo(w * i/4, h); ctx.stroke();
            }
            
            ctx.strokeStyle = '#555';
            ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();
            
            const colors = { rgb: '#fff', r: '#f00', g: '#0f0', b: '#00f' };
            ctx.strokeStyle = colors[channel] || '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x < w; x++) {
                const y = h - this.evalCurve(points, x/w) * h;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x * w, h - p.y * h, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
            });
        },

        setupCurvesInteraction: function(canvas, channel, onUpdate) {
            let draggingPoint = null;
            let points = []; // user should manage state, this is simplified
            canvas.addEventListener('mousedown', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / canvas.width;
                const y = 1 - (e.clientY - rect.top) / canvas.height;
                if (e.ctrlKey) {
                    points = points.filter(p => Math.hypot(p.x - x, p.y - y) > 0.05);
                } else {
                    let point = points.find(p => Math.hypot(p.x - x, p.y - y) < 0.05);
                    if (!point) { point = { x, y }; points.push(point); points.sort((a,b)=>a.x-b.x); }
                    draggingPoint = point;
                }
                onUpdate(points);
            });
            window.addEventListener('mouseup', () => draggingPoint = null);
            window.addEventListener('mousemove', (e) => {
                if (draggingPoint) {
                    const rect = canvas.getBoundingClientRect();
                    draggingPoint.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / canvas.width));
                    draggingPoint.y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / canvas.height));
                    points.sort((a,b)=>a.x-b.x);
                    onUpdate(points);
                }
            });
        },

        evalCurve: function(points, x) {
            if (!points || points.length === 0) return x;
            if (x <= points[0].x) return points[0].y;
            if (x >= points[points.length - 1].x) return points[points.length - 1].y;
            for (let i = 0; i < points.length - 1; i++) {
                if (x >= points[i].x && x <= points[i + 1].x) {
                    let t = (x - points[i].x) / (points[i + 1].x - points[i].x);
                    return points[i].y + t * (points[i + 1].y - points[i].y);
                }
            }
            return x;
        },

        drawWaveform: function(canvas, imageData) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
            const data = imageData.data;
            const srcW = imageData.width;
            for (let i = 0; i < data.length; i += 4) {
                const luma = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
                const x = ((i / 4) % srcW) / srcW * w;
                const y = h - (luma / 255) * h;
                ctx.fillRect(x, y, 1, 1);
            }
        },

        drawParade: function(canvas, imageData) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            const data = imageData.data;
            const srcW = imageData.width;
            const sectionW = w / 3;
            
            for (let i = 0; i < data.length; i += 4) {
                const px = ((i / 4) % srcW) / srcW * sectionW;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
                ctx.fillRect(px, h - (data[i] / 255) * h, 1, 1);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
                ctx.fillRect(px + sectionW, h - (data[i+1] / 255) * h, 1, 1);
                ctx.fillStyle = 'rgba(0, 0, 255, 0.05)';
                ctx.fillRect(px + sectionW * 2, h - (data[i+2] / 255) * h, 1, 1);
            }
        },

        drawVectorscope: function(canvas, imageData) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
            
            // Draw targets (R, Mg, B, Cy, G, Yl)
            ctx.strokeStyle = '#333';
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const [hue, sat] = rgbToHsl(data[i], data[i+1], data[i+2]);
                const angle = hue * Math.PI * 2 - Math.PI;
                const dist = sat * r;
                ctx.fillRect(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1, 1);
            }
        },

        drawHistogram: function(canvas, imageData) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            
            const rBins = new Array(256).fill(0), gBins = new Array(256).fill(0), bBins = new Array(256).fill(0);
            const data = imageData.data;
            let maxBin = 1;
            
            for (let i = 0; i < data.length; i += 4) {
                rBins[data[i]]++; gBins[data[i+1]]++; bBins[data[i+2]]++;
                maxBin = Math.max(maxBin, rBins[data[i]], gBins[data[i+1]], bBins[data[i+2]]);
            }
            
            ctx.globalCompositeOperation = 'screen';
            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * w;
                ctx.fillStyle = 'red'; ctx.fillRect(x, h - (rBins[i] / maxBin) * h, w / 256 + 1, (rBins[i] / maxBin) * h);
                ctx.fillStyle = 'green'; ctx.fillRect(x, h - (gBins[i] / maxBin) * h, w / 256 + 1, (gBins[i] / maxBin) * h);
                ctx.fillStyle = 'blue'; ctx.fillRect(x, h - (bBins[i] / maxBin) * h, w / 256 + 1, (bBins[i] / maxBin) * h);
            }
            ctx.globalCompositeOperation = 'source-over';
        },

        applyLUT: function(canvas, lutName, intensity = 1.0) {
            if (!LUTS[lutName]) return;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const lutFn = LUTS[lutName];
            
            for (let i = 0; i < data.length; i += 4) {
                const [r, g, b] = lutFn(data[i], data[i+1], data[i+2]);
                data[i] = data[i] * (1 - intensity) + r * intensity;
                data[i+1] = data[i+1] * (1 - intensity) + g * intensity;
                data[i+2] = data[i+2] * (1 - intensity) + b * intensity;
            }
            ctx.putImageData(imageData, 0, 0);
        },

        applyLiftGammaGain: function(imageData, lift, gamma, gain) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                for (let c = 0; c < 3; c++) {
                    let val = data[i + c] / 255;
                    val = val * (1 + gain[c] - 1) + (lift[c] - 1) * (1 - val);
                    val = Math.pow(Math.max(0, val), 1 / gamma[c]);
                    data[i + c] = Math.min(255, Math.max(0, val * 255));
                }
            }
        },

        applyTemperature: function(imageData, temp) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] + temp); // Red
                data[i+2] = Math.max(0, data[i+2] - temp); // Blue
            }
        },

        applySaturation: function(imageData, sat) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
                const [r, g, b] = hslToRgb(h, Math.max(0, Math.min(1, s * sat)), l);
                data[i] = r; data[i+1] = g; data[i+2] = b;
            }
        },

        applyContrast: function(imageData, contrast, pivot = 0.5) {
            const data = imageData.data;
            const p = pivot * 255;
            for (let i = 0; i < data.length; i += 4) {
                for (let c = 0; c < 3; c++) {
                    data[i+c] = Math.max(0, Math.min(255, p + (data[i+c] - p) * contrast));
                }
            }
        }
    };
})();
