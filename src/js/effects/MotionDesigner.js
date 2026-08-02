window.Easing = {
    linear: t => t,
    easeIn: t => t * t,
    easeOut: t => t * (2 - t),
    easeInOut: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    bounce: t => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    elastic: t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)),
    spring: t => 1 - Math.pow(Math.E, -5 * t) * Math.cos(t * Math.PI * 3),
    steps: (t, n=5) => Math.floor(t * n) / n
};

window.MotionDesigner = (function() {
    const keyframes = {}; // { clipId: { propName: [{time, value, easing}] } }

    function getClipData(clipId) {
        if (!keyframes[clipId]) keyframes[clipId] = {};
        return keyframes[clipId];
    }

    return {
        addKeyframe: function(clipId, prop, time, value, easing = 'linear') {
            const data = getClipData(clipId);
            if (!data[prop]) data[prop] = [];
            data[prop] = data[prop].filter(k => k.time !== time);
            data[prop].push({ time, value, easing });
            data[prop].sort((a, b) => a.time - b.time);
        },

        removeKeyframe: function(clipId, prop, time) {
            const data = getClipData(clipId);
            if (data[prop]) {
                data[prop] = data[prop].filter(k => Math.abs(k.time - time) > 0.01);
            }
        },

        getValue: function(clipId, prop, time) {
            const data = getClipData(clipId);
            if (!data[prop] || data[prop].length === 0) return null;
            const keys = data[prop];
            if (time <= keys[0].time) return keys[0].value;
            if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].value;

            for (let i = 0; i < keys.length - 1; i++) {
                if (time >= keys[i].time && time <= keys[i+1].time) {
                    let progress = (time - keys[i].time) / (keys[i+1].time - keys[i].time);
                    let easeFn = window.Easing[keys[i].easing] || window.Easing.linear;
                    let eased = easeFn(progress);
                    return keys[i].value + (keys[i+1].value - keys[i].value) * eased;
                }
            }
            return 0;
        },

        clearClip: function(clipId) {
            delete keyframes[clipId];
        },

        drawKeyframeEditor: function(canvas, clipData, currentTime) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, w, h);

            let rowY = 30;
            for (let prop in clipData) {
                ctx.fillStyle = '#444';
                ctx.fillRect(0, rowY - 20, w, 24);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(prop, 10, rowY - 5);

                clipData[prop].forEach(k => {
                    const x = k.time * w; // Assuming normalized time or scale
                    ctx.fillStyle = '#f0a';
                    ctx.beginPath();
                    ctx.moveTo(x, rowY - 12);
                    ctx.lineTo(x + 6, rowY - 6);
                    ctx.lineTo(x, rowY);
                    ctx.lineTo(x - 6, rowY - 6);
                    ctx.fill();
                });
                rowY += 30;
            }

            // Playhead
            ctx.strokeStyle = 'red';
            ctx.beginPath();
            ctx.moveTo(currentTime * w, 0);
            ctx.lineTo(currentTime * w, h);
            ctx.stroke();
        },

        setupKeyframeEditorInteraction: function(canvas, clipData, onUpdate) {
            // Placeholder for dragging keyframes
        },

        drawEasingCurve: function(canvas, easingName) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const fn = window.Easing[easingName] || window.Easing.linear;
            for (let x = 0; x < w; x++) {
                let t = x / w;
                let y = h - fn(t) * h;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        },

        applyPreset: function(clipId, presetName, startTime, duration) {
            const end = startTime + duration;
            switch(presetName) {
                case 'zoomIn':
                    this.addKeyframe(clipId, 'scale', startTime, 1, 'easeOut');
                    this.addKeyframe(clipId, 'scale', end, 1.5, 'linear');
                    break;
                case 'panLeft':
                    this.addKeyframe(clipId, 'x', startTime, 0, 'easeInOut');
                    this.addKeyframe(clipId, 'x', end, -200, 'linear');
                    break;
                case 'spin':
                    this.addKeyframe(clipId, 'rotation', startTime, 0, 'easeInOut');
                    this.addKeyframe(clipId, 'rotation', end, 360, 'linear');
                    break;
                case 'bounceIn':
                    this.addKeyframe(clipId, 'y', startTime, -500, 'bounce');
                    this.addKeyframe(clipId, 'y', end, 0, 'linear');
                    break;
            }
        },

        drawVelocityCurve: function(canvas, clipId, propName) {
            // Approximate derivative visualization
        }
    };
})();
