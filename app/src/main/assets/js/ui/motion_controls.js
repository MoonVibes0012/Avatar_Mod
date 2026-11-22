/* ===== VTuber Forge — js/ui/motion_controls.js ===== */
// Kontrol motion prosedural (Spin, Pulse, Wobble) & pemutaran animation clip

(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function setMotionStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function getSelectedTarget() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
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

    function syncMotionButtons(entity) {
        const target = entity !== undefined ? entity : getSelectedTarget();
        const spinBtn = byId('animSpin');
        const pulseBtn = byId('animPulse');
        const wobbleBtn = byId('animWobble');
        if (spinBtn) spinBtn.classList.toggle('on', !!(target && target._animSpin));
        if (pulseBtn) pulseBtn.classList.toggle('on', !!(target && target._animPulse));
        if (wobbleBtn) wobbleBtn.classList.toggle('on', !!(target && target._animWobble));
    }
    window.syncMotionButtons = syncMotionButtons;

    function bindOnce(el, handler) {
        if (!el || el.dataset.vtfMotionBound === '1') return;
        el.dataset.vtfMotionBound = '1';
        el.onclick = handler;
    }

    function bindMotionControls() {
        bindOnce(byId('animSpin'), () => {
            const target = getSelectedTarget();
            if (!target) return setMotionStatus('⚠ Pilih objek dulu untuk Auto-Spin.');
            target._animSpin = !target._animSpin;
            if (target._animSpin && !target._baseRot && typeof target.getEulerAngles === 'function') {
                target._baseRot = target.getEulerAngles().clone();
            }
            syncMotionButtons(target);
            commitHistorySafe();
            setMotionStatus('Auto-Spin: ' + (target._animSpin ? 'ON' : 'OFF'));
        });

        bindOnce(byId('animPulse'), () => {
            const target = getSelectedTarget();
            if (!target) return setMotionStatus('⚠ Pilih objek dulu untuk Idle Pulse.');
            target._animPulse = !target._animPulse;
            if (target._animPulse && !target._baseScale && typeof target.getLocalScale === 'function') {
                target._baseScale = target.getLocalScale().clone();
            }
            syncMotionButtons(target);
            commitHistorySafe();
            setMotionStatus('Idle Pulse: ' + (target._animPulse ? 'ON' : 'OFF'));
        });

        bindOnce(byId('animWobble'), () => {
            const target = getSelectedTarget();
            if (!target) return setMotionStatus('⚠ Pilih objek dulu untuk Spring Wobble.');
            target._animWobble = !target._animWobble;
            if (target._animWobble && !target._baseRot && typeof target.getEulerAngles === 'function') {
                target._baseRot = target.getEulerAngles().clone();
            }
            syncMotionButtons(target);
            commitHistorySafe();
            setMotionStatus('Spring Wobble: ' + (target._animWobble ? 'ON' : 'OFF'));
        });

        const animSel = byId('animSelect');
        if (animSel && animSel.dataset.vtfMotionBound !== '1') {
            animSel.dataset.vtfMotionBound = '1';
            animSel.onchange = (e) => {
                const target = getSelectedTarget();
                if (!target || !Array.isArray(target._animAssets)) return;
                const idx = parseInt(e.target.value, 10);
                if (isNaN(idx) || idx < 0 || idx >= target._animAssets.length) return;
                if (!target.animation) target.addComponent('animation');
                target.animation.asset = target._animAssets[idx];
                target.animation.loop = true;
                const animName = (Array.isArray(target._animNames) && target._animNames[idx])
                    ? target._animNames[idx]
                    : `Anim_${idx}`;
                setMotionStatus('Animasi siap: ' + animName);
            };
        }

        bindOnce(byId('animPlay'), () => {
            const target = getSelectedTarget();
            if (target && target.animation && target.animation.asset) {
                target.animation.play();
                setMotionStatus('▶ Playing: ' + (target.animation.asset.name || 'Clip'));
            }
        });

        bindOnce(byId('animPause'), () => {
            const target = getSelectedTarget();
            if (target && target.animation) {
                target.animation.pause();
                setMotionStatus('⏸ Paused');
            }
        });

        bindOnce(byId('animStop'), () => {
            const target = getSelectedTarget();
            if (target && target.animation) {
                target.animation.stop();
                setMotionStatus('⏹ Stopped');
            }
        });
    }

    window.__vtfBindMotionControls = bindMotionControls;

    if (!window.__vtfMotionTreeSyncBound) {
        window.__vtfMotionTreeSyncBound = true;
        document.addEventListener('click', (e) => {
            if (e.target && typeof e.target.closest === 'function' && e.target.closest('#tree')) {
                setTimeout(() => {
                    syncMotionButtons(getSelectedTarget());
                }, 0);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindMotionControls);
    } else {
        bindMotionControls();
    }
})();
