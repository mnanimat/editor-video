/**
 * @file AudioEngine.js
 * @description Web Audio API engine.
 */
(function() {
    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.compressor = null;
            this.analyser = null;
            this.tracks = {}; // id -> { gainNode, pannerNode, eqNodes: [], sourceNode }
            this.convolver = null;
        }

        /**
         * Initialize the Web Audio Context
         */
        init() {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            this.masterGain = this.ctx.createGain();
            this.compressor = this.ctx.createDynamicsCompressor();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 256;

            // Setup reverb
            this.convolver = this.ctx.createConvolver();
            this._createSyntheticReverb();

            // Routing: masterGain -> compressor -> analyser -> destination
            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
        }

        _createSyntheticReverb() {
            const length = this.ctx.sampleRate * 2.0; // 2 seconds
            const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            for (let i = 0; i < length; i++) {
                const decay = Math.exp(-i / (this.ctx.sampleRate * 0.5));
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }
            this.convolver.buffer = impulse;
        }

        /**
         * Add an audio track
         * @param {string} id 
         */
        addTrack(id) {
            if (!this.ctx) return;
            const gainNode = this.ctx.createGain();
            const pannerNode = this.ctx.createStereoPanner();
            
            // Create 10-band EQ
            const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
            const eqNodes = frequencies.map(freq => {
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1;
                filter.gain.value = 0;
                return filter;
            });

            // Chain EQ nodes
            for (let i = 0; i < eqNodes.length - 1; i++) {
                eqNodes[i].connect(eqNodes[i+1]);
            }

            pannerNode.connect(eqNodes[0]);
            eqNodes[eqNodes.length - 1].connect(gainNode);
            gainNode.connect(this.masterGain);

            this.tracks[id] = { gainNode, pannerNode, eqNodes, sourceNode: null };
        }

        /**
         * Remove an audio track
         * @param {string} id 
         */
        removeTrack(id) {
            const track = this.tracks[id];
            if (track) {
                track.gainNode.disconnect();
                if (track.sourceNode) track.sourceNode.disconnect();
                delete this.tracks[id];
            }
        }

        /**
         * Set track gain (volume)
         * @param {string} id 
         * @param {number} val 0.0 to 1.0+
         */
        setTrackGain(id, val) {
            const track = this.tracks[id];
            if (track) track.gainNode.gain.value = val;
        }

        /**
         * Mute/unmute track
         * @param {string} id 
         * @param {boolean} isMuted 
         */
        setTrackMute(id, isMuted) {
            const track = this.tracks[id];
            if (track) track.gainNode.gain.value = isMuted ? 0 : 1;
        }

        /**
         * Set EQ band gain
         * @param {string} id 
         * @param {number} band Index 0-9
         * @param {number} gainDb Gain in decibels
         */
        setEQBand(id, band, gainDb) {
            const track = this.tracks[id];
            if (track && track.eqNodes[band]) {
                track.eqNodes[band].gain.value = gainDb;
            }
        }

        /**
         * Connect an HTML media element to a track
         * @param {string} id 
         * @param {HTMLMediaElement} el 
         */
        connectMediaElement(id, el) {
            const track = this.tracks[id];
            if (track && this.ctx) {
                if (!track.sourceNode) {
                    track.sourceNode = this.ctx.createMediaElementSource(el);
                    track.sourceNode.connect(track.pannerNode);
                }
            }
        }

        /**
         * Get frequency data for visualization
         * @returns {Uint8Array} Data array
         */
        getAnalyserData() {
            if (!this.analyser) return new Uint8Array(0);
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            return dataArray;
        }

        /**
         * Draw VU Meter on canvas
         * @param {HTMLCanvasElement} canvas 
         * @param {Uint8Array} data 
         */
        drawVUMeter(canvas, data) {
            if (!canvas || !data || data.length === 0) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            
            ctx.clearRect(0, 0, width, height);
            
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            let avg = sum / data.length;
            
            const level = avg / 255; // 0 to 1
            
            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, 'green');
            gradient.addColorStop(0.8, 'yellow');
            gradient.addColorStop(1, 'red');
            
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, height - (level * height), width, level * height);
        }
    }

    window.AudioEngine = new AudioEngine();
})();
