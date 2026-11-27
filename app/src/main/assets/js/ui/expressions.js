/* ===== VTuber Forge — js/ui/expressions.js ===== */
// Blendshape / Facial Expressions Preset & Custom Expressions (Mendukung Multi-Mesh MorphInstance & Metadata VRM 0.x / 1.0)

(function () {
    'use strict';

    const EXPRESSION_PRESETS = {
        neutral:   { label: '😐 Neutral',   vrmKeys: ['neutral'], keywords: [] },
        happy:     { label: '😊 Happy',     vrmKeys: ['happy', 'joy', 'fun', 'smile'], keywords: ['joy', 'happy', 'smile', 'fun'] },
        angry:     { label: '😠 Angry',     vrmKeys: ['angry', 'anger'], keywords: ['angry', 'anger', 'frown'] },
        sad:       { label: '😢 Sad',       vrmKeys: ['sad', 'sorrow'], keywords: ['sad', 'sorrow'] },
        surprised: { label: '😮 Surprised', vrmKeys: ['surprised', 'surprise', 'oh'], keywords: ['surprised', 'surprise', 'oh'] },
        blink:     { label: '😉 Blink',     vrmKeys: ['blink', 'blinkLeft', 'blinkRight'], keywords: ['blink', 'eye_close', 'eyeclose'] }
    };

    let customExpressions = {};
    let activePresetKey = null;

    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            return null;
        }
    }

    function setExprStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function logExpr(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getSelectedModel() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) return window.S.selected;
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    function getModelMorphSlots(entity) {
        if (!entity) return [];
        if (Array.isArray(entity._morphSlots) && entity._morphSlots.length > 0) {
            return entity._morphSlots;
        }
        if (entity._morphInstance && Array.isArray(entity._morphNames)) {
            return entity._morphNames.map((n, idx) => ({
                morphInstance: entity._morphInstance,
                targetIndex: idx,
                targetName: n,
                displayName: n
            }));
        }
        return [];
    }

    function updateExprButtonState(presetKey) {
        activePresetKey = presetKey || null;
        document.querySelectorAll('.expr-btn[data-expr]').forEach(btn => {
            const key = btn.getAttribute('data-expr');
            btn.classList.toggle('active', !!activePresetKey && key === activePresetKey);
        });
    }
    window.updateExprButtonState = updateExprButtonState;

    function syncMorphSliderUI(slotIdx, weight) {
        const clamped = Math.max(0, Math.min(1, Number(weight) || 0));
        const slider = document.querySelector('#morphControls input[data-morph-idx="' + slotIdx + '"]');
        if (slider) slider.value = clamped.toFixed(2);
        const label = byId('morphVal_' + slotIdx);
        if (label) label.textContent = clamped.toFixed(2);
    }

    function syncAllSlidersFromInstances(entity) {
        const slots = getModelMorphSlots(entity);
        slots.forEach((slot, sIdx) => {
            try {
                const w = (slot.morphInstance && typeof slot.morphInstance.getWeight === 'function')
                    ? Number(slot.morphInstance.getWeight(slot.targetIndex))
                    : 0;
                syncMorphSliderUI(sIdx, isFinite(w) ? w : 0);
            } catch (e) {}
        });
    }

    function resetAllMorphWeights(entity) {
        const slots = getModelMorphSlots(entity);
        slots.forEach((slot, sIdx) => {
            try {
                if (slot.morphInstance && typeof slot.morphInstance.setWeight === 'function') {
                    slot.morphInstance.setWeight(slot.targetIndex, 0);
                }
                syncMorphSliderUI(sIdx, 0);
            } catch (e) {}
        });
    }

    function applyExpressionPreset(presetKey) {
        const selected = getSelectedModel();
        if (!selected) {
            setExprStatus("⚠ Pilih model dulu sebelum menerapkan ekspresi!");
            return;
        }

        const slots = getModelMorphSlots(selected);
        const vrmExprMap = (selected._vrmExpressions && typeof selected._vrmExpressions === 'object')
            ? selected._vrmExpressions
            : {};

        if (slots.length === 0 && Object.keys(vrmExprMap).length === 0) {
            setExprStatus("⚠ Model ini tidak memiliki blendshape / ekspresi VRM.");
            return;
        }

        const preset = EXPRESSION_PRESETS[presetKey];
        if (!preset) return;

        resetAllMorphWeights(selected);

        if (presetKey === 'neutral') {
            if (vrmExprMap.neutral && Array.isArray(vrmExprMap.neutral.binds)) {
                vrmExprMap.neutral.binds.forEach((b) => {
                    try {
                        if (b.morphInstance && typeof b.morphInstance.setWeight === 'function') {
                            b.morphInstance.setWeight(b.targetIndex, b.weight !== undefined ? b.weight : 1.0);
                        }
                    } catch (e) {}
                });
                syncAllSlidersFromInstances(selected);
            }
            updateExprButtonState('neutral');
            setExprStatus("Ekspresi: Neutral");
            return;
        }

        let matchedCount = 0;

        // Prioritas 1: Binding metadata ekspresi VRM 0.x (blendShapeMaster) / VRM 1.0 (expressions)
        const vrmKeys = Array.isArray(preset.vrmKeys) ? preset.vrmKeys : [presetKey];
        for (let k = 0; k < vrmKeys.length; k++) {
            const vk = vrmKeys[k];
            const exprDef = vrmExprMap[vk];
            if (exprDef && Array.isArray(exprDef.binds) && exprDef.binds.length > 0) {
                exprDef.binds.forEach((b) => {
                    try {
                        if (b.morphInstance && typeof b.morphInstance.setWeight === 'function') {
                            b.morphInstance.setWeight(b.targetIndex, b.weight !== undefined ? b.weight : 1.0);
                            matchedCount++;
                        }
                    } catch (e) {}
                });
            }
        }

        // Prioritas 2: Fallback pencocokan nama target di seluruh mesh jika metadata VRM tidak tersedia
        if (matchedCount === 0 && Array.isArray(preset.keywords) && preset.keywords.length > 0) {
            slots.forEach((slot) => {
                const lower = String(slot.targetName || '').toLowerCase();
                if (lower.startsWith('shape_')) return;
                const isMatch = preset.keywords.some(kw => lower.includes(kw));
                if (isMatch && slot.morphInstance && typeof slot.morphInstance.setWeight === 'function') {
                    try {
                        slot.morphInstance.setWeight(slot.targetIndex, 1.0);
                        matchedCount++;
                    } catch (e) {}
                }
            });
        }

        syncAllSlidersFromInstances(selected);
        updateExprButtonState(presetKey);

        if (matchedCount > 0) {
            setExprStatus("Ekspresi " + preset.label + " diterapkan (" + matchedCount + " binding)");
        } else {
            setExprStatus("Ekspresi '" + presetKey + "' tidak terpetakan pada model ini.");
        }
    }

    function renderCustomExpressions() {
        const listEl = byId('customExprList');
        if (!listEl) return;

        const keys = Object.keys(customExpressions);
        if (keys.length === 0) {
            listEl.innerHTML = '';
            return;
        }

        const safeEscape = (typeof window.escapeHtml === 'function')
            ? window.escapeHtml
            : (s => String(s || '').replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c])));

        listEl.innerHTML = keys.map(name =>
            `<button type="button" data-custom-expr="${safeEscape(name)}">★ ${safeEscape(name)}</button>`
        ).join('');

        listEl.querySelectorAll('button[data-custom-expr]').forEach(btn => {
            btn.onclick = () => {
                const name = btn.getAttribute('data-custom-expr');
                const weights = customExpressions[name];
                const selected = getSelectedModel();
                const slots = getModelMorphSlots(selected);
                if (!selected || slots.length === 0 || !Array.isArray(weights)) return;

                resetAllMorphWeights(selected);
                weights.forEach((w, idx) => {
                    const slot = slots[idx];
                    if (!slot || !slot.morphInstance) return;
                    const num = Math.max(0, Math.min(1, Number(w) || 0));
                    try {
                        if (typeof slot.morphInstance.setWeight === 'function') {
                            slot.morphInstance.setWeight(slot.targetIndex, num);
                        }
                        syncMorphSliderUI(idx, num);
                    } catch (e) {}
                });
                updateExprButtonState(null);
                setExprStatus("Ekspresi custom diterapkan: " + name);
            };
        });
    }

    function saveCustomExpression() {
        const selected = getSelectedModel();
        const slots = getModelMorphSlots(selected);
        if (!selected || slots.length === 0) {
            setExprStatus("⚠ Pilih model yang memiliki morph targets dulu!");
            return;
        }

        const nameInput = byId('customExprName');
        const rawName = nameInput ? nameInput.value.trim() : '';
        if (!rawName) {
            setExprStatus("⚠ Masukkan nama ekspresi kustom terlebih dahulu.");
            return;
        }

        const weights = slots.map((slot) => {
            try {
                if (slot.morphInstance && typeof slot.morphInstance.getWeight === 'function') {
                    const val = Number(slot.morphInstance.getWeight(slot.targetIndex));
                    return isFinite(val) ? Math.max(0, Math.min(1, val)) : 0;
                }
            } catch (e) {}
            return 0;
        });

        customExpressions[rawName] = weights;
        if (nameInput) nameInput.value = '';
        renderCustomExpressions();
        setExprStatus("✓ Ekspresi kustom disimpan: " + rawName);
        logExpr("Saved custom expression: " + rawName);
    }

    function bindExpressionControls() {
        try {
            document.querySelectorAll('#exprButtons button[data-expr], .expr-btn[data-expr]').forEach(btn => {
                btn.onclick = () => {
                    const key = btn.getAttribute('data-expr');
                    applyExpressionPreset(key);
                };
            });

            const resetExprBtn = byId('resetExprBtn');
            if (resetExprBtn) {
                resetExprBtn.onclick = () => {
                    const selected = getSelectedModel();
                    if (!selected) {
                        setExprStatus("⚠ Pilih model dulu!");
                        return;
                    }
                    resetAllMorphWeights(selected);
                    updateExprButtonState('neutral');
                    setExprStatus("Semua ekspresi / morph di-reset.");
                };
            }

            const saveCustomBtn = byId('saveCustomExprBtn');
            if (saveCustomBtn) {
                saveCustomBtn.onclick = saveCustomExpression;
            }

            renderCustomExpressions();
            if (activePresetKey) {
                updateExprButtonState(activePresetKey);
            }
        } catch (err) {
            logExpr("bindExpressionControls warning: " + err.message);
        }
    }

    bindExpressionControls();
    window.__vtfBindExpressionControls = bindExpressionControls;

    logExpr("✅ expressions.js loaded");
})();
