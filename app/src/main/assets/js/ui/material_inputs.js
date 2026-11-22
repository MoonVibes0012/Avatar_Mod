/* ===== VTuber Forge — js/ui/material_inputs.js ===== */
// Binding kontrol material (Color, Gloss, Metalness, Tex Scale) pada objek terpilih

(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
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

    function forEachSelectedMaterial(callback) {
        const target = getSelectedTarget();
        if (!target || typeof target.findComponents !== 'function') return;
        target.findComponents('render').forEach((comp) => {
            if (!comp || !comp.meshInstances) return;
            comp.meshInstances.forEach((mi) => {
                if (mi && mi.material) {
                    const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                    mats.forEach((m) => { if (m) callback(m); });
                }
            });
        });
    }

    function bindMaterialInputs() {
        const texScaleEl = byId('texScale');
        if (texScaleEl && texScaleEl.dataset.vtfMatBound !== '1') {
            texScaleEl.dataset.vtfMatBound = '1';
            texScaleEl.oninput = (e) => {
                const val = parseFloat(e.target.value);
                const out = byId('texScaleOut');
                if (out) out.textContent = e.target.value;
                if (!isNaN(val) && val > 0) {
                    forEachSelectedMaterial((m) => {
                        if (m.diffuseMap && typeof m.diffuseMap.setTiling === 'function') {
                            try { m.diffuseMap.setTiling(val, val); } catch (err) {}
                        }
                    });
                }
            };
            texScaleEl.onchange = () => {
                if (getSelectedTarget()) commitHistorySafe();
            };
        }

        const colorEl = byId('color');
        if (colorEl && colorEl.dataset.vtfMatBound !== '1') {
            colorEl.dataset.vtfMatBound = '1';
            colorEl.oninput = (e) => {
                const rgb = parseHexToRgb01(e.target.value);
                if (!rgb) return;
                forEachSelectedMaterial((m) => {
                    m.diffuse = new pc.Color(rgb.r, rgb.g, rgb.b);
                });
            };
            colorEl.onchange = () => {
                forEachSelectedMaterial((m) => {
                    if (typeof m.update === 'function') m.update();
                });
                if (getSelectedTarget()) commitHistorySafe();
            };
        }

        const roughEl = byId('rough');
        if (roughEl && roughEl.dataset.vtfMatBound !== '1') {
            roughEl.dataset.vtfMatBound = '1';
            roughEl.oninput = (e) => {
                const v = parseFloat(e.target.value);
                const out = byId('rougho');
                if (out && !isNaN(v)) out.textContent = v.toFixed(2);
                if (!isNaN(v)) {
                    forEachSelectedMaterial((m) => {
                        m.gloss = v;
                        if (typeof m.update === 'function') m.update();
                    });
                }
            };
            roughEl.onchange = () => {
                if (getSelectedTarget()) commitHistorySafe();
            };
        }

        const metalEl = byId('metal');
        if (metalEl && metalEl.dataset.vtfMatBound !== '1') {
            metalEl.dataset.vtfMatBound = '1';
            metalEl.oninput = (e) => {
                const v = parseFloat(e.target.value);
                const out = byId('meto');
                if (out && !isNaN(v)) out.textContent = v.toFixed(2);
                if (!isNaN(v)) {
                    forEachSelectedMaterial((m) => {
                        m.metalness = v;
                        if (typeof m.update === 'function') m.update();
                    });
                }
            };
            metalEl.onchange = () => {
                if (getSelectedTarget()) commitHistorySafe();
            };
        }
    }

    window.__vtfBindMaterialInputs = bindMaterialInputs;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindMaterialInputs);
    } else {
        bindMaterialInputs();
    }
})();
