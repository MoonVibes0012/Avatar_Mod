/* ===== VTuber Forge — js/anatomy/anatomy_touch_hud.js ===== */
// Interaksi sentuh & kontrol Floating Touch HUD Anatomi (sinkronisasi event-driven tanpa polling)

(function () {
    'use strict';

    let hudVisible = true;
    let padDragging = false;
    let activePadPointerId = null;
    let lastX = 0;
    let lastY = 0;

    function getActiveCameraEntity() {
        let pcApp = null;
        if (typeof window.getPcApp === 'function') {
            pcApp = window.getPcApp();
        } else if (typeof window.app !== 'undefined' && window.app) {
            pcApp = window.app;
        }
        if (!pcApp || !pcApp.root) return null;
        return pcApp.root.findByName('camera') || null;
    }

    function commitHistorySafe() {
        if (typeof window.saveState === 'function') {
            try { window.saveState(); } catch (e) {}
            return;
        }
        try {
            if (typeof saveState === 'function') saveState();
        } catch (e) {}
    }

    function syncHudState() {
        if (!window.AnatomyTouchHudView) return;
        window.AnatomyTouchHudView.ensureElement();

        const partId = (window.AnatomySolver && typeof window.AnatomySolver.getSelectedPart === 'function')
            ? window.AnatomySolver.getSelectedPart()
            : null;
        const sphereEnabled = !!(window.AnatomySelectionSphere && typeof window.AnatomySelectionSphere.isEnabled === 'function' && window.AnatomySelectionSphere.isEnabled());
        const dragMode = (window.AnatomySelectionSphere && typeof window.AnatomySelectionSphere.getDragMode === 'function')
            ? window.AnatomySelectionSphere.getDragMode()
            : 'rotate';
        const mirror = !!(window.AnatomySolver && typeof window.AnatomySolver.isMirrorEnabled === 'function' && window.AnatomySolver.isMirrorEnabled());

        window.AnatomyTouchHudView.update({
            visible: hudVisible && sphereEnabled,
            hasPart: !!partId,
            partId: partId,
            dragMode: dragMode,
            mirror: mirror
        });
    }

    function bindHudEvents() {
        if (!window.AnatomyTouchHudView) return;
        window.AnatomyTouchHudView.ensureElement();

        const hideBtn = document.getElementById('anatHudHideBtn');
        if (hideBtn && hideBtn.dataset.vtfHudBound !== '1') {
            hideBtn.dataset.vtfHudBound = '1';
            hideBtn.onclick = function () {
                hudVisible = false;
                syncHudState();
            };
        }

        const modeBtn = document.getElementById('anatHudModeBtn');
        if (modeBtn && modeBtn.dataset.vtfHudBound !== '1') {
            modeBtn.dataset.vtfHudBound = '1';
            modeBtn.onclick = function () {
                if (!window.AnatomySelectionSphere) return;
                const cur = window.AnatomySelectionSphere.getDragMode();
                window.AnatomySelectionSphere.setDragMode(cur === 'translate' ? 'rotate' : 'translate');
                syncHudState();
            };
        }

        const mirBtn = document.getElementById('anatHudMirrorBtn');
        if (mirBtn && mirBtn.dataset.vtfHudBound !== '1') {
            mirBtn.dataset.vtfHudBound = '1';
            mirBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.setMirrorEnabled(!window.AnatomySolver.isMirrorEnabled());
                syncHudState();
            };
        }

        const resetBtn = document.getElementById('anatHudResetBtn');
        if (resetBtn && resetBtn.dataset.vtfHudBound !== '1') {
            resetBtn.dataset.vtfHudBound = '1';
            resetBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.resetSelectedPart();
                commitHistorySafe();
                syncHudState();
            };
        }

        const pad = document.getElementById('anatHudPad');
        if (pad && pad.dataset.vtfHudBound !== '1') {
            pad.dataset.vtfHudBound = '1';

            pad.addEventListener('pointerdown', function (e) {
                if (!window.AnatomySolver || !window.AnatomySelectionSphere) return;
                const partId = window.AnatomySolver.getSelectedPart();
                if (!partId) return;
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                padDragging = true;
                activePadPointerId = (typeof e.pointerId === 'number') ? e.pointerId : null;
                lastX = e.clientX;
                lastY = e.clientY;
                window.__vtfAnatomyDragging = true;

                const camEnt = getActiveCameraEntity();
                if (camEnt) camEnt._orbitLocked = true;
                if (typeof pad.setPointerCapture === 'function' && activePadPointerId !== null) {
                    try { pad.setPointerCapture(activePadPointerId); } catch (err) {}
                }
            });

            pad.addEventListener('pointermove', function (e) {
                if (!padDragging || !window.AnatomySolver || !window.AnatomySelectionSphere) return;
                if (activePadPointerId !== null && typeof e.pointerId === 'number' && e.pointerId !== activePadPointerId) {
                    return;
                }
                const partId = window.AnatomySolver.getSelectedPart();
                if (!partId) return;
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;

                const mode = window.AnatomySelectionSphere.getDragMode();
                const camEnt = getActiveCameraEntity();
                window.AnatomySolver.handleDragMove(partId, mode, dx * 1.2, dy * 1.2, camEnt);
            });

            const finishPadDrag = function (e) {
                if (!padDragging) return;
                if (activePadPointerId !== null && e && typeof e.pointerId === 'number' && e.pointerId !== activePadPointerId) {
                    return;
                }
                padDragging = false;
                activePadPointerId = null;
                window.__vtfAnatomyDragging = false;
                const camEnt = getActiveCameraEntity();
                if (camEnt && camEnt._orbitLocked !== undefined) {
                    try { delete camEnt._orbitLocked; } catch (err) { camEnt._orbitLocked = false; }
                }
                commitHistorySafe();
                syncHudState();
            };

            pad.addEventListener('pointerup', finishPadDrag);
            pad.addEventListener('pointercancel', finishPadDrag);
        }
    }

    function hookAnatomyCallbacks() {
        const prevSelected = window.__vtfOnAnatomyPartSelected;
        if (!prevSelected || !prevSelected.__vtfHudWrapped) {
            const wrappedSelected = function (partId, mode) {
                hudVisible = true;
                bindHudEvents();
                if (typeof prevSelected === 'function') prevSelected.apply(this, arguments);
                syncHudState();
            };
            wrappedSelected.__vtfHudWrapped = true;
            window.__vtfOnAnatomyPartSelected = wrappedSelected;
        }

        const prevModeChanged = window.__vtfOnAnatomyModeChanged;
        if (!prevModeChanged || !prevModeChanged.__vtfHudWrapped) {
            const wrappedMode = function (mode) {
                if (typeof prevModeChanged === 'function') prevModeChanged.apply(this, arguments);
                syncHudState();
            };
            wrappedMode.__vtfHudWrapped = true;
            window.__vtfOnAnatomyModeChanged = wrappedMode;
        }

        const prevDragEnd = window.__vtfOnAnatomyDragEnd;
        if (!prevDragEnd || !prevDragEnd.__vtfHudWrapped) {
            const wrappedDragEnd = function (partId, mode) {
                if (typeof prevDragEnd === 'function') prevDragEnd.apply(this, arguments);
                syncHudState();
            };
            wrappedDragEnd.__vtfHudWrapped = true;
            window.__vtfOnAnatomyDragEnd = wrappedDragEnd;
        }

        const prevSelChanged = window.__vtfOnAnatomySelectionChanged;
        if (!prevSelChanged || !prevSelChanged.__vtfHudWrapped) {
            const wrappedSelChanged = function () {
                if (typeof prevSelChanged === 'function') prevSelChanged.apply(this, arguments);
                syncHudState();
            };
            wrappedSelChanged.__vtfHudWrapped = true;
            window.__vtfOnAnatomySelectionChanged = wrappedSelChanged;
        }
    }

    if (!window.__vtfAnatomyHudUiHookBound) {
        window.__vtfAnatomyHudUiHookBound = true;
        document.addEventListener('click', function (e) {
            if (!e || !e.target || typeof e.target.closest !== 'function') return;
            if (e.target.closest('#anatomySectionCard, #tree, [data-add], #btnNew, #del')) {
                setTimeout(syncHudState, 0);
            }
        });
    }

    function initHud() {
        bindHudEvents();
        hookAnatomyCallbacks();
        syncHudState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHud);
    } else {
        initHud();
    }

    window.AnatomyTouchHud = {
        setVisible: function (v) {
            hudVisible = !!v;
            bindHudEvents();
            syncHudState();
        },
        sync: function () {
            bindHudEvents();
            syncHudState();
        },
        destroy: function () {
            padDragging = false;
            activePadPointerId = null;
            window.__vtfAnatomyDragging = false;
            if (window.AnatomyTouchHudView) {
                window.AnatomyTouchHudView.destroy();
            }
        }
    };
})();
