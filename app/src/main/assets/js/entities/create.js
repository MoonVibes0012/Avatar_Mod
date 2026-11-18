/* ===== VTuber Forge — js/entities/create.js ===== */
// Fungsi untuk membuat primitives dan avatar parts

function createShape(type) {
    if (!isAppReady) return;
    const entity = new pc.Entity(type + '-' + S.maxId++);
    let renderType = 'box';
    if (type === 'sphere' || type === 'head' || type === 'hair' || type === 'eye') renderType = 'sphere';
    if (type === 'capsule' || type === 'body' || type === 'tail') renderType = 'capsule';
    if (type === 'cylinder') renderType = 'cylinder';
    
    try {
        entity.addComponent('render', { type: renderType, castShadows: false });
    } catch (err) {
        dbg("WARNING: " + renderType + " gagal dibuat — " + err.message);
        if (renderType !== 'box') {
            try { entity.addComponent('render', { type: 'box', castShadows: false }); }
            catch(e2) { dbg("Box fallback juga gagal: " + e2.message); }
        }
    }
    
    try {
        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(0.6, 0.2, 0.8);
        mat.update();
        if (entity.render) entity.render.material = mat;
    } catch(e) { dbg("Material setup fail: " + e.message); }
    
    try {
        entity.setPosition(0, 1, 0);
        if (type === 'body') entity.setLocalScale(0.8, 1.2, 0.5);
        if (type === 'head' || type === 'hair' || type === 'eye') entity.setLocalScale(0.6, 0.6, 0.6);
        entity._baseScale = entity.getLocalScale().clone();
        entity._baseRot = entity.getEulerAngles().clone();
    } catch(e) {}
    
    app.root.addChild(entity);
    S.objects.push(entity);
    saveState();
    updateTree();
    selectObject(entity);
}

// Event listeners untuk tombol add
document.querySelectorAll('[data-add]').forEach(btn => {
    btn.onclick = () => {
        createShape(btn.dataset.add);
        $('status').textContent = "✓ " + btn.dataset.add + " ditambahkan";
    }
});
