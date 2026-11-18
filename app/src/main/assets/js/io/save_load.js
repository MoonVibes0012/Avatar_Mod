/* ===== VTuber Forge — js/io/save_load.js ===== */
// Serialize scene, Save/Load JSON, Undo/Redo logic

const meshCachePool = new Map(); // name -> _meshCache

function hasAnySkinnedEntity() {
    return S.objects.some(o => {
        const render = o.findComponent('render');
        if (!render || !render.meshInstances) return false;
        return render.meshInstances.some(mi => mi.skinInstance != null);
    });
}

function stateHasSkeleton(stateStr) {
    try {
        const parsed = JSON.parse(stateStr);
        return parsed.some(d => d.hasSkeleton === true);
    } catch(e) { return false; }
}

function serializeScene(includeMeshData = true) {
    return JSON.stringify(S.objects.map(o => {
        try {
            if (!o || !o.getPosition) return null;
            let meshDataArr = [];
            if (includeMeshData && o._meshCache && Array.isArray(o._meshCache) && o._meshCache.length > 0) {
                meshDataArr = o._meshCache;
            }
            
            const safeVec = (v, def) => {
                if (!v) return def;
                if (typeof v.toArray === 'function') return v.toArray();
                if (Array.isArray(v) && v.length >= 3) return v.slice(0, 3);
                if (typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') return [v.x, v.y, v.z];
                return def;
            };
            
            let _mat = o.render?.material;
            if (Array.isArray(_mat)) _mat = _mat[0];
            const _hasTex = (_mat && _mat.diffuseMap !== null);
            const _col = _hasTex ? [0.5, 0.5, 0.5] : ((_mat && _mat.diffuse && typeof _mat.diffuse.toArray === 'function') ? _mat.diffuse.toArray() : [0.5, 0.5, 0.5]);
            
            let objType = o.render?.type || 'box';
            if (meshDataArr.length > 0) objType = 'custom';
            
            const hasSkeleton = o.findComponents('render').some(r =>
                r.meshInstances && r.meshInstances.some(mi => mi.skinInstance != null)
            );
            
            return {
                name: o.name || 'Obj',
                type: objType,
                pos: safeVec(o.getPosition(), [0, 0, 0]),
                rot: safeVec(o.getEulerAngles && o.getEulerAngles(), [0, 0, 0]),
                scale: safeVec(o.getLocalScale && o.getLocalScale(), [1, 1, 1]),
                color: _col,
                hasTex: _hasTex,
                hasSkeleton: hasSkeleton,
                rough: _mat?.gloss ?? 0.5,
                metal: _mat?.metalness ?? 0,
                meshDataArr: meshDataArr,
                hasMeshCache: !!(o._meshCache && o._meshCache.length > 0),
                animSpin: o._animSpin || false,
                animPulse: o._animPulse || false,
                animWobble: o._animWobble || false,
                baseScale: safeVec(o._baseScale, null),
                baseRot: safeVec(o._baseRot, null)
            };
        } catch (err) {
            dbg("WARNING: Gagal serialize objek " + (o?.name || '?') + " - " + err.message);
            return null;
        }
    }).filter(x => x !== null));
}

function saveState() {
    const state = serializeScene(false);
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === state) return;
    undoStack.push(state); 
    if (undoStack.length > CONFIG.MAX_UNDO) undoStack.shift(); 
    redoStack = [];
}

function loadState(stateStr) {
    $('loadingOverlay').style.display = 'flex'; 
    $('loadingText').textContent = "Memuat Scene...";
    
    setTimeout(() => {
        try {
            S.objects.forEach(o => destroyEntity(o)); 
            S.objects = []; 
            S.maxId = 1;
            
            const parsed = JSON.parse(stateStr);
            let maxFound = 1;
            parsed.forEach(d => {
                const m = (d.name || '').match(/-(\d+)$/);
                if (m) { const n = parseInt(m[1], 10); if (n >= maxFound) maxFound = n + 1; }
            });
            S.maxId = maxFound;
            
            let skippedSkinned = 0;
            let skippedMissingCache = 0;
            
            parsed.forEach(d => {
                try {
                    const e = new pc.Entity(d.name || "Obj");
                    const col = d.color || [0.5, 0.5, 0.5];
                    
                    if (d.meshDataArr && d.meshDataArr.length > 0) {
                        e.addComponent('render', { type: 'asset', castShadows: false });
                        let newMeshInstances = [];
                        d.meshDataArr.forEach(meshData => {
                            try {
                                const mesh = new pc.Mesh(app.graphicsDevice);
                                if (meshData.pos) mesh.setPositions(new Float32Array(meshData.pos));
                                if (meshData.idx) {
                                    if (meshData.idx.length > 65535) mesh.setIndices(new Uint32Array(meshData.idx));
                                    else mesh.setIndices(new Uint16Array(meshData.idx));
                                }
                                if (meshData.uvs) mesh.setUvs(0, new Float32Array(meshData.uvs));
                                if (meshData.normals) mesh.setNormals(new Float32Array(meshData.normals)); else mesh.calculateNormals();
                                mesh.update(pc.PRIMITIVE_TRIANGLES);
                                
                                const m = new pc.StandardMaterial(); 
                                m.diffuse = new pc.Color(col[0], col[1], col[2]); 
                                m.gloss = d.rough || 0.5; 
                                m.metalness = d.metal || 0; 
                                m.update();
                                
                                const mi = new pc.MeshInstance(mesh, m);
                                newMeshInstances.push(mi);
                            } catch(me) { dbg("Load meshData fail: " + me.message); }
                        });
                        e.render.meshInstances = newMeshInstances;
                        e._meshCache = d.meshDataArr;
                        meshCachePool.set(d.name, d.meshDataArr);
                        
                    } else if (d.hasMeshCache && meshCachePool.has(d.name)) {
                        e.addComponent('render', { type: 'asset', castShadows: false });
                        const cached = meshCachePool.get(d.name);
                        let newMeshInstances = [];
                        cached.forEach(meshData => {
                            try {
                                const mesh = new pc.Mesh(app.graphicsDevice);
                                if (meshData.pos) mesh.setPositions(new Float32Array(meshData.pos));
                                if (meshData.idx) {
                                    if (meshData.idx.length > 65535) mesh.setIndices(new Uint32Array(meshData.idx));
                                    else mesh.setIndices(new Uint16Array(meshData.idx));
                                }
                                if (meshData.uvs) mesh.setUvs(0, new Float32Array(meshData.uvs));
                                if (meshData.normals) mesh.setNormals(new Float32Array(meshData.normals)); else mesh.calculateNormals();
                                mesh.update(pc.PRIMITIVE_TRIANGLES);
                                
                                const m = new pc.StandardMaterial(); 
                                m.diffuse = new pc.Color(col[0], col[1], col[2]); 
                                m.gloss = d.rough || 0.5; 
                                m.metalness = d.metal || 0; 
                                m.update();
                                
                                newMeshInstances.push(new pc.MeshInstance(mesh, m));
                            } catch(me) { dbg("Load from pool fail: " + me.message); }
                        });
                        e.render.meshInstances = newMeshInstances;
                        e._meshCache = cached;
                        
                    } else if (d.hasMeshCache && !meshCachePool.has(d.name)) {
                        dbg("⚠ Mesh cache hilang untuk " + d.name + " — fallback ke primitive");
                        skippedMissingCache++;
                        const fallbackType = (d.type === 'custom' || !['box','sphere','cylinder','capsule'].includes(d.type)) ? 'box' : d.type;
                        e.addComponent('render', { type: fallbackType, castShadows: false });
                        const m = new pc.StandardMaterial(); 
                        m.diffuse = new pc.Color(col[0], col[1], col[2]); 
                        m.gloss = d.rough || 0.5; 
                        m.metalness = d.metal || 0; 
                        m.update(); 
                        e.render.material = m;
                        
                    } else if (d.hasSkeleton) {
                        dbg("⚠ Skinned entity di-skip (no cache): " + d.name);
                        skippedSkinned++;
                        return;
                        
                    } else if (['box', 'sphere', 'cylinder', 'capsule'].includes(d.type)) {
                        e.addComponent('render', { type: d.type, castShadows: false });
                        const m = new pc.StandardMaterial(); 
                        m.diffuse = new pc.Color(col[0], col[1], col[2]); 
                        m.gloss = d.rough || 0.5; 
                        m.metalness = d.metal || 0; 
                        m.update(); 
                        e.render.material = m;
                        
                    } else {
                        e.addComponent('render', { type: 'box', castShadows: false });
                        const m = new pc.StandardMaterial(); 
                        m.diffuse = new pc.Color(col[0], col[1], col[2]); 
                        m.gloss = d.rough || 0.5; 
                        m.metalness = d.metal || 0; 
                        m.update(); 
                        e.render.material = m;
                    }
                    
                    const p = d.pos || [0,0,0]; 
                    const r = d.rot || [0,0,0]; 
                    const s = d.scale || [1,1,1];
                    e.setPosition(p[0], p[1], p[2]); 
                    e.setEulerAngles(r[0], r[1], r[2]); 
                    e.setLocalScale(s[0], s[1], s[2]);
                    
                    e._animSpin = d.animSpin; 
                    e._animPulse = d.animPulse; 
                    e._animWobble = d.animWobble;
                    e._baseScale = e.getLocalScale().clone();
                    e._baseRot = e.getEulerAngles().clone();
                    
                    app.root.addChild(e); 
                    S.objects.push(e);
                } catch(err) { dbg("Gagal load objek: " + err.message); }
            });
            
            if (skippedSkinned > 0 || skippedMissingCache > 0) {
                const partsMsg = [];
                if (skippedSkinned > 0) partsMsg.push(skippedSkinned + " model skinned di-skip (perlu re-import)");
                if (skippedMissingCache > 0) partsMsg.push(skippedMissingCache + " mesh cache hilang (fallback ke primitive)");
                $('status').textContent = "⚠ " + partsMsg.join(" · ");
            }
            
            resetMode(); 
            selectObject(null);
        } catch (e) { 
            alert("JSON Invalid!"); 
        } finally { 
            $('loadingOverlay').style.display = 'none'; 
        }
    }, 50);
}

$('save').onclick = () => {
    if (typeof hasAnySkinnedEntity === 'function' && hasAnySkinnedEntity()) {
        if (!confirm("⚠ PENTING!\n\nModel skinned TIDAK BISA disimpan (batasan engine).\nSetelah Save, model skinned akan HILANG dari file JSON.\nPrimitives & model statis tetap tersimpan normal.\n\nLanjutkan Save?")) return;
    }
    if (!confirm("PENTING: File JSON hanya menyimpan bentuk/warna, tekstur gambar akan HILANG (menjadi warna solid). Lanjutkan?")) return;
    
    $('status').textContent = "Menyimpan...";
    setTimeout(() => {
        const dataStr = serializeScene(true);
        if (dataStr.length > 10 * 1024 * 1024) {
            $('status').textContent = "Gagal: Scene > 10 MB (batal disimpan).";
            return alert("Scene > 10 MB! Gagal save.");
        }
        downloadNative('vtuber_scene.json', dataStr, 'application/json');
        $('status').textContent = "Saved!";
    }, 100);
};

$('load').onclick = () => $('jsonFile').click();
$('jsonFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File > 10MB!"); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (typeof hasAnySkinnedEntity === 'function' && hasAnySkinnedEntity()) {
            if (!confirm("⚠ PENTING!\n\nModel skinned di scene akan HILANG setelah Load.\nFile JSON tidak menyimpan skeleton (batasan engine).\n\nLanjutkan?")) return;
        }
        try {
            saveState();
            loadState(ev.target.result);
            undoStack = [serializeScene()];
            redoStack = [];
        } catch(err) {
            alert("File JSON invalid.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// --- DIALOG UNDO/REDO JUJUR ---
$('undo').onclick = () => {
    if (undoStack.length <= 1) return;
    const targetState = undoStack[undoStack.length - 2];
    const currentHasSkin = hasAnySkinnedEntity();
    const targetHadSkin = stateHasSkeleton(targetState);
    
    if (currentHasSkin || targetHadSkin) {
        if (!confirm("⚠ PENTING!\n\nModel skinned akan HILANG dari scene setelah Undo (batasan engine).\nTidak bisa di-restore tanpa re-import file asli.\n\nLanjutkan?")) return;
    }
    
    redoStack.push(undoStack.pop());
    loadState(undoStack[undoStack.length - 1]);
    $('status').textContent = "Undo. Catatan: tekstur & skeleton tidak bisa di-restore.";
};

$('redo').onclick = () => {
    if (redoStack.length === 0) return;
    const targetState = redoStack[redoStack.length - 1];
    const currentHasSkin = hasAnySkinnedEntity();
    const targetHadSkin = stateHasSkeleton(targetState);
    
    if (currentHasSkin || targetHadSkin) {
        if (!confirm("⚠ PENTING!\n\nModel skinned akan HILANG dari scene setelah Redo (batasan engine).\nTidak bisa di-restore tanpa re-import file asli.\n\nLanjutkan?")) return;
    }
    
    const state = redoStack.pop();
    undoStack.push(state);
    loadState(state);
    $('status').textContent = "Redo. Catatan: tekstur & skeleton tidak bisa di-restore.";
};
