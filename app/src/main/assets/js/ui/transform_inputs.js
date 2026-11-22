/* ===== VTuber Forge — js/ui/transform_inputs.js ===== */
// Binding input transformasi (posisi, rotasi, skala) & grid snap

(function () {
    'use strict';

    let snapEnabled = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function setTransformStatus(msg) {
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

    function snapVal(v) {
        return snapEnabled ? Math.round(v * 2) / 2 : v;
    }

    function bindNumericSlider(id, outId, fn, sliderId, sMin, sMax, decimals) {
        const numEl = byId(id);
        const outEl = byId(outId);
        if (!numEl || !outEl || numEl.dataset.vtfBound === '1') return;
        numEl.dataset.vtfBound = '1';

        const dec = (decimals === undefined) ? 2 : decimals;

        const apply = (v, fromSlider) => {
            if (!isFinite(v)) v = 0;
            if (fromSlider) v = Math.max(sMin, Math.min(sMax, v));
            numEl.value = String(v);
            const slEl = sliderId ? byId(sliderId) : null;
            if (slEl) {
                slEl.value = String(Math.max(sMin, Math.min(sMax, v)));
            }
            outEl.textContent = v.toFixed(dec);
            const target = getSelectedTarget();
            if (target) fn(target, v);
        };

        numEl.oninput = () => {
            let raw = parseFloat(numEl.value);
            if (!isFinite(raw)) raw = 0;
            apply(snapVal(raw), false);
        };
        numEl.onchange = () => {
            if (getSelectedTarget()) commitHistorySafe();
        };

        const slEl = sliderId ? byId(sliderId) : null;
        if (slEl) {
            slEl.oninput = () => {
                const v = parseFloat(slEl.value);
                apply(snapVal(v), true);
            };
            slEl.onchange = () => {
                if (getSelectedTarget()) commitHistorySafe();
            };
        }
    }

    function bindAllTransformInputs() {
        document.querySelectorAll('input').forEach((inp) => {
            if (inp.dataset.vtfEnterBound === '1') return;
            inp.dataset.vtfEnterBound = '1';
            const inputType = (inp.getAttribute('type') || 'text').toLowerCase();
            if (inputType === 'range' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'file') {
                return;
            }
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target && typeof e.target.blur === 'function') {
                    e.target.blur();
                }
            });
        });

        const snapToggleBtn = byId('snapToggle');
        if (snapToggleBtn && snapToggleBtn.dataset.vtfBound !== '1') {
            snapToggleBtn.dataset.vtfBound = '1';
            snapToggleBtn.onclick = () => {
                snapEnabled = !snapEnabled;
                snapToggleBtn.classList.toggle('on', snapEnabled);
                setTransformStatus(snapEnabled ? 'Grid Snap: ON (0.5 unit)' : 'Grid Snap: OFF');
            };
        }

        bindNumericSlider('px', 'pxo', (sel, v) => sel.setPosition(v, sel.getPosition().y, sel.getPosition().z), 'pxR', -10, 10, 2);
        bindNumericSlider('py', 'pyo', (sel, v) => sel.setPosition(sel.getPosition().x, v, sel.getPosition().z), 'pyR', -10, 10, 2);
        bindNumericSlider('pz', 'pzo', (sel, v) => sel.setPosition(sel.getPosition().x, sel.getPosition().y, v), 'pzR', -10, 10, 2);

        bindNumericSlider('rx', 'rxo', (sel, v) => {
            sel._animSpin = false;
            sel._animWobble = false;
            if (typeof window.syncMotionButtons === 'function') window.syncMotionButtons(sel);
            sel.setEulerAngles(v, sel.getEulerAngles().y, sel.getEulerAngles().z);
            if (sel._baseRot) sel._baseRot.x = v;
        }, 'rxR', -180, 180, 0);

        bindNumericSlider('ry', 'ryo', (sel, v) => {
            sel._animSpin = false;
            sel._animWobble = false;
            if (typeof window.syncMotionButtons === 'function') window.syncMotionButtons(sel);
            sel.setEulerAngles(sel.getEulerAngles().x, v, sel.getEulerAngles().z);
            if (sel._baseRot) sel._baseRot.y = v;
        }, 'ryR', -180, 180, 0);

        bindNumericSlider('rz', 'rzo', (sel, v) => {
            sel._animSpin = false;
            sel._animWobble = false;
            if (typeof window.syncMotionButtons === 'function') window.syncMotionButtons(sel);
            sel.setEulerAngles(sel.getEulerAngles().x, sel.getEulerAngles().y, v);
            if (sel._baseRot) sel._baseRot.z = v;
        }, 'rzR', -180, 180, 0);

        const scEl = byId('sc');
        const scOut = byId('sco');
        const scREl = byId('scR');
        if (scEl && scOut && scEl.dataset.vtfBound !== '1') {
            scEl.dataset.vtfBound = '1';
            const applyScale = (v, fromSlider) => {
                if (!isFinite(v) || v <= 0) v = 0.01;
                if (fromSlider) v = Math.max(0.1, Math.min(5, v));
                scEl.value = String(v);
                if (scREl) scREl.value = String(Math.max(0.1, Math.min(5, v)));
                scOut.textContent = v.toFixed(2);
                const target = getSelectedTarget();
                if (target) {
                    target.setLocalScale(v, v, v);
                    if (target._baseScale) target._baseScale.set(v, v, v);
                }
            };
            scEl.oninput = () => {
                let raw = parseFloat(scEl.value);
                if (!isFinite(raw)) raw = 1;
                applyScale(raw, false);
            };
            scEl.onchange = () => {
                if (getSelectedTarget()) commitHistorySafe();
            };
            if (scREl) {
                scREl.oninput = () => applyScale(parseFloat(scREl.value), true);
                scREl.onchange = () => {
                    if (getSelectedTarget()) commitHistorySafe();
                };
            }
        }

        if (typeof window.__vtfBindMaterialInputs === 'function') {
            window.__vtfBindMaterialInputs();
        }
    }

    window.__vtfBindTransformInputs = bindAllTransformInputs;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAllTransformInputs);
    } else {
        bindAllTransformInputs();
    }
})();
