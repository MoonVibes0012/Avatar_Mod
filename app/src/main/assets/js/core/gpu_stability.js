/* ===== VTuber Forge — js/core/gpu_stability.js ===== */
// Modul stabilitas & pengaturan GPU PlayCanvas (preset performa/stabilitas & recovery WebGL context)

(function () {
    'use strict';

    const STORAGE_KEY = 'vtuber_forge_gpu_settings_v1';

    const PRESETS = {
        balanced: {
            label: 'Balanced (MP3 Friendly)',
            maxPixelRatio: 1.5,
            precision: 'mediump',
            shadowsEnabled: false,
            ambientIntensity: 0.65,
            keyLightIntensity: 1.35,
            fillLightIntensity: 0.85,
            autoRecoverContext: true
        },
        stability: {
            label: 'Max Stability (Low VRAM/GPU)',
            maxPixelRatio: 1.0,
            precision: 'mediump',
            shadowsEnabled: false,
            ambientIntensity: 0.72,
            keyLightIntensity: 1.25,
            fillLightIntensity: 0.80,
            autoRecoverContext: true
        },
        quality: {
            label: 'High Visuals',
            maxPixelRatio: 2.0,
            precision: 'highp',
            shadowsEnabled: false,
            ambientIntensity: 0.65,
            keyLightIntensity: 1.40,
            fillLightIntensity: 0.90,
            autoRecoverContext: true
        }
    };

    const defaultSettings = {
        preset: 'balanced',
        maxPixelRatio: PRESETS.balanced.maxPixelRatio,
        precision: PRESETS.balanced.precision,
        shadowsEnabled: PRESETS.balanced.shadowsEnabled,
        ambientIntensity: PRESETS.balanced.ambientIntensity,
        keyLightIntensity: PRESETS.balanced.keyLightIntensity,
        fillLightIntensity: PRESETS.balanced.fillLightIntensity,
        autoRecoverContext: PRESETS.balanced.autoRecoverContext
    };

    let currentSettings = Object.assign({}, defaultSettings);
    let contextLostCount = 0;
    let lastGpuEvent = 'Normal';
    let listenersBound = false;

    function logGpu(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function setGpuStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function getPcAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function loadSavedSettings() {
        try {
            if (!window.localStorage) return;
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            currentSettings = Object.assign({}, defaultSettings, parsed);
            currentSettings.maxPixelRatio = Math.max(0.75, Math.min(2.5, Number(currentSettings.maxPixelRatio) || 1.5));
            if (currentSettings.precision !== 'highp' && currentSettings.precision !== 'mediump') {
                currentSettings.precision = 'mediump';
            }
        } catch (e) {}
    }

    function saveSettingsToStorage() {
        try {
            if (!window.localStorage) return;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
        } catch (e) {}
    }

    function applyLightsConfig(pcApp) {
        if (!pcApp || !pcApp.root) return;
        try {
            const amb = Number(currentSettings.ambientIntensity);
            const safeAmb = isFinite(amb) ? Math.max(0.1, Math.min(1.5, amb)) : 0.65;
            if (pcApp.scene) {
                pcApp.scene.ambientLight = new pc.Color(safeAmb, safeAmb, Math.min(1, safeAmb + 0.05));
            }
            const keyLight = pcApp.root.findByName('light');
            if (keyLight && keyLight.light) {
                keyLight.light.intensity = Math.max(0, Math.min(3, Number(currentSettings.keyLightIntensity) || 1.35));
                keyLight.light.castShadows = !!currentSettings.shadowsEnabled;
            }
            const fillLight = pcApp.root.findByName('fillLight');
            if (fillLight && fillLight.light) {
                fillLight.light.intensity = Math.max(0, Math.min(3, Number(currentSettings.fillLightIntensity) || 0.85));
                fillLight.light.castShadows = false;
            }
        } catch (e) {
            logGpu("GPU light apply warning: " + e.message);
        }
    }

    function applySettings(partialOrFull, persist) {
        if (partialOrFull && typeof partialOrFull === 'object') {
            currentSettings = Object.assign({}, currentSettings, partialOrFull);
        }
        if (persist !== false) {
            saveSettingsToStorage();
        }

        const pcApp = getPcAppSafe();
        if (pcApp && pcApp.graphicsDevice) {
            try {
                const dprCap = Math.max(0.75, Math.min(2.5, Number(currentSettings.maxPixelRatio) || 1.5));
                pcApp.graphicsDevice.maxPixelRatio = dprCap;
                if (currentSettings.precision === 'highp' || currentSettings.precision === 'mediump') {
                    pcApp.graphicsDevice.precision = currentSettings.precision;
                }
                if (typeof pcApp.resizeCanvas === 'function') {
                    pcApp.resizeCanvas();
                }
            } catch (e) {
                logGpu("GPU device apply warning: " + e.message);
            }
        }

        applyLightsConfig(pcApp);

        if (pcApp && typeof pcApp.render === 'function') {
            try { pcApp.render(); } catch (e) {}
        }

        if (typeof window.__vtfOnGpuSettingsUpdated === 'function') {
            try { window.__vtfOnGpuSettingsUpdated(getInfo()); } catch (e) {}
        }
        return getInfo();
    }

    function applyPreset(presetName, persist) {
        const key = PRESETS[presetName] ? presetName : 'balanced';
        const p = PRESETS[key];
        return applySettings({
            preset: key,
            maxPixelRatio: p.maxPixelRatio,
            precision: p.precision,
            shadowsEnabled: p.shadowsEnabled,
            ambientIntensity: p.ambientIntensity,
            keyLightIntensity: p.keyLightIntensity,
            fillLightIntensity: p.fillLightIntensity,
            autoRecoverContext: p.autoRecoverContext
        }, persist);
    }

    function trimGpuMemoryCache() {
        let freed = 0;
        try {
            if (Array.isArray(window.undoStack) && window.undoStack.length > 5) {
                const removed = window.undoStack.splice(0, window.undoStack.length - 5);
                freed += removed.length;
            }
            if (Array.isArray(window.redoStack) && window.redoStack.length > 0) {
                freed += window.redoStack.length;
                window.redoStack.length = 0;
            }
            const pcApp = getPcAppSafe();
            if (pcApp && typeof pcApp.render === 'function') {
                pcApp.render();
            }
        } catch (e) {}
        lastGpuEvent = 'Trimmed history (' + freed + ' slots)';
        setGpuStatus("🧹 Cache riwayat dibersihkan untuk stabilitas GPU.");
        if (typeof window.__vtfOnGpuSettingsUpdated === 'function') {
            window.__vtfOnGpuSettingsUpdated(getInfo());
        }
    }

    function bindContextEvents() {
        if (listenersBound) return;
        const pcApp = getPcAppSafe();
        const canvas = document.getElementById('gl') || (pcApp && pcApp.graphicsDevice && pcApp.graphicsDevice.canvas);
        if (!canvas) return;
        listenersBound = true;

        canvas.addEventListener('webglcontextlost', function (e) {
            contextLostCount += 1;
            lastGpuEvent = 'Context Lost #' + contextLostCount;
            logGpu("⚠ WebGL context lost #" + contextLostCount);
            if (!currentSettings.autoRecoverContext) return;
            e.preventDefault();
            setGpuStatus("⚠ GPU context terputus — mencoba stabilisasi & pemulihan...");
            try {
                if (Array.isArray(window.undoStack) && window.undoStack.length > 3) {
                    window.undoStack.splice(0, window.undoStack.length - 3);
                }
            } catch (err) {}
        }, false);

        canvas.addEventListener('webglcontextrestored', function () {
            lastGpuEvent = 'Context Restored';
            logGpu("✅ WebGL context restored");
            applySettings(null, false);
            setGpuStatus("✅ GPU context pulih.");
        }, false);
    }

    function detectRendererInfo() {
        const pcApp = getPcAppSafe();
        const gd = pcApp ? pcApp.graphicsDevice : null;
        const gl = gd && gd.gl ? gd.gl : null;
        let rendererName = 'WebGL';
        if (gl && typeof gl.getParameter === 'function') {
            try {
                const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (dbgInfo) {
                    rendererName = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || rendererName;
                } else {
                    rendererName = gl.getParameter(gl.RENDERER) || rendererName;
                }
            } catch (e) {}
        }
        return {
            renderer: String(rendererName),
            maxPixelRatio: gd ? gd.maxPixelRatio : currentSettings.maxPixelRatio,
            precision: gd ? gd.precision : currentSettings.precision,
            contextLostCount: contextLostCount,
            lastGpuEvent: lastGpuEvent
        };
    }

    function getInfo() {
        return {
            settings: Object.assign({}, currentSettings),
            presets: Object.keys(PRESETS),
            presetLabels: {
                balanced: PRESETS.balanced.label,
                stability: PRESETS.stability.label,
                quality: PRESETS.quality.label
            },
            device: detectRendererInfo()
        };
    }

    loadSavedSettings();

    let attempts = 0;
    const initTimer = setInterval(function () {
        attempts += 1;
        const pcApp = getPcAppSafe();
        bindContextEvents();
        if (pcApp && pcApp.root) {
            applySettings(null, false);
            clearInterval(initTimer);
        } else if (attempts >= 120) {
            clearInterval(initTimer);
        }
    }, 100);

    window.GpuStability = {
        getInfo: getInfo,
        applySettings: applySettings,
        applyPreset: applyPreset,
        trimGpuMemoryCache: trimGpuMemoryCache
    };

    logGpu("✅ gpu_stability.js loaded");
})();
