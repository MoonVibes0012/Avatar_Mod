/* ===== VTuber Forge — js/core/init.js ===== */
// Inisialisasi aplikasi, canvas, scene dasar, pencahayaan, dan render loop

(function () {
    'use strict';

    let isAppReady = false;
    let motionElapsed = 0;

    function setStatusText(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function logInit(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function updateObjectMotions(dt) {
        if (typeof window.S === 'undefined' || !window.S || !Array.isArray(window.S.objects)) return;
        const safeDt = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? Math.min(dt, 0.1) : 0.016;
        motionElapsed += safeDt;

        window.S.objects.forEach(entity => {
            if (!entity || !entity.enabled) return;
            if (entity._driverActive) return;

            const hasSpin = !!entity._animSpin;
            const hasPulse = !!entity._animPulse;
            const hasWobble = !!entity._animWobble;
            if (!hasSpin && !hasPulse && !hasWobble) return;

            try {
                if (!entity._baseScale && typeof entity.getLocalScale === 'function') {
                    entity._baseScale = entity.getLocalScale().clone();
                }
                if (!entity._baseRot && typeof entity.getEulerAngles === 'function') {
                    entity._baseRot = entity.getEulerAngles().clone();
                }

                const baseRot = entity._baseRot || { x: 0, y: 0, z: 0 };
                const baseScale = entity._baseScale || { x: 1, y: 1, z: 1 };

                if (hasSpin && typeof entity.rotate === 'function') {
                    entity.rotate(0, 65 * safeDt, 0);
                }

                if (hasWobble && typeof entity.setEulerAngles === 'function') {
                    const wobZ = Math.sin(motionElapsed * 5.0) * 8.0;
                    const wobX = Math.cos(motionElapsed * 3.2) * 4.0;
                    if (!hasSpin) {
                        entity.setEulerAngles(baseRot.x + wobX, baseRot.y, baseRot.z + wobZ);
                    }
                }

                if (hasPulse && typeof entity.setLocalScale === 'function') {
                    const pulseFactor = 1.0 + Math.sin(motionElapsed * 3.5) * 0.08;
                    entity.setLocalScale(
                        baseScale.x * pulseFactor,
                        baseScale.y * pulseFactor,
                        baseScale.z * pulseFactor
                    );
                }
            } catch (e) {}
        });
    }

    const canvas = document.getElementById('gl');
    if (!canvas) {
        throw new Error("Canvas #gl tidak ditemukan di dokumen.");
    }

    const app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        touch: new pc.TouchDevice(canvas),
        graphicsDeviceOptions: { antialias: false, alpha: false, preserveDrawingBuffer: false }
    });

    window.app = app;
    window.isAppReady = false;

    app.setCanvasFillMode(pc.FILLMODE_FILL_PARENT);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
    app.graphicsDevice.precision = 'highp';
    if (typeof app.resizeCanvas === 'function') {
        try { app.resizeCanvas(); } catch (e) {}
    }

    window.resetCameraGesture = function () {
        if (window.CameraControls) {
            window.CameraControls._dragging = false;
            window.CameraControls._panning = false;
            window.CameraControls._pinchDist = 0;
            window.CameraControls._pinchMid = null;
        }
    };

    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            try {
                if (typeof app.resizeCanvas === 'function') app.resizeCanvas();
                if (typeof app.render === 'function') app.render();
                if (typeof window.resetCameraGesture === 'function') window.resetCameraGesture();
            } catch (e) {
                logInit("Resize error: " + e.message);
            }
        }, 200);
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('webglcontextlost', function (event) {
        event.preventDefault();
        alert("Memori Grafis Penuh! Memuat ulang...");
        location.reload();
    }, false);

    app.start();
    isAppReady = true;
    window.isAppReady = true;

    const pivot = new pc.Entity('cameraPivot');
    pivot.setPosition(0, 1.1, 0);
    app.root.addChild(pivot);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.06, 0.06, 0.09),
        farClip: 200,
        nearClip: 0.1
    });
    camera.setPosition(0, 2.0, 4.5);
    camera.lookAt(0, 1.1, 0);
    pivot.addChild(camera);

    app.scene.ambientLight = new pc.Color(0.65, 0.65, 0.7);

    const keyLight = new pc.Entity('light');
    keyLight.addComponent('light', { type: 'directional', castShadows: false, intensity: 1.35 });
    keyLight.setEulerAngles(40, 35, 0);
    app.root.addChild(keyLight);

    const fillLight = new pc.Entity('fillLight');
    fillLight.addComponent('light', { type: 'directional', castShadows: false, intensity: 0.85 });
    fillLight.setEulerAngles(-35, -135, 0);
    app.root.addChild(fillLight);

    const ground = new pc.Entity('ground');
    ground.addComponent('render', { type: 'plane' });
    const matG = new pc.StandardMaterial();
    matG.diffuse = new pc.Color(0.16, 0.16, 0.22);
    if (typeof matG.update === 'function') matG.update();
    ground.render.material = matG;
    ground.setLocalScale(20, 1, 20);
    app.root.addChild(ground);

    const toggleGridEl = document.getElementById('toggleGrid');
    if (toggleGridEl) {
        toggleGridEl.onchange = (e) => {
            ground.enabled = !!e.target.checked;
        };
    }

    const bgColorEl = document.getElementById('bgColor');
    if (bgColorEl) {
        bgColorEl.onchange = (e) => {
            const v = e.target.value;
            let c;
            if (v === 'light') c = new pc.Color(1, 1, 1);
            else if (v === 'green') c = new pc.Color(0, 1, 0);
            else if (v === 'blue') c = new pc.Color(0, 0, 1);
            else c = new pc.Color(0.06, 0.06, 0.09);
            if (camera.camera) {
                camera.camera.clearColor = c;
            }
            setStatusText("Background: " + v);
        };
    }

    window.clearUndoStack = function () {
        if (Array.isArray(window.undoStack)) window.undoStack.length = 0;
        if (Array.isArray(window.redoStack)) window.redoStack.length = 0;
        if (window.meshCachePool && typeof window.meshCachePool.clear === 'function') {
            window.meshCachePool.clear();
        }
        logInit("⚠ Undo/redo/meshCache cleared (low memory)");
    };

    let targetFPS = 60;
    let lastFrameTime = performance.now();
    let isRendering = true;
    app.autoRender = false;

    function renderLoop(now) {
        if (!isRendering) return;
        requestAnimationFrame(renderLoop);
        if (now - lastFrameTime >= 1000 / targetFPS) {
            let dt = (now - lastFrameTime) / 1000;
            dt = Math.min(dt, 0.1);
            if (dt <= 0) dt = 0.016;
            lastFrameTime = now;
            updateObjectMotions(dt);
            app.update(dt);
            app.render();
        }
    }

    requestAnimationFrame(renderLoop);

    const fpsLimitEl = document.getElementById('fpsLimit');
    if (fpsLimitEl) {
        fpsLimitEl.oninput = (e) => {
            const parsed = parseInt(e.target.value, 10);
            targetFPS = isNaN(parsed) ? 60 : Math.max(10, Math.min(120, parsed));
            const outEl = document.getElementById('fpsOut');
            if (outEl) outEl.textContent = String(targetFPS);
        };
    }

    document.addEventListener('visibilitychange', () => {
        const loadingOv = document.getElementById('loadingOverlay');
        if (document.hidden) {
            isRendering = false;
            if (loadingOv) loadingOv.style.display = 'none';
        } else {
            isRendering = true;
            lastFrameTime = performance.now();
            requestAnimationFrame(renderLoop);
        }
    });

    logInit("✅ init.js loaded (ready=" + isAppReady + ")");
})();
