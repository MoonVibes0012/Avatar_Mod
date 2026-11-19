/* ===== VTuber Forge — js/editing/smooth.js ===== */
// Algoritma smoothing mesh

function setSmoothStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logSmooth(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function syncSmoothCacheSafe(entity, mesh) {
    if (typeof window.syncPrimaryMeshCache === 'function') {
        try {
            window.syncPrimaryMeshCache(entity, mesh);
            return;
        } catch (e) {
            logSmooth("syncPrimaryMeshCache warning: " + e.message);
        }
    }
    if (!entity || !mesh) return;
    try {
        const pos = mesh.getPositions ? mesh.getPositions() : null;
        const idx = mesh.getIndices ? mesh.getIndices() : null;
        const uvs = mesh.getUvs ? mesh.getUvs() : null;
        const nrm = mesh.getNormals ? mesh.getNormals() : null;
        if (pos && Array.isArray(entity._meshCache) && entity._meshCache.length > 0) {
            entity._meshCache[0] = {
                pos: Array.from(pos),
                idx: idx ? Array.from(idx) : [],
                uvs: uvs ? Array.from(uvs) : null,
                normals: nrm ? Array.from(nrm) : null
            };
        }
    } catch (e) {}
}

const smoothBtn = document.getElementById('smooth');
if (smoothBtn) {
    smoothBtn.onclick = () => {
        if (!S.selected) return alert("Pilih objek dulu!");
        if (S.isSmoothing) return;

        const renderComp = S.selected.findComponent('render');
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return;
        if (renderComp.meshInstances.some(mi => mi.skinInstance != null)) {
            return alert("Model dengan tulang (Skinned Mesh) tidak bisa di-smooth.");
        }

        const mi = renderComp.meshInstances[0];
        if (!mi || !mi.mesh) return;
        const targetEntity = S.selected;

        try {
            const pos = mi.mesh.getPositions();
            const idx = mi.mesh.getIndices();
            if (!pos || !idx || pos.length === 0 || idx.length < 3) return;
            const count = Math.floor(pos.length / 3);
            if (count > 20000) return alert("Mesh terlalu besar untuk di-smooth (>20k vertex).");

            S.isSmoothing = true;
            setSmoothStatus("Memproses Smooth...");
            smoothBtn.disabled = true;

            requestAnimationFrame(() => {
                try {
                    const nb = new Array(count);
                    for (let i = 0; i < count; i++) nb[i] = new Set();

                    const triLimit = idx.length - (idx.length % 3);
                    for (let i = 0; i < triLimit; i += 3) {
                        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
                        if (a < count && b < count && c < count) {
                            nb[a].add(b).add(c);
                            nb[b].add(a).add(c);
                            nb[c].add(a).add(b);
                        }
                    }

                    const newPos = new Float32Array(pos);
                    for (let v = 0; v < count; v++) {
                        const set = nb[v];
                        if (!set || set.size === 0) continue;
                        let ax = 0, ay = 0, az = 0;
                        set.forEach(n => {
                            ax += pos[n * 3] || 0;
                            ay += pos[n * 3 + 1] || 0;
                            az += pos[n * 3 + 2] || 0;
                        });
                        const inv = 1 / set.size;
                        newPos[v * 3] = (pos[v * 3] || 0) * 0.5 + (ax * inv) * 0.5;
                        newPos[v * 3 + 1] = (pos[v * 3 + 1] || 0) * 0.5 + (ay * inv) * 0.5;
                        newPos[v * 3 + 2] = (pos[v * 3 + 2] || 0) * 0.5 + (az * inv) * 0.5;
                    }

                    mi.mesh.setPositions(newPos);
                    if (typeof mi.mesh.calculateNormals === 'function') {
                        mi.mesh.calculateNormals();
                    }
                    mi.mesh.update(pc.PRIMITIVE_TRIANGLES);
                    if (typeof pc.BoundingBox !== 'undefined') {
                        mi.aabb = pc.BoundingBox.fromMesh(mi.mesh);
                    }
                    if (typeof saveState === 'function') saveState();
                    syncSmoothCacheSafe(targetEntity, mi.mesh);
                    setSmoothStatus("Mesh smoothed: " + (targetEntity.name || "Objek"));
                } catch (e) {
                    logSmooth("Smooth error: " + e.message);
                    setSmoothStatus("Smooth gagal: " + e.message);
                } finally {
                    S.isSmoothing = false;
                    smoothBtn.disabled = false;
                }
            });
        } catch (e) {
            logSmooth("Smooth outer error: " + e.message);
            S.isSmoothing = false;
            smoothBtn.disabled = false;
            setSmoothStatus("Smooth gagal: mesh compressed/korup.");
        }
    };
}
