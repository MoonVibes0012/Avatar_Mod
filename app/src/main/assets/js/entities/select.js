/* ===== VTuber Forge — js/entities/select.js ===== */
// Seleksi objek, update tree, dan inspector UI

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
        const p = entity.getPosition();
        $('px').value = p.x; $('pxo').textContent = p.x.toFixed(2);
        $('py').value = p.y; $('pyo').textContent = p.y.toFixed(2);
        $('pz').value = p.z; $('pzo').textContent = p.z.toFixed(2);
        
        const s = entity.getLocalScale();
        $('sc').value = s.x; $('sco').textContent = s.x.toFixed(2);
        
        const r = entity.getEulerAngles();
        $('rx').value = r.x; $('rxo').textContent = r.x.toFixed(0);
        $('ry').value = r.y; $('ryo').textContent = r.y.toFixed(0);
        $('rz').value = r.z; $('rzo').textContent = r.z.toFixed(0);
        
        if (entity.render && entity.render.material) {
            let m = entity.render.material;
            if (Array.isArray(m)) m = m[0];
            if (m && m.diffuse) {
                $('color').value = rgbToHex(m.diffuse.r, m.diffuse.g, m.diffuse.b);
                $('rough').value = m.gloss; $('rougho').textContent = m.gloss.toFixed(2);
                $('metal').value = m.metalness; $('meto').textContent = m.metalness.toFixed(2);
            }
        }
        
        // Populate Animation controls
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
        
        // Populate Morph controls
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
        
        if (S.mode === 'vertex' && typeof setupVertexEditing === 'function') setupVertexEditing();
    } else {
        resetMode();
        const ac = $('animControls'); if (ac) ac.style.display = 'none';
        const ms = $('morphSection'); if (ms) ms.style.display = 'none';
        const es = $('expressionSection'); if (es) es.style.display = 'none';
        if (typeof updateExprButtonState === 'function') updateExprButtonState(null);
    }
}
