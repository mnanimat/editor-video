window.Timeline = (function() {
    let canvas, rulerCanvas, headerCanvas, ctx, rCtx, hCtx;
    let tracks = [];
    let playheadTime = 0;
    let zoomPps = 100; // pixels per second
    let scrollX = 0;
    let scrollY = 0;

    let history = [], redoHistory = [];

    function saveState() {
        history.push(JSON.stringify(tracks));
        redoHistory = [];
    }

    return {
        init: function(c, r, h) {
            canvas = c; rulerCanvas = r; headerCanvas = h;
            ctx = canvas.getContext('2d');
            rCtx = rulerCanvas.getContext('2d');
            hCtx = headerCanvas.getContext('2d');
            this.setupInteractions();
            this.render();
        },

        addTrack: function(type, name) {
            saveState();
            tracks.push({ id: Date.now(), type, name, clips: [] });
            this.render();
        },

        addClip: function(trackId, clip) {
            saveState();
            const t = tracks.find(t => t.id === trackId);
            if(t) t.clips.push(clip);
            this.render();
        },

        removeClip: function(id) {
            saveState();
            tracks.forEach(t => t.clips = t.clips.filter(c => c.id !== id));
            this.render();
        },

        splitClipAtPlayhead: function() {
            saveState();
            tracks.forEach(t => {
                let toAdd = [];
                t.clips.forEach(c => {
                    if (playheadTime > c.start && playheadTime < c.start + c.duration) {
                        let originalDuration = c.duration;
                        c.duration = playheadTime - c.start;
                        toAdd.push({
                            id: Date.now() + Math.random(),
                            start: playheadTime,
                            duration: originalDuration - c.duration,
                            name: c.name + ' (part 2)'
                        });
                    }
                });
                t.clips.push(...toAdd);
            });
            this.render();
        },

        setPlayhead: function(t) {
            playheadTime = Math.max(0, t);
            this.render();
        },

        setZoom: function(pps) {
            zoomPps = Math.max(10, Math.min(1000, pps));
            this.render();
        },

        getClipAt: function(x, y) {
            const time = (x + scrollX) / zoomPps;
            const trackIdx = Math.floor((y + scrollY) / 60);
            if (tracks[trackIdx]) {
                return tracks[trackIdx].clips.find(c => time >= c.start && time <= c.start + c.duration);
            }
            return null;
        },

        render: function() {
            if (!ctx) return;
            const w = canvas.width, h = canvas.height;
            
            // Clear all
            ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, w, h);
            rCtx.fillStyle = '#2a2a2a'; rCtx.fillRect(0, 0, w, rulerCanvas.height);
            hCtx.fillStyle = '#252525'; hCtx.fillRect(0, 0, headerCanvas.width, h);

            // Draw Ruler
            rCtx.fillStyle = '#fff';
            rCtx.font = '10px Arial';
            const visibleStart = scrollX / zoomPps;
            const visibleEnd = (scrollX + w) / zoomPps;
            
            for (let t = Math.floor(visibleStart); t <= visibleEnd; t += 1) {
                let px = t * zoomPps - scrollX;
                rCtx.fillRect(px, 15, 1, 15);
                rCtx.fillText(t + 's', px + 3, 12);
            }

            // Draw Tracks and Clips
            tracks.forEach((track, i) => {
                const ty = i * 60 - scrollY;
                
                // Track Header
                hCtx.fillStyle = '#333';
                hCtx.fillRect(0, ty, headerCanvas.width, 58);
                hCtx.fillStyle = '#fff';
                hCtx.font = '12px Arial';
                hCtx.fillText(track.name, 10, ty + 30);

                // Track Background
                ctx.fillStyle = (i % 2 === 0) ? '#222' : '#282828';
                ctx.fillRect(0, ty, w, 58);

                // Clips
                track.clips.forEach(clip => {
                    const cx = clip.start * zoomPps - scrollX;
                    const cw = clip.duration * zoomPps;
                    
                    let color = track.type === 'video' ? '#00bcd4' : track.type === 'audio' ? '#ff9800' : '#9c27b0';
                    ctx.fillStyle = color;
                    
                    // Rounded rect
                    ctx.beginPath();
                    ctx.roundRect(cx, ty + 5, cw, 48, 5);
                    ctx.fill();
                    
                    ctx.fillStyle = '#fff';
                    ctx.fillText(clip.name || 'Clip', cx + 5, ty + 25);
                    
                    // Trimming handles
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.fillRect(cx, ty + 5, 5, 48);
                    ctx.fillRect(cx + cw - 5, ty + 5, 5, 48);
                });
            });

            // Playhead
            const px = playheadTime * zoomPps - scrollX;
            if (px >= 0 && px <= w) {
                // Ruler triangle
                rCtx.fillStyle = '#f00';
                rCtx.beginPath();
                rCtx.moveTo(px - 5, 0); rCtx.lineTo(px + 5, 0); rCtx.lineTo(px, 10);
                rCtx.fill();
                
                // Timeline line
                ctx.strokeStyle = '#f00';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
            }
        },

        setupInteractions: function() {
            let isDraggingPlayhead = false;
            rulerCanvas.addEventListener('mousedown', (e) => {
                isDraggingPlayhead = true;
                this.setPlayhead((e.clientX + scrollX) / zoomPps);
            });
            window.addEventListener('mouseup', () => isDraggingPlayhead = false);
            window.addEventListener('mousemove', (e) => {
                if (isDraggingPlayhead) {
                    this.setPlayhead((e.clientX + scrollX) / zoomPps);
                }
            });

            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.ctrlKey) {
                    this.setZoom(zoomPps - e.deltaY * 0.1);
                } else {
                    scrollX = Math.max(0, scrollX + e.deltaX);
                    scrollY = Math.max(0, scrollY + e.deltaY);
                    this.render();
                }
            });
        },

        undo: function() {
            if (history.length > 0) {
                redoHistory.push(JSON.stringify(tracks));
                tracks = JSON.parse(history.pop());
                this.render();
            }
        },
        
        redo: function() {
            if (redoHistory.length > 0) {
                history.push(JSON.stringify(tracks));
                tracks = JSON.parse(redoHistory.pop());
                this.render();
            }
        },

        loadFromProject: function(projectData) {
            tracks = projectData.tracks || [];
            this.render();
        }
    };
})();
