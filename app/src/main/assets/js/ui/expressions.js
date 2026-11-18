/* ===== VTuber Forge — js/ui/expressions.js ===== */
// Expression Presets dan Custom Expressions

const EXPRESSION_PRESETS = {
    neutral: {},
    smile: { 'smile': 0.8, 'mouth_smile': 0.8, 'joy': 0.6, 'mouth_up': 0.7, 'aa': 0.2, 'blush': 0.3 },
    laugh: { 'smile': 1.0, 'mouth_smile': 1.0, 'mouth_open': 0.6, 'aa': 0.7, 'joy': 0.9, 'eye_squint': 0.5 },
    surprise: { 'eye_wide': 0.9, 'eye_open_wide': 0.9, 'mouth_open': 0.8, 'oo': 0.7, 'brow_up': 0.8, 'surprise': 0.9 },
    angry: { 'brow_angry': 0.9, 'brow_down': 0.8, 'angry': 0.9, 'mouth_angry': 0.6, 'eye_sharp': 0.5 },
    sad: { 'brow_sad': 0.8, 'brow_down': 0.6, 'sad': 0.9, 'mouth_sad': 0.7, 'eye_cry': 0.4 },
    wink_l: { 'eye_blink_l': 1.0, 'eye_close_l': 1.0, 'blink_l': 1.0, 'smile': 0.3 },
    wink_r: { 'eye_blink_r': 1.0, 'eye_close_r': 1.0, 'blink_r': 1.0, 'smile': 0.3 },
    shock: { 'eye_wide': 1.0, 'mouth_open': 1.0, 'oo': 0.9, 'brow_up': 1.0, 'shock': 1.0, 'surprise': 1.0 },
    happy: { 'smile': 1.0, 'mouth_smile': 1.0, 'joy': 1.0, 'eye_squint': 0.6, 'blush': 0.5, 'happy': 1.0 },
    cool: { 'eye_half': 0.7, 'smile': 0.4, 'mouth_smile': 0.3, 'cool': 0.8 },
    love: { 'eye_heart': 0.9, 'heart_eye': 0.9, 'smile': 0.8, 'blush': 0.7, 'love': 1.0 }
};

let customExpressions = {};
try { customExpressions = JSON.parse(localStorage.getItem('vtuber_custom_expr') || '{}'); } catch(e) {}

function findMorphIndex(name) {
    if (!S.selected || !S.selected._morphNames) return -1;
    const lowerName = name.toLowerCase();
    let idx = S.selected._morphNames.findIndex(n => n.toLowerCase() === lowerName);
    if (idx >= 0) return idx;
    
    idx = S.selected._morphNames.findIndex(n => n.toLowerCase().includes(lowerName));
    if (idx >= 0) return idx;
    
    // FIX: Pindahkan underscore (_) ke posisi aman dalam character class
    const normalized = lowerName.replace(/[\s_-]/g, ''); 
    idx = S.selected._morphNames.findIndex(n => 
        n.toLowerCase().replace(/[\s_-]/g, '').includes(normalized)
    );
    return idx;
}

function applyExpression(exprName, intensity) {
    if (intensity === undefined) intensity = 1.0;
    if (!S.selected || !S.selected._morphInstance || !S.selected._morphNames) {
        alert("Objek ini tidak memiliki blendshapes (morph targets).");
        return;
    }
    
    let preset = EXPRESSION_PRESETS[exprName];
    if (!preset) {
        preset = customExpressions[exprName];
        if (!preset) {
            dbg("Expression not found: " + exprName);
            return;
        }
    }
    
    if (exprName === 'neutral') {
        for (let i = 0; i < S.selected._morphNames.length; i++) {
            S.selected._morphInstance.setWeight(i, 0);
        }
        const sliders = document.querySelectorAll('#morphControls input[type=range]');
        sliders.forEach(s => {
            s.value = 0;
            const label = document.getElementById('morphVal_' + s.dataset.morphIdx);
            if (label) label.textContent = '0.00';
        });
        $('status').textContent = "😌 Neutral — semua blendshape di-reset";
        updateExprButtonState(null);
        return;
    }
    
    let appliedCount = 0;
    let notFoundKeys = [];
    for (const key in preset) {
        const targetValue = preset[key] * intensity;
        const idx = findMorphIndex(key);
        if (idx >= 0) {
            S.selected._morphInstance.setWeight(idx, Math.min(1, targetValue));
            appliedCount++;
            const slider = document.querySelector('#morphControls input[data-morph-idx="' + idx + '"]');
            if (slider) {
                slider.value = Math.min(1, targetValue);
                const label = document.getElementById('morphVal_' + idx);
                if (label) label.textContent = Math.min(1, targetValue).toFixed(2);
            }
        } else {
            notFoundKeys.push(key);
        }
    }
    
    if (notFoundKeys.length > 0) {
        dbg("Expression '" + exprName + "' — tidak ditemukan: " + notFoundKeys.join(', '));
    }
    $('status').textContent = "✓ " + exprName + " applied (" + appliedCount + " blendshapes)";
    updateExprButtonState(exprName);
    saveState();
}

function updateExprButtonState(activeExpr) {
    document.querySelectorAll('.expr-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.expr === activeExpr);
    });
}

function renderCustomExprList() {
    const container = $('customExprList');
    if (!container) return;
    container.innerHTML = '';
    const keys = Object.keys(customExpressions);
    if (keys.length === 0) return;
    keys.forEach(name => {
        const btn = document.createElement('button');
        btn.textContent = '⭐ ' + name;
        btn.onclick = () => {
            const intensity = parseFloat($('exprIntensity').value) || 1;
            applyExpression(name, intensity);
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm("Hapus custom expression '" + name + "'?")) {
                delete customExpressions[name];
                localStorage.setItem('vtuber_custom_expr', JSON.stringify(customExpressions));
                renderCustomExprList();
                $('status').textContent = "Custom expression dihapus";
            }
        };
        container.appendChild(btn);
    });
}

document.querySelectorAll('.expr-btn').forEach(btn => {
    btn.onclick = () => {
        const intensity = parseFloat($('exprIntensity').value) || 1;
        applyExpression(btn.dataset.expr, intensity);
    };
});

if ($('exprIntensity')) {
    $('exprIntensity').oninput = (e) => {
        $('exprIntensityOut').textContent = parseFloat(e.target.value).toFixed(2);
    };
}

if ($('exprSaveCustom')) {
    $('exprSaveCustom').onclick = () => {
        if (!S.selected || !S.selected._morphInstance || !S.selected._morphNames) {
            return alert("Pilih objek dengan blendshapes dulu!");
        }
        const name = prompt("Nama expression custom:");
        if (!name || name.trim() === '') return;
        
        // FIX: Tambah spasi sebelum ] agar underscore tidak dianggap range
        const safeName = name.trim().replace(/[^a-zA-Z0-9_ -]/g, ''); 
        
        if (safeName === '') return alert("Nama tidak valid!");
        const preset = {};
        S.selected._morphNames.forEach((morphName, idx) => {
            const weight = S.selected._morphInstance.getWeight(idx);
            if (weight > 0.01) {
                const key = morphName.toLowerCase().replace(/[\s_-]/g, '_');
                preset[key] = weight;
            }
        });
        
        if (Object.keys(preset).length === 0) {
            return alert("Tidak ada blendshape aktif untuk disimpan!");
        }
        
        customExpressions[safeName] = preset;
        localStorage.setItem('vtuber_custom_expr', JSON.stringify(customExpressions));
        renderCustomExprList();
        $('status').textContent = "💾 Custom expression '" + safeName + "' tersimpan (long-press untuk hapus)";
    };
}

renderCustomExprList();
dbg("✅ expressions.js loaded");
