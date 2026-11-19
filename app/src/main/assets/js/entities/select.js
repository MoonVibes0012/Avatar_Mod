/* ===== VTuber Forge — js/entities/select.js ===== */
// Seleksi objek, update tree, inspector UI, mode switching, transform sync

function setStatusSafe(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

// ============================================================
// MODE MANAGEMENT
// ============================================================
function resetMode() {
    S.mode = 'object';
    document.querySelectorAll('[data-mode]').forEach(b => {
        b.classList.toggle('on', b.dataset.mode === 'object');
    });
    const vp = document.getElementById('vertexPanel'); if (vp) vp.style.display = 'none';
    const bp = document.getElementById('bonePanel'); if (bp) bp.style.display = 'none';
    const bec = document.getElementById('boneEditControls'); if (bec) bec.style.display = 'none';
    const modeEl = document.getElementById('mode'); if (modeEl) modeEl.textContent = 'OBJECT';
}
window.resetMode = resetMode;

function setMode(mode) {
    if (mode === S.mode) return;

    if (mode !== 'object' && !S.selected) {
        alert("Pilih objek dulu sebelum masuk mode " + mode.toUpperCase() + ".");
        return;
    }

    if (mode === 'vertex' || mode === 'bone') {
        const rc = S.selected.findComponent('render');
        const hasSkinned = rc && rc.meshInstances && rc.meshInstances.some(mi => mi.skinInstance);
        if (mode === 'vertex' && hasSkinned) {
            alert("Mode Vertex tidak tersedia untuk model skinned.\n\nGunakan mode Bone untuk model VRM/GLB skinned.");
            return;
        }
        if (mode === 'bone' && !hasSkinned) {
            alert("Mode Bone hanya tersedia untuk model dengan skeleton.\n\nImport model VRM/GLB yang punya tulang.");
            return;
        }
    }

    S.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(b => {
        b.classList.toggle('on', b.dataset.mode === mode);
    });
    const vp = document.getElementById('vertexPanel'); if (vp) vp.style.display = 'none';
    const bp = document.getElementById('bonePanel'); if (bp) bp.style.display = 'none';
    const modeEl = document.getElementById('mode'); if (modeEl) modeEl.textContent = mode.toUpperCase();

    if (mode === 'vertex' && typeof setupVertexEditing === 'function') {
        setupVertexEditing();
        if (S.mode === 'vertex' && vp) {
            vp.style.display = 'block';
            setStatusSafe("Mode Vertex aktif — geser slider untuk edit vertex");
        }
    } else if (mode === 'bone' && typeof setupBoneEditing === 'function') {
        setupBoneEditing();
        if (bp && bp.style.display === 'block') {
            setStatusSafe("Mode Bone aktif — pilih bone lalu rotasi");
        } else {
            resetMode();
            setStatusSafe("Mode Bone gagal — balik ke mode Object.");
        }
    } else if (mode === 'object') {
        setStatusSafe("Mode Object aktif — transform objek");
    }
}

document.querySelectorAll('[data-mode]').forEach(btn => {
    const mode = btn.dataset.mode;
    if (!btn.title) {
        btn.title = mode === 'object'
            ? 'Transform objek (posisi / rotasi / scale)'
            : mode === 'vertex'
                ? 'Edit per-vertex (mesh non-skinned, maks 5000 vertex)'
                : 'Rotasi bone (butuh model dengan skeleton)';
    }
    btn.onclick = () => setMode(mode);
});

// ============================================================
// SYNC TRANSFORM UI (number + slider + label)
// ============================================================
function syncTransformUI(entity) {
    if (!entity) return;
    const p = entity.getPosition();
    const r = entity.getEulerAngles();
    const s = entity.getLocalScale();

    const setPair = (numId, sliderId, outId, v, decimals, sMin, sMax) => {
        const n = document.getElementById(numId);
        const sl = document.getElementById(sliderId);
        const out = document.getElementById(outId);
        if (n) n.value = v;
        if (sl) {
            const clamped = (sMin !== undefined && sMax !== undefined)
                ? Math.max(sMin, Math.min(sMax, v))
                : v;
            sl.value = clamped;
        }
        if (out) out.textContent = decimals !== undefined ? v.toFixed(decimals) : v;
    };

    setPair('px', 'pxR', 'pxo', p.x, 2, -10, 10);
    setPair('py', 'pyR', 'pyo', p.y, 2, -10, 10);
    setPair('pz', 'pzR', 'pzo', p.z, 2, -10, 10);
    setPair('sc', 'scR', 'sco', s.x, 2, 0.1, 5);
    setPair('rx', 'rxR', 'rxo', r.x, 0, -180, 180);
    setPair('ry', 'ryR', 'ryo', r.y, 0, -180, 180);
    setPair('rz', 'rzR', 'rzo', r.z, 0, -180, 180);
}
window.syncTransformUI = syncTransformUI;

// ============================================================
// TREE & SELECTION
// ============================================================
function updateTree() {
    const treeEl = document.getElementById('tree');
    if (!treeEl) return;
    const safeEscape = typeof escapeHtml === 'function'
        ? escapeHtml
        : (str) => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    treeEl.innerHTML = S.objects.map((o, i) => `<button type="button" class="${o === S.selected ? 'sel' : ''}" data-idx="${i}">${safeEscape(o.name)}</button>`).join('');
    treeEl.querySelectorAll('button').forEach(b => {
        b.onclick = () => selectObject(S.objects[parseInt(b.dataset.idx, 10)]);
    });
}
window.updateTree = updateTree;

function selectObject(entity) {
    if (S.selected !== entity && S.mode === 'bone') {
        resetMode();
    }

    S.selected = entity || null;
    const selEl = document.getElementById('sel');
    if (selEl) selEl.textContent = S.selected ? S.selected.name : 'Nothing selected';
    updateTree();

    if (S.selected) {
        syncTransformUI(S.selected);

        if (S.selected.render && S.selected.render.material) {
            let m = S.selected.render.material;
            if (Array.isArray(m)) m = m[0];
            if (m && m.diffuse) {
                const colorEl = document.getElementById('color');
                const roughEl = document.getElementById('rough');
                const roughOut = document.getElementById('rougho');
                const metalEl = document.getElementById('metal');
                const metalOut = document.getElementById('meto');
                if (colorEl && typeof rgbToHex === 'function') {
                    colorEl.value = rgbToHex(m.diffuse.r, m.diffuse.g, m.diffuse.b);
                }
                if (roughEl) roughEl.value = m.gloss;
                if (roughOut) roughOut.textContent = Number(m.gloss || 0).toFixed(2);
                if (metalEl) metalEl.value = m.metalness;
                if (metalOut) metalOut.textContent = Number(m.metalness || 0).toFixed(2);
            }
        }

        const animControls = document.getElementById('animControls');
        const animSelect = document.getElementById('animSelect');
        if (animControls && animSelect) {
            if (S.selected._animNames && S.selected._animNames.length > 0) {
                animControls.style.display = 'block';
                animSelect.innerHTML = '<option value="">-- Pilih Animasi --</option>';
                S.selected._animNames.forEach((name, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = name;
                    animSelect.appendChild(opt);
                });
            } else {
                animControls.style.display = 'none';
            }
        }

        const morphSection = document.getElementById('morphSection');
        const morphControls = document.getElementById('morphControls');
        const expressionSection = document.getElementById('expressionSection');
        if (morphSection && morphControls) {
            morphControls.innerHTML = '';
            if (S.selected._morphNames && S.selected._morphNames.length > 0) {
                morphSection.style.display = 'block';
                if (expressionSection) expressionSection.style.display = 'block';
                const safeEscape = typeof escapeHtml === 'function'
                    ? escapeHtml
                    : (str) => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                S.selected._morphNames.forEach((name, idx) => {
                    const div = document.createElement('div');
                    div.className = 'field';
                    const curWeight = (S.selected._morphInstance && typeof S.selected._morphInstance.getWeight === 'function')
                        ? Number(S.selected._morphInstance.getWeight(idx) || 0)
                        : 0;
                    div.innerHTML = `<label>${safeEscape(name)} <span id="morphVal_${idx}">${curWeight.toFixed(2)}</span></label> <input type="range" min="0" max="1" step="0.01" value="${curWeight.toFixed(2)}" data-morph-idx="${idx}" style="accent-color: #d946ef;">`;
                    morphControls.appendChild(div);
                });
                morphControls.querySelectorAll('input[type=range]').forEach(input => {
                    input.oninput = (e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) return;
                        const idx = parseInt(e.target.dataset.morphIdx, 10);
                        const label = document.getElementById('morphVal_' + idx);
                        if (label) label.textContent = val.toFixed(2);
                        if (S.selected && S.selected._morphInstance) {
                            S.selected._morphInstance.setWeight(idx, val);
                        }
                    };
                });
            } else {
                morphSection.style.display = 'none';
                if (expressionSection) expressionSection.style.display = 'none';
            }
        }

        if (S.mode === 'vertex' && typeof setupVertexEditing === 'function') {
            setupVertexEditing();
            if (S.mode === 'vertex') {
                const vp = document.getElementById('vertexPanel'); if (vp) vp.style.display = 'block';
            }
        }
        if (S.mode === 'bone' && typeof setupBoneEditing === 'function') {
            setupBoneEditing();
            const bp = document.getElementById('bonePanel');
            if (bp && bp.style.display !== 'block') {
                resetMode();
                setStatusSafe("Objek baru tidak punya skeleton — kembali ke mode Object.");
            }
        }
    } else {
        resetMode();
        const ac = document.getElementById('animControls'); if (ac) ac.style.display = 'none';
        const ms = document.getElementById('morphSection'); if (ms) ms.style.display = 'none';
        const es = document.getElementById('expressionSection'); if (es) es.style.display = 'none';
        if (typeof updateExprButtonState === 'function') updateExprButtonState(null);
    }
}
window.selectObject = selectObject;
