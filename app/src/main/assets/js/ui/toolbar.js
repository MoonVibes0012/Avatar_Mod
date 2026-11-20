/* ===== VTuber Forge — js/ui/toolbar.js ===== */
// Toolbar shortcuts, keyboard undo/redo, motion toggles, panel helper sync, & animation clips

(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function setToolbarStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function logToolbar(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getSelectedTarget() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    function syncMotionButtons(entity) {
        const spinBtn = byId('animSpin');
        const pulseBtn = byId('animPulse');
        const wobbleBtn = byId('animWobble');
        if (spinBtn) spinBtn.classList.toggle('on', !!(entity && entity._animSpin));
        if (pulseBtn) pulseBtn.classList.toggle('on', !!(entity && entity._animPulse));
        if (wobbleBtn) wobbleBtn.classList.toggle('on', !!(entity && entity._animWobble));
    }
    window.syncMotionButtons = syncMotionButtons;

    logToolbar("=== ENV: innerWidth=" + window.innerWidth + " innerHeight=" + window.innerHeight + " dpr=" + (window.devicePixelRatio || 1));

    // === TOOLBAR SHORTCUT BINDINGS ===
    if (byId('btnUndo')) {
        byId('btnUndo').onclick = () => {
            if (typeof triggerUndo === 'function') triggerUndo();
            else if (byId('undo')) byId('undo').click();
        };
    }
    if (byId('btnRedo')) {
        byId('btnRedo').onclick = () => {
            if (typeof triggerRedo === 'function') triggerRedo();
            else if (byId('redo')) byId('redo').click();
        };
    }
    if (byId('btnSave')) {
        byId('btnSave').onclick = () => {
            if (typeof triggerSaveScene === 'function') triggerSaveScene();
            else if (byId('save')) byId('save').click();
        };
    }
    if (byId('btnImport')) {
        byId('btnImport').onclick = () => {
            const f = byId('file');
            if (f) f.click();
        };
    }
    if (byId('btnScreenshot')) {
        byId('btnScreenshot').onclick = () => {
            if (typeof takeScreenshot === 'function') takeScreenshot();
            else if (byId('screenshot')) byId('screenshot').click();
        };
    }

    // === MENU FILE: IMPORT + EXPORT VRM (x-vrm) ===
    if (byId('importMenu')) {
        byId('importMenu').onclick = () => {
            const f = byId('file');
            if (f) f.click();
        };
    }
    if (byId('x-vrm')) {
        byId('x-vrm').onclick = () => {
            if (typeof exportVRM === 'function') exportVRM();
            else alert("Fungsi exportVRM tidak ditemukan.\n\nPastikan modul export ter-load.");
        };
    }

    // === KEYBOARD SHORTCUTS ===
    window.addEventListener('keydown', (e) => {
        if (!e.target || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.repeat) return;
        if (e.key === 'z' || e.key === 'Z') {
            if (e.ctrlKey || e.metaKey) e.preventDefault();
            if (typeof triggerUndo === 'function') triggerUndo();
        } else if (e.key === 'y' || e.key === 'Y') {
            if (e.ctrlKey || e.metaKey) e.preventDefault();
            if (typeof triggerRedo === 'function') triggerRedo();
        }
    });

    // === MOTION TOGGLES ===
    if (byId('animSpin')) {
        byId('animSpin').onclick = () => {
            const target = getSelectedTarget();
            if (!target) return alert("Pilih objek dulu!");
            target._animSpin = !target._animSpin;
            if (target._animSpin && !target._baseRot && typeof target.getEulerAngles === 'function') {
                target._baseRot = target.getEulerAngles().clone();
            }
            syncMotionButtons(target);
            if (typeof saveState === 'function') saveState();
            setToolbarStatus("Auto-Spin: " + (target._animSpin ? "ON" : "OFF"));
        };
    }
    if (byId('animPulse')) {
        byId('animPulse').onclick = () => {
            const target = getSelectedTarget();
            if (!target) return alert("Pilih objek dulu!");
            target._animPulse = !target._animPulse;
            if (target._animPulse && !target._baseScale && typeof target.getLocalScale === 'function') {
                target._baseScale = target.getLocalScale().clone();
            }
            syncMotionButtons(target);
            if (typeof saveState === 'function') saveState();
            setToolbarStatus("Idle Pulse: " + (target._animPulse ? "ON" : "OFF"));
        };
    }
    if (byId('animWobble')) {
        byId('animWobble').onclick = () => {
            const target = getSelectedTarget();
            if (!target) return alert("Pilih objek dulu!");
            target._animWobble = !target._animWobble;
            if (target._animWobble && !target._baseRot && typeof target.getEulerAngles === 'function') {
                target._baseRot = target.getEulerAngles().clone();
            }
            syncMotionButtons(target);
            if (typeof saveState === 'function') saveState();
            setToolbarStatus("Spring Wobble: " + (target._animWobble ? "ON" : "OFF"));
        };
    }

    document.addEventListener('click', (e) => {
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('#tree')) {
            setTimeout(() => {
                syncMotionButtons(getSelectedTarget());
            }, 0);
        }
    });

    // === PANEL CONTROLS (delegasi tunggal via boot.js) ===
    function closeSidePanel(panelId) {
        if (typeof window.__vtfSetPanel === 'function') {
            window.__vtfSetPanel(panelId, false);
            return;
        }
        const panel = byId(panelId);
        if (!panel) return;
        panel.classList.remove('mobile-open');
        panel.style.removeProperty('display');
    }
    window.closeSidePanel = closeSidePanel;

    function toggleSidePanel(panelId) {
        if (typeof window.__vtfTogglePanel === 'function') {
            window.__vtfTogglePanel(panelId);
            return;
        }
        const panel = byId(panelId);
        if (!panel) return;
        const isOpen = panel.classList.contains('mobile-open');
        const otherId = panelId === 'left' ? 'right' : 'left';
        closeSidePanel(otherId);
        if (isOpen) {
            closeSidePanel(panelId);
        } else {
            panel.style.removeProperty('display');
            panel.classList.add('mobile-open');
            panel.scrollTop = 0;
        }
    }
    window.toggleSidePanel = toggleSidePanel;

    // === ANIMATION CLIP CONTROLS ===
    if (byId('animSelect')) {
        byId('animSelect').onchange = (e) => {
            const target = getSelectedTarget();
            if (!target || !Array.isArray(target._animAssets)) return;
            const idx = parseInt(e.target.value, 10);
            if (isNaN(idx) || idx < 0 || idx >= target._animAssets.length) return;
            if (!target.animation) target.addComponent('animation');
            target.animation.asset = target._animAssets[idx];
            target.animation.loop = true;
            const animName = (Array.isArray(target._animNames) && target._animNames[idx]) ? target._animNames[idx] : `Anim_${idx}`;
            setToolbarStatus("Animasi siap: " + animName);
        };
    }
    if (byId('animPlay')) {
        byId('animPlay').onclick = () => {
            const target = getSelectedTarget();
            if (target && target.animation && target.animation.asset) {
                target.animation.play();
                setToolbarStatus("▶ Playing: " + (target.animation.asset.name || "Clip"));
            }
        };
    }
    if (byId('animPause')) {
        byId('animPause').onclick = () => {
            const target = getSelectedTarget();
            if (target && target.animation) {
                target.animation.pause();
                setToolbarStatus("⏸ Paused");
            }
        };
    }
    if (byId('animStop')) {
        byId('animStop').onclick = () => {
            const target = getSelectedTarget();
            if (target && target.animation) {
                target.animation.stop();
                setToolbarStatus("⏹ Stopped");
            }
        };
    }

    logToolbar("=== toolbar.js DONE ===");
})();
