/* ===== VTuber Forge — js/core/gpu_context_recovery.js ===== */
// Deteksi renderer/GPU, penanganan WebGL Context Lost/Restored, & pembersihan cache memori GPU

(function () {
    'use strict';

    const deviceState = {
        renderer: 'WebGL',
        maxPixelRatio: 1.5,
        precision: 'mediump',
        precisionNeedsReload: false,
        lastGpuEvent: 'Normal',
        contextLostCount: 0
    };

    let boundCanvas = null;

    function getAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function logGpu(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function detectDeviceInfo(currentSettings) {
        const pcApp = getAppSafe();
        const gd = pcApp && pcApp.graphicsDevice ? pcApp.graphicsDevice : null;
        let rendererLabel = 'WebGL';

        if (gd && gd.gl) {
            const gl = gd.gl;
            try {
                const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
                if (dbgExt) {
                    const r = gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL);
                    if (r) rendererLabel = String(r);
                } else {
                    const ver = gl.getParameter(gl.RENDERER);
                    if (ver) rendererLabel = String(ver);
                }
            } catch (e) {}
        }

        deviceState.renderer = rendererLabel;
        if (currentSettings) {
            deviceState.maxPixelRatio = Number(currentSettings.maxPixelRatio) || 1.5;
            deviceState.precision = currentSettings.precision || 'mediump';
        }
        return deviceState;
    }

    function trimGpuMemoryCache(currentSettings) {
        let trimmed = 0;

        if (Array.isArray(window.meshCachePool) && window.meshCachePool.length > 4) {
            const excess = window.meshCachePool.splice(0, window.meshCachePool.length - 4);
            trimmed += excess.length;
        }

        if (Array.isArray(window.undoStack) && window.undoStack.length > 10) {
            const removed = window.undoStack.splice(0, window.undoStack.length - 10);
            trimmed += removed.length;
        }

        const pcApp = getAppSafe();
        if (pcApp && pcApp.graphicsDevice && typeof pcApp.graphicsDevice.maxPixelRatio === 'number') {
            const cap = Math.min(Number(currentSettings && currentSettings.maxPixelRatio) || 1.5, 1.5);
            const nativeDpr = Math.min(window.devicePixelRatio || 1, cap);
            pcApp.graphicsDevice.maxPixelRatio = nativeDpr;
            if (typeof pcApp.resizeCanvas === 'function') {
                try { pcApp.resizeCanvas(); } catch (e) {}
            }
        }

        deviceState.lastGpuEvent = 'Cache Dibersihkan (' + trimmed + ')';
        logGpu('🧹 GPU cache trimmed: ' + trimmed + ' item');
        if (typeof window.__vtfOnGpuSettingsUpdated === 'function') {
            try { window.__vtfOnGpuSettingsUpdated(); } catch (e) {}
        }
        return trimmed;
    }

    function bindContextEvents(getSettingsFn, onRestoredFn) {
        const pcApp = getAppSafe();
        const canvas = (pcApp && pcApp.graphicsDevice && pcApp.graphicsDevice.canvas) || document.getElementById('gl');
        if (!canvas || boundCanvas === canvas) return;
        boundCanvas = canvas;

        canvas.addEventListener('webglcontextlost', function (e) {
            const s = (typeof getSettingsFn === 'function') ? getSettingsFn() : {};
            deviceState.contextLostCount += 1;
            deviceState.lastGpuEvent = 'Context Lost';
            logGpu('⚠ WebGL context lost #' + deviceState.contextLostCount);

            if (s && s.autoRecoverContext !== false) {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof window.__vtfShowLoading === 'function') {
                    window.__vtfShowLoading('Memulihkan konteks GPU (WebGL)...');
                }
            }

            if (typeof window.__vtfOnGpuSettingsUpdated === 'function') {
                try { window.__vtfOnGpuSettingsUpdated(); } catch (err) {}
            }
        }, false);

        canvas.addEventListener('webglcontextrestored', function () {
            deviceState.lastGpuEvent = 'Context Restored';
            logGpu('✅ WebGL context restored');

            if (typeof onRestoredFn === 'function') {
                try { onRestoredFn(); } catch (e) {}
            }

            if (typeof window.__vtfHideLoading === 'function') {
                window.__vtfHideLoading();
            }

            if (typeof window.__vtfOnGpuSettingsUpdated === 'function') {
                try { window.__vtfOnGpuSettingsUpdated(); } catch (e) {}
            }
        }, false);
    }

    window.VtfGpuContextRecovery = {
        getDeviceState: function () { return deviceState; },
        detectDeviceInfo: detectDeviceInfo,
        trimGpuMemoryCache: trimGpuMemoryCache,
        bindContextEvents: bindContextEvents
    };
})();
