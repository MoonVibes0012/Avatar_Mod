/* ===== VTuber Forge — js/ui/expressions.js ===== */
// Expression Presets dan Custom Expressions

const EXPRESSION_PRESETS = {
    neutral: {},
    smile: { smile: 0.8, mouth_smile: 0.8, joy: 0.6, mouth_up: 0.7, aa: 0.2, blush: 0.3 },
    laugh: { smile: 1.0, mouth_smile: 1.0, mouth_open: 0.6, aa: 0.7, joy: 0.9, eye_squint: 0.5 },
    surprise: { eye_wide: 0.9, eye_open_wide: 0.9, mouth_open: 0.8, oo: 0.7, brow_up: 0.8, surprise: 0.9 },
    angry: { brow_angry: 0.9, brow_down: 0.8, angry: 0.9, mouth_angry: 0.6, eye_sharp: 0.5 },
    sad: { brow_sad: 0.8, brow_down: 0.6, sad: 0.9, mouth_sad: 0.7, eye_cry: 0.4 },
    wink_l: { eye_blink_l: 1.0, eye_close_l: 1.0, blink_l: 1.0, smile: 0.3 },
    wink_r: { eye_blink_r: 1.0, eye_close_r: 1.0, blink_r: 1.0, smile: 0.3 },
    shock: { eye_wide: 1.0, mouth_open: 1.0, oo: 0.9, brow_up: 1.0, shock: 1.0, surprise: 1.0 },
    happy: { smile: 1.0, mouth_smile: 1.0, joy: 1.0, eye_squint: 0.6, blush: 0.5, happy: 1.0 },
    cool: { eye_half: 0.7, smile: 0.4, mouth_smile: 0.3, cool: 0.8 },
    love: { eye_heart: 0.9, heart_eye: 0.9, smile: 0.8, blush: 0.7, love: 1.0 }
};

let customExpressions = {};
try {
    customExpressions = JSON.parse(localStorage.getItem('vtuber_custom_expr') || '{}') || {};
} catch (e) {
    customExpressions = {};
}

function setExprStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logExpr(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function findExprMorphIndex(name) {
    if (!S.selected || !Array.isArray(S.selected._morphNames)) return -1;
    const lowerName = String(name || '').toLowerCase();
    let idx = S.selected._morphNames.findIndex(n => String(n || '').toLowerCase() === lowerName);
    if (idx >= 0) return idx;

    idx = S.selected._morphNames.findIndex(n => String(n || '').toLowerCase().includes(lowerName));
    if (idx >= 0) return idx;

    const normalized = lowerName.replace(/[\s_-]/g, '');
    idx = S.selected._morphNames.findIndex(n =>
        String(n || '').toLowerCase().replace(/[\s_-]/g, '').includes(normalized)
    );
    return idx;
}

function applyExpression(exprName, intensity) {
    if (intensity === undefined || isNaN(Number(intensity))) intensity = 1.0;
    else intensity = Number(intensity);

    if (!S.selected || !S.selected._morphInstance || !Array.isArray(S.selected._morphNames)) {
        alert("Objek ini tidak memiliki blendshapes (morph targets).");
        return;
    }

    let preset = EXPRESSION_PRESETS[exprName];
    if (!preset) {
        preset = customExpressions[exprName];
        if (!preset) {
            logExpr("Expression not found: " + exprName);
            return;
        }
    }

    if (exprName === 'neutral') {
        for (let i = 0; i < S.selected._morphNames.length; i++) {
            S.selected._morphInstance.setWeight(i, 0);
        }
        const sliders = document.querySelectorAll('#morphControls input[type=range]');
        sliders.forEach(s => {
            s.value = '0';
            const label = document.getElementById('morphVal_' + s.dataset.morphIdx);
            if (label) label.textContent = '0.00';
        });
        setExprStatus("😌 Neutral — semua blendshape di-reset");
        updateExprButtonState(null);
        return;
    }

    let appliedCount = 0;
    const notFoundKeys = [];
    for (const key in preset) {
        const clampedVal = Math.max(0, Math.min(1, preset[key] * intensity));
        const idx = findExprMorphIndex(key);
        if (idx >= 0) {
            S.selected._morphInstance.setWeight(idx, clampedVal);
            appliedCount++;
            const slider = document.querySelector('#morphControls input[data-morph-idx="' + idx + '"]');
            if (slider) {
                slider.value = clampedVal.toFixed(2);
                const label = document.getElementById('morphVal_' + idx);
                if (label) label.textContent = clampedVal.toFixed(2);
            }
        } else {
            notFoundKeys.push(key);
        }
    }

    if (notFoundKeys.length > 0) {
        logExpr("Expression '" + exprName + "' — tidak ditemukan: " + notFoundKeys.join(', '));
    }
    setExprStatus("✓ " + exprName + " applied (" + appliedCount + " blendshapes)");
    updateExprButtonState(exprName);
    if (typeof saveState === 'function') saveState();
}
window.applyExpression = applyExpression;

function updateExprButtonState(activeExpr) {
    document.querySelectorAll('.expr-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.expr === activeExpr);
    });
}
window.updateExprButtonState = updateExprButtonState;

function renderCustomExprList() {
    const container = document.getElementById('customExprList');
    if (!container) return;
    container.innerHTML = '';
    const keys = Object.keys(customExpressions);
    if (keys.length === 0) return;
    keys.forEach(name => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '⭐ ' + name;
        btn.onclick = () => {
            const intEl = document.getElementById('exprIntensity');
            const intensity = intEl ? (parseFloat(intEl.value) || 1) : 1;
            applyExpression(name, intensity);
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm("Hapus custom expression '" + name + "'?")) {
                delete customExpressions[name];
                try {
                    localStorage.setItem('vtuber_custom_expr', JSON.stringify(customExpressions));
                } catch (storageErr) {}
                renderCustomExprList();
                setExprStatus("Custom expression dihapus");
            }
        };
        container.appendChild(btn);
    });
}
window.renderCustomExprList = renderCustomExprList;

document.querySelectorAll('.expr-btn').forEach(btn => {
    btn.onclick = () => {
        const intEl = document.getElementById('exprIntensity');
        const intensity = intEl ? (parseFloat(intEl.value) || 1) : 1;
        applyExpression(btn.dataset.expr, intensity);
    };
});

const exprIntensityEl = document.getElementById('exprIntensity');
if (exprIntensityEl) {
    exprIntensityEl.oninput = (e) => {
        const out = document.getElementById('exprIntensityOut');
        const parsed = parseFloat(e.target.value);
        if (out) out.textContent = (isNaN(parsed) ? 1 : parsed).toFixed(2);
    };
}

const exprSaveCustomEl = document.getElementById('exprSaveCustom');
if (exprSaveCustomEl) {
    exprSaveCustomEl.onclick = () => {
        if (!S.selected || !S.selected._morphInstance || !Array.isArray(S.selected._morphNames)) {
            return alert("Pilih objek dengan blendshapes dulu!");
        }
        const name = prompt("Nama expression custom:");
        if (!name || name.trim() === '') return;

        const safeName = name.trim().replace(/[^a-zA-Z0-9_ -]/g, '');
        if (safeName === '') return alert("Nama tidak valid!");

        const preset = {};
        S.selected._morphNames.forEach((morphName, idx) => {
            const weight = typeof S.selected._morphInstance.getWeight === 'function'
                ? Number(S.selected._morphInstance.getWeight(idx) || 0)
                : 0;
            if (weight > 0.01) {
                const key = String(morphName || `morph_${idx}`).toLowerCase().replace(/[\s_-]/g, '_');
                preset[key] = weight;
            }
        });

        if (Object.keys(preset).length === 0) {
            return alert("Tidak ada blendshape aktif untuk disimpan!");
        }

        customExpressions[safeName] = preset;
        try {
            localStorage.setItem('vtuber_custom_expr', JSON.stringify(customExpressions));
        } catch (storageErr) {}
        renderCustomExprList();
        setExprStatus("💾 Custom expression '" + safeName + "' tersimpan (long-press untuk hapus)");
    };
}

renderCustomExprList();
logExpr("✅ expressions.js loaded");
