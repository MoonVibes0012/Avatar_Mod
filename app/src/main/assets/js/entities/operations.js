/* ===== VTuber Forge — js/entities/operations.js ===== */
// Operasi objek: Duplikasi, Hapus, Mirror, Center, New Scene

function setOpStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logOp(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function destroyEntity(e) {
    if (!e) return;
    try {
        e.enabled = false;
        if (e.parent) e.parent.removeChild(e);
        if (typeof e.destroy === 'function') e.destroy();
    } catch (err) {
        logOp("Error destroy: " + err.message);
    }
}
window.destroyEntity = destroyEntity;

function cloneMesh(mesh) {
    if (!mesh || typeof app === 'undefined' || !app || !app.graphicsDevice) return null;
    const newMesh = new pc.Mesh(app.graphicsDevice);
    try {
        if (mesh.getPositions && mesh.getPositions()) newMesh.setPositions(mesh.getPositions());
        if (mesh.getIndices && mesh.getIndices()) newMesh.setIndices(mesh.getIndices());
        if (mesh.getUvs && mesh.getUvs()) newMesh.setUvs(0, mesh.getUvs());
        if (mesh.getNormals && mesh.getNormals()) newMesh.setNormals(mesh.getNormals());
        else if (typeof newMesh.calculateNormals === 'function') newMesh.calculateNormals();
        newMesh.update(pc.PRIMITIVE_TRIANGLES);
    } catch (e) {
        logOp("cloneMesh warning: " + e.message);
    }
    return newMesh;
}
window.cloneMesh = cloneMesh;

function cloneMaterialSafe(mat) {
    if (!mat) return null;
    try {
        if (Array.isArray(mat)) {
            return mat.map(m => (m && typeof m.clone === 'function') ? m.clone() : m);
        }
        return (typeof mat.clone === 'function') ? mat.clone() : mat;
    } catch (e) {
        logOp("cloneMaterialSafe warning: " + e.message);
        return mat;
    }
}

const dupBtn = document.getElementById('dup');
if (dupBtn) {
    dupBtn.onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        const renderComp = S.selected.findComponent('render');
        if (!renderComp || !renderComp.meshInstances) return;
        const skinCheck = renderComp.meshInstances.some(mi => mi.skinInstance != null);
        if (skinCheck) {
            return alert("Model dengan skeleton (tulang) tidak bisa diduplikasi saat ini.\n\nFitur duplikasi skinned model akan datang di update berikutnya.");
        }

        const srcMi = renderComp.meshInstances[0];
        if (srcMi && srcMi.mesh) {
            try {
                const pos = srcMi.mesh.getPositions();
                if (pos && pos.length / 3 > 50000) {
                    return alert("Model terlalu besar untuk diduplikasi (> " + Math.floor(pos.length / 3) + " vertex).");
                }
            } catch (e) {
                logOp("Dup pre-check fail: " + e.message);
                return alert("Model ini tidak bisa diduplikasi (mesh compressed/korup).");
            }
        }

        const cacheVerts = (S.selected._meshCache || []).reduce((acc, m) => acc + (m.pos ? m.pos.length / 3 : 0), 0);
        if (cacheVerts > 200000) {
            return alert("Model terlalu besar untuk diduplikasi (cache > 200k vertex).");
        }

        const newEntity = new pc.Entity(S.selected.name + '-copy');
        const curPos = S.selected.getPosition();
        newEntity.setPosition(curPos.x + 0.5, curPos.y, curPos.z);
        newEntity.setEulerAngles(S.selected.getEulerAngles());
        newEntity.setLocalScale(S.selected.getLocalScale());

        if (S.selected._meshCache && S.selected._meshCache.length > 0) {
            try {
                newEntity._meshCache = structuredClone(S.selected._meshCache);
            } catch (e) {
                newEntity._meshCache = S.selected._meshCache.map(m => ({
                    pos: m.pos ? m.pos.slice() : null,
                    idx: m.idx ? m.idx.slice() : null,
                    uvs: m.uvs ? m.uvs.slice() : null,
                    normals: m.normals ? m.normals.slice() : null
                }));
            }
            if (typeof meshCachePool !== 'undefined' && meshCachePool && typeof meshCachePool.set === 'function') {
                meshCachePool.set(newEntity.name, newEntity._meshCache);
            }
        }

        if (renderComp && renderComp.meshInstances) {
            newEntity.addComponent('render', { type: 'asset', castShadows: false });
            newEntity.render.meshInstances = renderComp.meshInstances.map(mi => {
                const newMesh = cloneMesh(mi.mesh);
                const newMat = cloneMaterialSafe(mi.material);
                const newMi = new pc.MeshInstance(newMesh, newMat);
                if (newMesh) newMi.aabb = pc.BoundingBox.fromMesh(newMesh);
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
        newEntity._baseScale = newEntity.getLocalScale().clone();
        newEntity._baseRot = newEntity.getEulerAngles().clone();

        app.root.addChild(newEntity);
        S.objects.push(newEntity);
        if (typeof saveState === 'function') saveState();
        if (typeof updateTree === 'function') updateTree();
        if (typeof selectObject === 'function') selectObject(newEntity);
        setOpStatus("✓ Objek diduplikasi: " + newEntity.name);
    };
}

const delBtn = document.getElementById('del');
if (delBtn) {
    delBtn.onclick = () => {
        if (S.selected) {
            const toDelete = S.selected;
            if (typeof selectObject === 'function') selectObject(null);
            S.objects = S.objects.filter(o => o !== toDelete);
            destroyEntity(toDelete);
            if (typeof saveState === 'function') saveState();
            if (typeof updateTree === 'function') updateTree();
            setOpStatus("Objek berhasil dihapus (bisa di-Undo).");
        } else {
            setOpStatus("Pilih objek dulu sebelum menghapus!");
        }
    };
}

const mirrorBtn = document.getElementById('mirror');
if (mirrorBtn) {
    mirrorBtn.onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        const p = S.selected.getPosition();
        S.selected.setPosition(-p.x, p.y, p.z);
        if (typeof syncTransformUI === 'function') syncTransformUI(S.selected);
        if (typeof saveState === 'function') saveState();
        setOpStatus("Mirror X: " + S.selected.name);
    };
}

const centerBtn = document.getElementById('center');
if (centerBtn) {
    centerBtn.onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        S.selected.setPosition(0, 1, 0);
        if (typeof syncTransformUI === 'function') syncTransformUI(S.selected);
        if (typeof saveState === 'function') saveState();
        setOpStatus("Center: " + S.selected.name);
    };
}

const newBtn = document.getElementById('btnNew');
if (newBtn) {
    newBtn.onclick = () => {
        const hasSkin = typeof hasAnySkinnedEntity === 'function' ? hasAnySkinnedEntity() : false;
        const msg = hasSkin
            ? "⚠ PERINGATAN!\n\nScene berisi model skinned. Menghapus semua akan menghilangkan skeleton PERMANEN.\n\nLanjutkan?"
            : "Hapus semua?";
        if (!confirm(msg)) return;
        S.objects.forEach(o => destroyEntity(o));
        if (typeof meshCachePool !== 'undefined' && meshCachePool && typeof meshCachePool.clear === 'function') {
            meshCachePool.clear();
        }
        S.objects = [];
        S.maxId = 1;
        if (typeof undoStack !== 'undefined') undoStack = [];
        if (typeof redoStack !== 'undefined') redoStack = [];
        if (typeof resetMode === 'function') resetMode();
        if (typeof selectObject === 'function') selectObject(null);
        setOpStatus("Scene baru dibuat.");
    };
}

logOp("=== operations.js DONE ===");
