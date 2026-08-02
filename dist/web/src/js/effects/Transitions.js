/**
 * @file Transitions.js
 * @description Transition effects between clips using Canvas 2D.
 */
(function() {
    const Transitions = {
        /**
         * Dissolve (crossfade)
         */
        dissolve(ctx, videoA, videoB, progress, width, height) {
            ctx.globalAlpha = 1 - progress;
            if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            ctx.globalAlpha = progress;
            if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            ctx.globalAlpha = 1.0;
        },

        fade(ctx, videoA, videoB, progress, width, height) {
            if (progress < 0.5) {
                let p = progress * 2;
                if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
                ctx.fillStyle = `rgba(0,0,0,${p})`;
                ctx.fillRect(0, 0, width, height);
            } else {
                let p = (progress - 0.5) * 2;
                ctx.fillStyle = `black`;
                ctx.fillRect(0, 0, width, height);
                ctx.globalAlpha = p;
                if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
                ctx.globalAlpha = 1.0;
            }
        },

        wipe(ctx, videoA, videoB, progress, width, height) {
            if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            ctx.save();
            ctx.beginPath();
            ctx.rect(progress * width, 0, width, height);
            ctx.clip();
            if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            ctx.restore();
        },

        zoom(ctx, videoA, videoB, progress, width, height) {
            if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            ctx.save();
            ctx.translate(width/2, height/2);
            ctx.scale(progress, progress);
            ctx.translate(-width/2, -height/2);
            ctx.globalAlpha = progress;
            if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            ctx.restore();
        },

        slide(ctx, videoA, videoB, progress, width, height) {
            let offset = progress * width;
            if (videoA) ctx.drawImage(videoA, -offset, 0, width, height);
            if (videoB) ctx.drawImage(videoB, width - offset, 0, width, height);
        },

        spin(ctx, videoA, videoB, progress, width, height) {
            ctx.save();
            ctx.translate(width/2, height/2);
            ctx.rotate(progress * Math.PI * 2);
            ctx.scale(progress, progress);
            ctx.translate(-width/2, -height/2);
            if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            ctx.restore();
            ctx.globalAlpha = 1 - progress;
            if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            ctx.globalAlpha = 1.0;
        },

        glitch(ctx, videoA, videoB, progress, width, height) {
            if (Math.random() > progress) {
                if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            } else {
                if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            }
            if (Math.random() > 0.5) {
                let y = Math.random() * height;
                let h = Math.random() * 50;
                let offset = (Math.random() - 0.5) * 100;
                ctx.drawImage(ctx.canvas, 0, y, width, h, offset, y, width, h);
            }
        },

        burn(ctx, videoA, videoB, progress, width, height) {
            ctx.globalCompositeOperation = 'source-over';
            if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            ctx.globalCompositeOperation = 'color-burn';
            ctx.fillStyle = `rgba(255,100,0,${progress})`;
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = progress;
            if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            ctx.globalAlpha = 1.0;
        },

        iris(ctx, videoA, videoB, progress, width, height) {
            if (videoA) ctx.drawImage(videoA, 0, 0, width, height);
            ctx.save();
            ctx.beginPath();
            ctx.arc(width/2, height/2, progress * Math.max(width, height), 0, Math.PI * 2);
            ctx.clip();
            if (videoB) ctx.drawImage(videoB, 0, 0, width, height);
            ctx.restore();
        }
    };

    window.Transitions = Transitions;
})();
