/* ===== VTuber Forge — js/core/init.js ===== */
// Inisialisasi PlayCanvas Application, canvas, kamera, pencahayaan, & perangkat input

(function () {
    'use strict';

    let pcApp = null;

    function logInit(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function initApp() {
        if (pcApp) return pcApp;

        const canvas = document.getElementById('gl');
        if (!canvas) {
            console.error('Canvas #gl tidak ditemukan!');
            return null;
        }

        if (typeof pc === 'undefined') {
            console.error('PlayCanvas (pc) belum dimuat!');
            return null;
        }

        const gfxOptions = {
            deviceTypes: ['webgl2', 'webgl1'],
            powerPreference: 'default',
            antialias: true,
            preserveDrawingBuffer: true
        };

        pcApp = new pc.Application(canvas, gfxOptions);
        window.app = pcApp;
        window.pcApp = pcApp;

        pcApp.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        pcApp.setCanvasResolution(pc.RESOLUTION_AUTO);

        if (pcApp.graphicsDevice) {
            const nativeDpr = window.devicePixelRatio || 1;
            pcApp.graphicsDevice.maxPixelRatio = Math.min(nativeDpr, 1.5);
        }

        window.addEventListener('resize', function () {
            if (pcApp && typeof pcApp.resizeCanvas === 'function') {
                pcApp.resizeCanvas();
            }
        });

        pcApp.start();

        if (pcApp.scene) {
            pcApp.scene.ambientLight = new pc.Color(0.65, 0.65, 0.65);
        }

        const light = new pc.Entity('DirectionalLight');
        light.addComponent('light', {
            type: 'directional',
            color: new pc.Color(1, 0.98, 0.95),
            intensity: 1.15,
            castShadows: false
        });
        light.setEulerAngles(45, 35, 0);
        pcApp.root.addChild(light);

        const fillLight = new pc.Entity('FillLight');
        fillLight.addComponent('light', {
            type: 'directional',
            color: new pc.Color(0.75, 0.85, 1.0),
            intensity: 0.45,
            castShadows: false
        });
        fillLight.setEulerAngles(-30, -120, 0);
        pcApp.root.addChild(fillLight);

        const camera = new pc.Entity('camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.11, 0.13, 0.18, 1),
            farClip: 100,
            nearClip: 0.05,
            fov: 45
        });
        camera.setPosition(0, 1.35, 3.6);
        camera.lookAt(0, 1.0, 0);
        pcApp.root.addChild(camera);

        if (window.VtfProceduralMotion && typeof window.VtfProceduralMotion.createGridFloor === 'function') {
            window.VtfProceduralMotion.createGridFloor(pcApp);
        }

        try {
            if (!pcApp.mouse && pc.Mouse) {
                pcApp.mouse = new pc.Mouse(canvas);
            }
            if (!pcApp.touch && pc.TouchDevice && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                pcApp.touch = new pc.TouchDevice(canvas);
            }
        } catch (e) {
            logInit('Info input device: ' + e.message);
        }

        if (window.VtfProceduralMotion && typeof window.VtfProceduralMotion.bindLoop === 'function') {
            window.VtfProceduralMotion.bindLoop(pcApp);
        }

        logInit('✅ VTuber Forge PlayCanvas initialized');
        return pcApp;
    }

    window.getPcApp = function () {
        return pcApp || initApp();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
