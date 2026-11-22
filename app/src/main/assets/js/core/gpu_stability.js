/* ===== VTuber Forge — js/core/gpu_stability.js ===== */
// Pengaturan preset & stabilitas GPU (Balanced, Stability, Quality) + integrasi context recovery

(function () {
    'use strict';

    const STORAGE_KEY = 'vtuber_forge_gpu_settings_v1';

    const PRESETS = {
        balanced: {
            preset: 'balanced',
            maxPixelRatio: 1.5,
            precision: 'mediump',
            ambientIntensity: 0.65,
            shadowsEnabled: false,
            autoRecoverContext: true
        },
        stability: {
            preset: 'stability',
            maxPixelRatio: 1.0,
            precision: 'mediump',
            ambientIntensity: 0.72,
            shadowsEnabled: false,
            autoRecoverContext: true
        },
        quality: {
            preset: 'quality',
            maxPixelRatio: 2.0,
            precision: 'highp',
            ambientIntensity: 0.60,
            shadowsEnabled: true,
            autoRecoverContext: true
        }
    };

    let currentSettings = Object.assign({}, PRESETS.balanced);

    function getAppSafe() {
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
            if (parsed && typeof parsed === 'object') {
                currentSettings = Object.assign({}, PRESETS.balanced, parsed);
            }
        } catch (e) {}
    }

    function persistSettings(saveToStorage) {
        if (!saveToStorage) return;
        try {
            if (!window.localStorage) return;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
        } catch (e) {}
    }

    function applyToScene() {
        const pcApp = getAppSafe();
        const recovery = window.VtfGpuContextRecovery;
        const dev = recovery ? recovery.getDeviceState() : null;

        if (pcApp && pcApp.graphicsDevice) {
            const gd = pcApp.graphicsDevice;
            const nativeDpr = window.devicePixelRatio || 1;
            const cap = Number(currentSettings.maxPixelRatio) || 1.5;
            gd.maxPixelRatio = Math.max(0.5, Math.min(nativeDpr, cap));

            const desiredPrec = (currentSettings.precision === 'highp') ? 'highp' : 'mediump';
            if (dev) {
                dev.precisionNeedsReload = (gd.precision && gd.precision !== desiredPrec);
            }

            if (typeof pcApp.resizeCanvas === 'function') {
                try { pcApp.resizeCanvas(); } catch (e) {}
            }
        }

        if (pcApp && pcApp.scene) {
            const amb = Number(currentSettings.ambientIntensity);
            if (!isNaN(amb) && pcApp.scene.ambientLight) {
                pcApp.scene.ambientLight.set(amb, amb, amb);
            }
            if (pcApp.root && typeof pcApp.root.findComponents === 'function') {
                const lights = pcApp.root.findComponents('light');
                for (let i = 0; i < lights.length; i++) {
                    const l = lights[i];
                    if (l && l.type === 'directional') {
                        l.castShadows = !!currentSettings.shadowsEnabled;
                    }
                }
            }
        }

        if (recovery) {
            recovery.detectDeviceInfo(currentSettings);
            recovery.bindContextEvents(
                function () { return currentSettings; },
                function () { applyToScene(); }
            );
        }

        if (typeof window.__vtfOnGpuSettingsUpdated === 'function') {
            try { window.__vtfOnGpuSettingsUpdated(); } catch (e) {}
        }
    }

    function applyPreset(presetName, saveToStorage) {
        const p = PRESETS[presetName] || PRESETS.balanced;
        currentSettings = Object.assign({}, currentSettings, p);
        persistSettings(!!saveToStorage);
        applyToScene();
    }

    function applySettings(partial, saveToStorage) {
        if (!partial || typeof partial !== 'object') return;
        currentSettings = Object.assign({}, currentSettings, partial);
        if (!partial.preset) {
            currentSettings.preset = 'balanced';
        }
        persistSettings(!!saveToStorage);
        applyToScene();
    }

    function trimGpuMemoryCache() {
        if (window.VtfGpuContextRecovery && typeof window.VtfGpuContextRecovery.trimGpuMemoryCache === 'function') {
            return window.VtfGpuContextRecovery.trimGpuMemoryCache(currentSettings);
        }
        return 0;
    }

    function getInfo() {
        const dev = window.VtfGpuContextRecovery
            ? window.VtfGpuContextRecovery.detectDeviceInfo(currentSettings)
            : { renderer: 'WebGL', contextLostCount: 0, lastGpuEvent: 'Normal' };
        return {
            settings: Object.assign({}, currentSettings),
            device: Object.assign({}, dev)
        };
    }

    window.GpuStability = {
        PRESETS: PRESETS,
        applyPreset: applyPreset,
        applySettings: applySettings,
        applyToScene: applyToScene,
        trimGpuMemoryCache: trimGpuMemoryCache,
        getInfo: getInfo
    };

    loadSavedSettings();

    function trySyncInitial() {
        if (!getAppSafe()) return false;
        applyToScene();
        return true;
    }

    if (!trySyncInitial()) {
        let tries = 0;
        const t = setInterval(function () {
            tries++;
            if (trySyncInitial() || tries > 120) clearInterval(t);
        }, 100);
    }
})();
