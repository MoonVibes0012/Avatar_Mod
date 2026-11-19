/* ===== VTuber Forge — js/entities/select.js ===== */
// Seleksi objek, update tree, inspector UI, mode switching, transform sync

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
            document.getElementById('status').textContent = "Mode Vertex aktif — geser slider untuk edit vertex";
        }
    } else if (mode === 'bone' && typeof setupBoneEditing === 'function') {
        setupBoneEditing();
        if (bp && bp.style.display === 'block') {
            document.getElementById('status').textContent = "Mode Bone aktif — pilih bone lalu rotasi";
        } else {
            resetMode();
            document.getElementById('status').textContent = "Mode Bone gagal — balik ke mode Object.";
        }
    } else if (mode === 'object') {
        document.getElementById('status').textContent = "Mode Object aktif — transform objek";
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

    // Position: -10..10, step 0.1, tampil 2 desimal
    setPair('px', 'pxR', 'pxo', p.x, 2, -10, 10);
    setPair('py', 'pyR', 'pyo', p.y, 2, -10, 10);
    setPair('pz', 'pzR', 'pzo', p.z, 2, -10, 10);
    // Scale: 0.1..5
    setPair('sc', 'scR', 'sco', s.x, 2, 0.1, 5);
    // Rotation: -180..180, step 1, tampil 0 desimal
    setPair('rx', 'rxR', 'rxo', r.x, 0, -180, 180);
    setPair('ry', 'ryR', 'ryo', r.y, 0, -180, 180);
    setPair('rz', 'rzR', 'rzo', r.z, 0, -180, 180);
}
window.syncTransformUI = syncTransformUI;

// ============================================================
// TREE & SELECTION
// ============================================================
function updateTree() {
    const treeEl = $('tree');
    if (!treeEl) return;
    treeEl.innerHTML = S.objects.map((o, i) => `<button class="${o === S.selected ? 'sel' : ''}" data-idx="${i}">${escapeHtml(o.name)}</button>`).join('');
    treeEl.querySelectorAll('button').forEach(b => { b.onclick = () => selectObject(S.objects[b.dataset.idx]); });
}

function selectObject(entity) {
    if (S.selected !== entity && S.mode === 'bone') {
        resetMode();
    }

    S.selected = entity;
    $('sel').textContent = entity ? entity.name : 'Nothing selected';
    updateTree();

    if (entity) {
        // Sync semua input transform + slider sekaligus
        syncTransformUI(entity);

        if (entity.render && entity.render.material) {
            let m = entity.render.material;
            if (Array.isArray(m)) m = m[0];
            if (m && m.diffuse) {
                $('color').value = rgbToHex(m.diffuse.r, m.diffuse.g, m.diffuse.b);
                $('rough').value = m.gloss; $('rougho').textContent = m.gloss.toFixed(2);
                $('metal').value = m.metalness; $('meto').textContent = m.metalness.toFixed(2);
            }
        }

        // Animation controls
        const animControls = $('animControls');
        const animSelect = $('animSelect');
        if (animControls && animSelect) {
            if (entity._animNames && entity._animNames.length > 0) {
                animControls.style.display = 'block';
                animSelect.innerHTML = '<option value="">-- Pilih Animasi --</option>';
                entity._animNames.forEach((name, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = name;
                    animSelect.appendChild(opt);
                });
            } else {
                animControls.style.display = 'none';
            }
        }

        // Morph controls
        const morphSection = $('morphSection');
        const morphControls = $('morphControls');
        const expressionSection = $('expressionSection');
        if (morphSection && morphControls) {
            morphControls.innerHTML = '';
            if (entity._morphNames && entity._morphNames.length > 0) {
                morphSection.style.display = 'block';
                if (expressionSection) expressionSection.style.display = 'block';
                entity._morphNames.forEach((name, idx) => {
                    const div = document.createElement('div');
                    div.className = 'field';
                    div.innerHTML = `<label>${escapeHtml(name)} <span id="morphVal_${idx}">0.00</span></label> <input type="range" min="0" max="1" step="0.01" value="0" data-morph-idx="${idx}" style="accent-color: #d946ef;">`;
                    morphControls.appendChild(div);
                });
                morphControls.querySelectorAll('input[type=range]').forEach(input => {
                    input.oninput = (e) => {
                        const val = parseFloat(e.target.value);
                        const idx = parseInt(e.target.dataset.morphIdx);
                        const label = document.getElementById(`morphVal_${idx}`);
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
                const vp = $('vertexPanel'); if (vp) vp.style.display = 'block';
            }
        }
        if (S.mode === 'bone' && typeof setupBoneEditing === 'function') {
            setupBoneEditing();
            const bp = $('bonePanel');
            if (bp && bp.style.display !== 'block') {
                resetMode();
                $('status').textContent = "Objek baru tidak punya skeleton — kembali ke mode Object.";
            }
        }

    } else {
        resetMode();
        const ac = $('animControls'); if (ac) ac.style.display = 'none';
        const ms = $('morphSection'); if (ms) ms.style.display = 'none';
        const es = $('expressionSection'); if (es) es.style.display = 'none';
        if (typeof updateExprButtonState === 'function') updateExprButtonState(null);
    }
}
