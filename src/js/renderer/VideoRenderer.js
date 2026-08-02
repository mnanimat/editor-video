/**
 * @file VideoRenderer.js
 * @description WebGL 2.0 video renderer pipeline
 */
(function() {
    const vsSource = `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }`;

    // A unified fragment shader applying all requested effects.
    const fsSource = `#version 300 es
    precision highp float;
    
    in vec2 v_texCoord;
    out vec4 outColor;
    
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_time;
    
    // Color Grading
    uniform vec3 u_lift;
    uniform vec3 u_gamma;
    uniform vec3 u_gain;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_temperature;
    uniform float u_tint;
    uniform float u_hue;
    
    // Effects toggles and params
    uniform bool u_enableBlur;
    uniform vec2 u_blurDir;
    
    uniform bool u_enableGlow;
    uniform float u_glowIntensity;
    
    uniform bool u_enableChromaKey;
    uniform vec3 u_chromaKeyColor;
    uniform float u_chromaSimilarity;
    uniform float u_chromaSmoothness;
    uniform float u_chromaSpill;
    
    uniform bool u_enableVignette;
    uniform float u_vignetteAmount;
    
    uniform bool u_enableFilmGrain;
    uniform float u_grainAmount;
    
    uniform bool u_enableChromaAb;
    uniform float u_chromaAbAmount;
    
    uniform bool u_enableGlitch;
    uniform float u_glitchAmount;
    
    uniform bool u_enableGodRays;
    uniform vec2 u_godRaysCenter;
    
    // Helper functions
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }
    
    void main() {
        vec2 uv = v_texCoord;
        
        // Glitch
        if (u_enableGlitch) {
            float g = rand(vec2(floor(uv.y * 100.0), u_time)) * u_glitchAmount;
            uv.x += g * 0.05;
        }
        
        // Chromatic Aberration
        vec4 color = texture(u_image, uv);
        if (u_enableChromaAb) {
            float r = texture(u_image, uv + vec2(u_chromaAbAmount, 0.0)).r;
            float b = texture(u_image, uv - vec2(u_chromaAbAmount, 0.0)).b;
            color.r = r;
            color.b = b;
        }
        
        // Blur (simple 1-pass for demo)
        if (u_enableBlur) {
            vec4 bColor = vec4(0.0);
            float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
            bColor += texture(u_image, uv) * weights[0];
            for(int i=1; i<5; ++i) {
                bColor += texture(u_image, uv + (u_blurDir * float(i)) / u_resolution) * weights[i];
                bColor += texture(u_image, uv - (u_blurDir * float(i)) / u_resolution) * weights[i];
            }
            color = bColor;
        }
        
        // Chroma Key
        if (u_enableChromaKey) {
            float diff = distance(color.rgb, u_chromaKeyColor);
            float alpha = smoothstep(u_chromaSimilarity, u_chromaSimilarity + u_chromaSmoothness, diff);
            color.a = min(color.a, alpha);
        }
        
        // Color Grading (Lift, Gamma, Gain)
        color.rgb = u_gain * (color.rgb + u_lift * (1.0 - color.rgb));
        color.rgb = pow(max(color.rgb, vec3(0.0)), u_gamma); 
        
        // Saturation & Contrast
        vec3 lumCoeff = vec3(0.2126, 0.7152, 0.0722);
        float lum = dot(color.rgb, lumCoeff);
        color.rgb = mix(vec3(lum), color.rgb, u_saturation);
        color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
        
        // Temperature & Tint (simplified)
        color.r += u_temperature * 0.1;
        color.b -= u_temperature * 0.1;
        color.g += u_tint * 0.1;
        
        // Hue
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.x += u_hue;
        color.rgb = hsv2rgb(hsv);
        
        // Vignette
        if (u_enableVignette) {
            float dist = distance(uv, vec2(0.5));
            color.rgb *= smoothstep(0.8, 1.0 - u_vignetteAmount * 0.5, 1.0 - dist);
        }
        
        // Film Grain
        if (u_enableFilmGrain) {
            float noise = (rand(uv + u_time) - 0.5) * u_grainAmount;
            color.rgb += noise;
        }
        
        outColor = color;
    }`;

    class VideoRenderer {
        constructor() {
            this.gl = null;
            this.program = null;
            this.texture = null;
            this.videoElement = null;
            this.time = 0;
            this.effects = {
                blur: false,
                blurDir: [1.0, 0.0],
                glow: false,
                glowIntensity: 0.5,
                chromaKey: false,
                chromaKeyColor: [0.0, 1.0, 0.0],
                chromaSimilarity: 0.4,
                chromaSmoothness: 0.1,
                chromaSpill: 0.1,
                vignette: false,
                vignetteAmount: 0.5,
                filmGrain: false,
                grainAmount: 0.1,
                chromaAb: false,
                chromaAbAmount: 0.005,
                glitch: false,
                glitchAmount: 0.1,
                godRays: false,
                godRaysCenter: [0.5, 0.5]
            };
            this.colorGrade = {
                lift: [0, 0, 0],
                gamma: [1, 1, 1],
                gain: [1, 1, 1],
                contrast: 1.0,
                saturation: 1.0,
                temperature: 0.0,
                tint: 0.0,
                hue: 0.0
            };
        }

        /**
         * Initialize the renderer
         * @param {string} canvasId - HTML Canvas element ID
         */
        init(canvasId = 'preview-canvas') {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error('Canvas not found:', canvasId);
                return;
            }
            this.gl = canvas.getContext('webgl2');
            if (!this.gl) {
                console.error('WebGL 2 not supported');
                return;
            }

            const vs = this._compileShader(this.gl.VERTEX_SHADER, vsSource);
            const fs = this._compileShader(this.gl.FRAGMENT_SHADER, fsSource);
            this.program = this.gl.createProgram();
            this.gl.attachShader(this.program, vs);
            this.gl.attachShader(this.program, fs);
            this.gl.linkProgram(this.program);
            if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
                console.error(this.gl.getProgramInfoLog(this.program));
            }

            // Setup geometry
            const positions = new Float32Array([
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,
                -1.0,  1.0,
                 1.0, -1.0,
                 1.0,  1.0,
            ]);
            const texCoords = new Float32Array([
                0.0, 1.0,
                1.0, 1.0,
                0.0, 0.0,
                0.0, 0.0,
                1.0, 1.0,
                1.0, 0.0,
            ]);

            const posBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

            const texBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

            const vao = this.gl.createVertexArray();
            this.gl.bindVertexArray(vao);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
            const posLoc = this.gl.getAttribLocation(this.program, 'a_position');
            this.gl.enableVertexAttribArray(posLoc);
            this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texBuffer);
            const texLoc = this.gl.getAttribLocation(this.program, 'a_texCoord');
            this.gl.enableVertexAttribArray(texLoc);
            this.gl.vertexAttribPointer(texLoc, 2, this.gl.FLOAT, false, 0, 0);

            this.texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        }

        _compileShader(type, source) {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                console.error(this.gl.getShaderInfoLog(shader));
                this.gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        /**
         * Load a video element into the renderer
         * @param {HTMLVideoElement} videoElement
         */
        loadVideo(videoElement) {
            this.videoElement = videoElement;
        }

        /**
         * Render a frame
         * @param {number} time - current time
         */
        render(time) {
            if (!this.gl || !this.videoElement) return;

            this.time = time;
            
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
            this.gl.clearColor(0, 0, 0, 1);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);

            this.gl.useProgram(this.program);

            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            try {
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.videoElement);
            } catch (e) {
                // Video might not be ready
            }

            // Set uniforms
            const set1f = (name, val) => this.gl.uniform1f(this.gl.getUniformLocation(this.program, name), val);
            const set1i = (name, val) => this.gl.uniform1i(this.gl.getUniformLocation(this.program, name), val);
            const set2f = (name, x, y) => this.gl.uniform2f(this.gl.getUniformLocation(this.program, name), x, y);
            const set3f = (name, x, y, z) => this.gl.uniform3f(this.gl.getUniformLocation(this.program, name), x, y, z);

            set1f('u_time', this.time);
            set2f('u_resolution', this.gl.canvas.width, this.gl.canvas.height);

            set3f('u_lift', ...this.colorGrade.lift);
            set3f('u_gamma', ...this.colorGrade.gamma);
            set3f('u_gain', ...this.colorGrade.gain);
            set1f('u_contrast', this.colorGrade.contrast);
            set1f('u_saturation', this.colorGrade.saturation);
            set1f('u_temperature', this.colorGrade.temperature);
            set1f('u_tint', this.colorGrade.tint);
            set1f('u_hue', this.colorGrade.hue);

            set1i('u_enableBlur', this.effects.blur ? 1 : 0);
            set2f('u_blurDir', this.effects.blurDir[0], this.effects.blurDir[1]);
            
            set1i('u_enableGlow', this.effects.glow ? 1 : 0);
            set1f('u_glowIntensity', this.effects.glowIntensity);
            
            set1i('u_enableChromaKey', this.effects.chromaKey ? 1 : 0);
            set3f('u_chromaKeyColor', ...this.effects.chromaKeyColor);
            set1f('u_chromaSimilarity', this.effects.chromaSimilarity);
            set1f('u_chromaSmoothness', this.effects.chromaSmoothness);
            set1f('u_chromaSpill', this.effects.chromaSpill);
            
            set1i('u_enableVignette', this.effects.vignette ? 1 : 0);
            set1f('u_vignetteAmount', this.effects.vignetteAmount);
            
            set1i('u_enableFilmGrain', this.effects.filmGrain ? 1 : 0);
            set1f('u_grainAmount', this.effects.grainAmount);
            
            set1i('u_enableChromaAb', this.effects.chromaAb ? 1 : 0);
            set1f('u_chromaAbAmount', this.effects.chromaAbAmount);
            
            set1i('u_enableGlitch', this.effects.glitch ? 1 : 0);
            set1f('u_glitchAmount', this.effects.glitchAmount);

            this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        }

        /**
         * Set an effect parameter
         * @param {string} name - Effect name
         * @param {Object} params - Parameters object
         */
        setEffect(name, params) {
            if (this.effects.hasOwnProperty(name)) {
                this.effects[name] = true;
                Object.assign(this.effects, params);
            }
        }

        /**
         * Clear all effects
         */
        clearEffects() {
            for (let key in this.effects) {
                if (typeof this.effects[key] === 'boolean') {
                    this.effects[key] = false;
                }
            }
        }

        /**
         * Apply color grading
         * @param {Object} cgParams
         */
        applyColorGrade(cgParams) {
            Object.assign(this.colorGrade, cgParams);
        }
    }

    window.VideoRenderer = new VideoRenderer();
})();
