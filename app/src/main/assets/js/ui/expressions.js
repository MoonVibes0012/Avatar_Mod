/* ===== VTuber Forge — js/ui/expressions.js ===== */
// Blendshape / Facial Expressions Preset & Custom Expressions

(function () {
    'use strict';

    const EXPRESSION_PRESETS = {
        neutral: { label: '😐 Neutral', keywords: [] },
        happy:   { label: '😊 Happy',   keywords: ['joy', 'happy', 'smile', 'fun'] },
        angry:   { label: '😠 Angry',   keywords: ['angry', 'anger', 'frown'] },
        sad:     { label: '😢 Sad',     keywords: ['sad', 'sorrow'] },
        surprised:{ label: '😮 Surprised', keywords: ['surprised', 'surprise', 'oh', 'o'] },
        blink:   { label: '😉 Blink',   keywords: ['blink', 'blink_l', 'blink_r', 'eye_close'] }
    };

    let customExpressions = {};
    let activePresetKey = null;

    function byId(id) {
        return document.getElementById(id);
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

    function updateExprButtonState(presetKey) {
        activePresetKey = presetKey || null;
        document.querySelectorAll('.expr-btn[data-expr]').forEach(btn => {
            const key = btn.getAttribute('data-expr');
            btn.classList.toggle('active', !!activePresetKey && key === activePresetKey);
        });
    }
    window.updateExprButtonState = updateExprButtonState;

    function syncMorphSliderUI(idx, weight) {
        const clamped = Math.max(0, Math.min(1, Number(weight) || 0));
        const slider = document.querySelector('#morphControls input[data-morph-idx="' + idx + '"]');
        if (slider) slider.value = clamped.toFixed(2);
        const label = byId('morphVal_' + idx);
        if (label) label.textContent = clamped.toFixed(2);
    }

    function resetAllMorphWeights(entity) {
        if (!entity || !entity._morphInstance || !Array.isArray(entity._morphNames)) return;
        entity._morphNames.forEach((_, idx) => {
            try {
                if (typeof entity._morphInstance.setWeight === 'function') {
                    entity._morphInstance.setWeight(idx, 0);
                }
                syncMorphSliderUI(idx, 0);
            } catch (e) {}
        });
    }

    function applyExpressionPreset(presetKey) {
        const selected = getSelectedModel();
        if (!selected) {
            alert("Pilih model dulu sebelum menerapkan ekspresi!");
            return;
        }
        if (!selected._morphInstance || !Array.isArray(selected._morphNames) || selected._morphNames.length === 0) {
            alert("Model ini tidak memiliki blendshape / morph targets.");
            return;
        }

        const preset = EXPRESSION_PRESETS[presetKey];
        if (!preset) return;

        resetAllMorphWeights(selected);

        if (presetKey === 'neutral' || !Array.isArray(preset.keywords) || preset.keywords.length === 0) {
            updateExprButtonState('neutral');
            setExprStatus("Ekspresi: Neutral");
            return;
        }

        let matchedCount = 0;
        selected._morphNames.forEach((rawName, idx) => {
            const lower = String(rawName || '').toLowerCase();
            const isMatch = preset.keywords.some(kw => lower.includes(kw));
            if (isMatch) {
                matchedCount++;
                try {
                    if (typeof selected._morphInstance.setWeight === 'function') {
                        selected._morphInstance.setWeight(idx, 1.0);
                    }
                    syncMorphSliderUI(idx, 1.0);
                } catch (e) {}
            }
        });

        updateExprButtonState(presetKey);
        if (matchedCount > 0) {
            setExprStatus("Ekspresi " + preset.label + " diterapkan (" + matchedCount + " morph)");
        } else {
            setExprStatus("Morph untuk '" + presetKey + "' tidak ditemukan pada model ini.");
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
                if (!selected || !selected._morphInstance || !Array.isArray(weights)) return;

                resetAllMorphWeights(selected);
                weights.forEach((w, idx) => {
                    const num = Math.max(0, Math.min(1, Number(w) || 0));
                    try {
                        if (typeof selected._morphInstance.setWeight === 'function') {
                            selected._morphInstance.setWeight(idx, num);
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
        if (!selected || !selected._morphInstance || !Array.isArray(selected._morphNames) || selected._morphNames.length === 0) {
            alert("Pilih model yang memiliki morph targets dulu!");
            return;
        }

        const nameInput = byId('customExprName');
        const rawName = nameInput ? nameInput.value.trim() : '';
        if (!rawName) {
            alert("Masukkan nama ekspresi kustom terlebih dahulu.");
            return;
        }

        const weights = selected._morphNames.map((_, idx) => {
            try {
                if (typeof selected._morphInstance.getWeight === 'function') {
                    const val = Number(selected._morphInstance.getWeight(idx));
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

    document.querySelectorAll('.expr-btn[data-expr]').forEach(btn => {
        btn.onclick = () => {
            const key = btn.getAttribute('data-expr');
            applyExpressionPreset(key);
        };
    });

    const resetExprBtn = byId('resetExprBtn');
    if (resetExprBtn) {
        resetExprBtn.onclick = () => {
            const selected = getSelectedModel();
            if (!selected) return alert("Pilih model dulu!");
            resetAllMorphWeights(selected);
            updateExprButtonState(null);
            setExprStatus("Semua ekspresi / morph di-reset.");
        };
    }

    const saveCustomBtn = byId('saveCustomExprBtn');
    if (saveCustomBtn) {
        saveCustomBtn.onclick = saveCustomExpression;
    }

    logExpr("✅ expressions.js loaded");
})();
