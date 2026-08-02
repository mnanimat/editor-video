/**
 * @file Project.js
 * @description Project state manager.
 */
(function() {
    class Project {
        constructor() {
            this.reset();
        }

        /**
         * Resets the project to its initial state.
         */
        reset() {
            this.clips = [];
            this.tracks = []; // Array of {id, type, name, clips}
            this.selectedClipId = null;
            this.playheadTime = 0;
            this.duration = 0;
            this.fps = 30;
            this.resolution = { width: 1920, height: 1080 };
            this.colorGradeData = {}; // Per clip
            this.effects = {}; // Per clip
            this.keyframes = {};
            
            if (window.EventBus) {
                window.EventBus.emit('project:reset', this);
            }
        }

        /**
         * Add a clip to the project.
         * @param {Object} clip - The clip object
         */
        addClip(clip) {
            this.clips.push(clip);
            if (window.EventBus) window.EventBus.emit('clip:added', clip);
            this._recalculateDuration();
        }

        /**
         * Remove a clip from the project by id.
         * @param {string} id - The clip id
         */
        removeClip(id) {
            this.clips = this.clips.filter(c => c.id !== id);
            
            // Remove from tracks
            this.tracks.forEach(track => {
                if (track.clips) {
                    track.clips = track.clips.filter(cId => cId !== id);
                }
            });

            if (this.selectedClipId === id) {
                this.selectedClipId = null;
            }
            
            if (window.EventBus) window.EventBus.emit('clip:removed', id);
            this._recalculateDuration();
        }

        /**
         * Select a clip.
         * @param {string} id - The clip id
         */
        selectClip(id) {
            this.selectedClipId = id;
            if (window.EventBus) window.EventBus.emit('clip:selected', id);
        }

        /**
         * Update a clip's properties.
         * @param {string} id - The clip id
         * @param {Object} props - The properties to update
         */
        updateClip(id, props) {
            const clip = this.clips.find(c => c.id === id);
            if (clip) {
                Object.assign(clip, props);
                if (window.EventBus) window.EventBus.emit('clip:updated', clip);
                this._recalculateDuration();
            }
        }

        /**
         * Add a new track.
         * @param {string} type - The type of track ('video' or 'audio')
         */
        addTrack(type) {
            const track = {
                id: 'track_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                type: type,
                name: `New ${type} Track`,
                clips: []
            };
            this.tracks.push(track);
            if (window.EventBus) window.EventBus.emit('track:added', track);
            return track;
        }

        /**
         * Recalculate total duration based on clips.
         * @private
         */
        _recalculateDuration() {
            let maxDuration = 0;
            this.clips.forEach(clip => {
                const end = (clip.start || 0) + (clip.duration || 0);
                if (end > maxDuration) maxDuration = end;
            });
            this.duration = maxDuration;
            if (window.EventBus) window.EventBus.emit('project:durationChanged', this.duration);
        }

        /**
         * Serialize project to JSON.
         * @returns {string} JSON string
         */
        serialize() {
            return JSON.stringify({
                clips: this.clips,
                tracks: this.tracks,
                duration: this.duration,
                fps: this.fps,
                resolution: this.resolution,
                colorGradeData: this.colorGradeData,
                effects: this.effects,
                keyframes: this.keyframes
            });
        }

        /**
         * Deserialize project from JSON.
         * @param {string} json - JSON string
         */
        deserialize(json) {
            try {
                const data = JSON.parse(json);
                this.reset();
                Object.assign(this, data);
                if (window.EventBus) window.EventBus.emit('project:loaded', this);
            } catch (e) {
                console.error("Failed to deserialize project", e);
            }
        }
    }

    window.Project = new Project();
})();
