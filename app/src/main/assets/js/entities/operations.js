/* ===== VTuber Forge — js/entities/operations.js ===== */
// Operasi objek: Duplikasi, Hapus, Mirror, Center, New Scene

function destroyEntity(e) {
    if (!e) return;
    try {
        e.enabled = false;
        if (e.parent) e.parent.removeChild(e);
        e.destroy();
    } catch (err) { dbg("Error destroy: " + err.message); }
}

function cloneMesh(mesh) {
    if (!mesh) return null; 
    const newMesh = new pc.Mesh(app.graphicsDevice);
    try {
        if (mesh.getPositions()) newMesh.setPositions(mesh.getPositions());
        if (mesh.getIndices()) newMesh.setIndices(mesh.getIndices());
        if (mesh.getUvs()) newMesh.setUvs(0, mesh.getUvs());
        if (mesh.getNormals()) newMesh.setNormals(mesh.getNormals()); else newMesh.calculateNormals();
        newMesh.update(pc.PRIMITIVE_TRIANGLES);
    } catch(e) { dbg("cloneMesh warning: " + e.message); }
    return newMesh;
}

$('dup').onclick = () => {
    if (!S.selected) return alert("Pilih objek dulu!");
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances) return;
    const skinCheck = renderComp.meshInstances.some(mi => mi.skinInstance != null);
    if (skinCheck) return alert("Model dengan skeleton (tulang) tidak bisa diduplikasi saat ini.\n\nFitur duplikasi skinned model akan datang di update berikutnya.");
    
    const srcMi = renderComp.meshInstances[0];
    if (srcMi && srcMi.mesh) {
        try {
            const pos = srcMi.mesh.getPositions();
            if (pos && pos.length / 3 > 50000) {
                return alert("Model terlalu besar untuk diduplikasi (> " + Math.floor(pos.length / 3) + " vertex).");
            }
        } catch(e) {
            dbg("Dup pre-check fail: " + e.message);
            return alert("Model ini tidak bisa diduplikasi (mesh compressed/korup).");
        }
    }
    
    const cacheVerts = (S.selected._meshCache || []).reduce((acc, m) => acc + (m.pos ? m.pos.length / 3 : 0), 0);
    if (cacheVerts > 200000) {
        return alert("Model terlalu besar untuk diduplikasi (cache > 200k vertex).");
    }
    
    const newEntity = new pc.Entity(S.selected.name + '-copy');
    newEntity.setPosition(S.selected.getPosition().x + 0.5, S.selected.getPosition().y, S.selected.getPosition().z);
    newEntity.setEulerAngles(S.selected.getEulerAngles());
    newEntity.setLocalScale(S.selected.getLocalScale());
    
    if (S.selected._meshCache && S.selected._meshCache.length > 0) {
        try {
            newEntity._meshCache = structuredClone(S.selected._meshCache);
        } catch(e) {
            newEntity._meshCache = S.selected._meshCache.map(m => ({
                pos: m.pos ? m.pos.slice() : null,
                idx: m.idx ? m.idx.slice() : null,
                uvs: m.uvs ? m.uvs.slice() : null,
                normals: m.normals ? m.normals.slice() : null
            }));
        }
        meshCachePool.set(newEntity.name, newEntity._meshCache);
    }
    
    if (renderComp && renderComp.meshInstances) {
        newEntity.addComponent('render', { type: 'asset', castShadows: false });
        newEntity.render.meshInstances = renderComp.meshInstances.map(mi => {
            const newMesh = cloneMesh(mi.mesh);
            const newMat = Array.isArray(mi.material) ? mi.material.map(m => m.clone()) : mi.material.clone();
            const newMi = new pc.MeshInstance(newMesh, newMat);
            newMi.aabb = pc.BoundingBox.fromMesh(newMesh);
            return newMi;
        });
    }
    
    newEntity._animSpin = S.selected._animSpin;
    newEntity._animPulse = S.selected._animPulse;
    newEntity._animWobble = S.selected._animWobble;
    if (S.selected._animAssets) newEntity._animAssets = S.selected._animAssets;
    if (S.selected._animNames) newEntity._animNames = S.selected._animNames;
    if (S.selected._morphInstance) newEntity._morphInstance = S.selected._morphInstance;
    if (S.selected._morphNames) newEntity._morphNames = S.selected._morphNames;
    
    app.root.addChild(newEntity);
    S.objects.push(newEntity);
    saveState();
    selectObject(newEntity);
};

$('del').onclick = () => {
    if (S.selected) {
        const toDelete = S.selected;
        selectObject(null);
        S.objects = S.objects.filter(o => o !== toDelete);
        destroyEntity(toDelete);
        saveState();
        updateTree();
        $('status').textContent = "Objek berhasil dihapus (bisa di-Undo).";
    } else {
        $('status').textContent = "Pilih objek dulu sebelum menghapus!";
    }
};

$('mirror').onclick = () => {
    if (!S.selected) return alert("Pilih objek dulu!");
    const p = S.selected.getPosition();
    S.selected.setPosition(-p.x, p.y, p.z);
    saveState();
};

$('center').onclick = () => {
    if (!S.selected) return alert("Pilih objek dulu!");
    S.selected.setPosition(0, 1, 0);
    saveState();
};

$('new').onclick = () => {
    const hasSkin = typeof hasAnySkinnedEntity === 'function' ? hasAnySkinnedEntity() : false;
    const msg = hasSkin
        ? "⚠ PERINGATAN!\n\nScene berisi model skinned. Menghapus semua akan menghilangkan skeleton PERMANEN.\n\nLanjutkan?"
        : "Hapus semua?";
    if (!confirm(msg)) return;
    S.objects.forEach(o => destroyEntity(o));
    meshCachePool.clear();
    S.objects = []; S.maxId = 1; undoStack = []; redoStack = []; resetMode(); selectObject(null);
};
