/* ===== VTuber Forge — js/ui/transform_inputs.js ===== */
// Binding input transformasi (posisi, rotasi, skala), grid snap, dan properti material

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

    function snapVal(v) {
        return snapEnabled ? Math.round(v * 2) / 2 : v;
    }

    function parseHexToRgb01(hex) {
        if (typeof hex !== 'string') return null;
        const clean = hex.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(clean)) return null;
        return {
            r: parseInt(clean.slice(1, 3), 16) / 255,
            g: parseInt(clean.slice(3, 5), 16) / 255,
            b: parseInt(clean.slice(5, 7), 16) / 255
        };
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
            if (getSelectedTarget() && typeof saveState === 'function') saveState();
        };

        const slEl = sliderId ? byId(sliderId) : null;
        if (slEl) {
            slEl.oninput = () => {
                const v = parseFloat(slEl.value);
                apply(snapVal(v), true);
            };
            slEl.onchange = () => {
                if (getSelectedTarget() && typeof saveState === 'function') saveState();
            };
        }
    }

    function forEachSelectedMaterial(callback) {
        const target = getSelectedTarget();
        if (!target || typeof target.findComponents !== 'function') return;
        target.findComponents('render').forEach(comp => {
            if (!comp || !comp.meshInstances) return;
            comp.meshInstances.forEach(mi => {
                if (mi && mi.material) {
                    const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                    mats.forEach(m => { if (m) callback(m); });
                }
            });
        });
    }

    function bindAllTransformInputs() {
        document.querySelectorAll('input').forEach(inp => {
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

        const texScaleEl = byId('texScale');
        if (texScaleEl && texScaleEl.dataset.vtfBound !== '1') {
            texScaleEl.dataset.vtfBound = '1';
            texScaleEl.oninput = (e) => {
                const out = byId('texScaleOut');
                if (out) out.textContent = e.target.value;
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
                if (getSelectedTarget() && typeof saveState === 'function') saveState();
            };
            if (scREl) {
                scREl.oninput = () => applyScale(parseFloat(scREl.value), true);
                scREl.onchange = () => {
                    if (getSelectedTarget() && typeof saveState === 'function') saveState();
                };
            }
        }

        const colorEl = byId('color');
        if (colorEl && colorEl.dataset.vtfBound !== '1') {
            colorEl.dataset.vtfBound = '1';
            colorEl.oninput = (e) => {
                const rgb = parseHexToRgb01(e.target.value);
                if (!rgb) return;
                forEachSelectedMaterial(m => {
                    m.diffuse = new pc.Color(rgb.r, rgb.g, rgb.b);
                });
            };
            colorEl.onchange = () => {
                forEachSelectedMaterial(m => {
                    if (typeof m.update === 'function') m.update();
                });
                if (typeof saveState === 'function') saveState();
            };
        }

        const roughEl = byId('rough');
        if (roughEl && roughEl.dataset.vtfBound !== '1') {
            roughEl.dataset.vtfBound = '1';
            roughEl.oninput = (e) => {
                const v = parseFloat(e.target.value);
                const out = byId('rougho');
                if (out && !isNaN(v)) out.textContent = v.toFixed(2);
                if (!isNaN(v)) {
                    forEachSelectedMaterial(m => {
                        m.gloss = v;
                        if (typeof m.update === 'function') m.update();
                    });
                }
            };
            roughEl.onchange = () => {
                if (typeof saveState === 'function') saveState();
            };
        }

        const metalEl = byId('metal');
        if (metalEl && metalEl.dataset.vtfBound !== '1') {
            metalEl.dataset.vtfBound = '1';
            metalEl.oninput = (e) => {
                const v = parseFloat(e.target.value);
                const out = byId('meto');
                if (out && !isNaN(v)) out.textContent = v.toFixed(2);
                if (!isNaN(v)) {
                    forEachSelectedMaterial(m => {
                        m.metalness = v;
                        if (typeof m.update === 'function') m.update();
                    });
                }
            };
            metalEl.onchange = () => {
                if (typeof saveState === 'function') saveState();
            };
        }
    }

    window.__vtfBindTransformInputs = bindAllTransformInputs;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAllTransformInputs);
    } else {
        bindAllTransformInputs();
    }
})();
