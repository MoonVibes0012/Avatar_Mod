/* ===== VTuber Forge — js/editing/smooth.js ===== */
// Algoritma smoothing mesh

(function () {
    'use strict';

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

    function syncSmoothCacheSafe(entity, mesh, miIndex) {
        if (typeof window.syncPrimaryMeshCache === 'function') {
            try {
                window.syncPrimaryMeshCache(entity, mesh, miIndex);
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
            const targetSlot = (typeof miIndex === 'number' && miIndex >= 0) ? miIndex : 0;
            if (pos && Array.isArray(entity._meshCache) && entity._meshCache[targetSlot]) {
                entity._meshCache[targetSlot] = {
                    pos: Array.from(pos),
                    idx: idx ? Array.from(idx) : [],
                    uvs: uvs ? Array.from(uvs) : null,
                    normals: nrm ? Array.from(nrm) : null
                };
            }
        } catch (e) {}
    }

    function smoothSingleMesh(mesh, mi, maxVerts) {
        if (!mesh || !mesh.getPositions || !mesh.getIndices) return false;
        const pos = mesh.getPositions();
        const idx = mesh.getIndices();
        if (!pos || !idx || pos.length === 0 || idx.length < 3) return false;

        const count = Math.floor(pos.length / 3);
        if (count <= 0) return false;
        if (count > maxVerts) {
            throw new Error("Mesh terlalu besar untuk di-smooth (" + count + " > " + maxVerts + " vertex).");
        }

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

        mesh.setPositions(newPos);
        if (typeof mesh.calculateNormals === 'function') {
            mesh.calculateNormals();
        }
        mesh.update(pc.PRIMITIVE_TRIANGLES);
        if (mi && typeof pc.BoundingBox !== 'undefined') {
            mi.aabb = pc.BoundingBox.fromMesh(mesh);
        }
        return true;
    }

    const smoothBtn = document.getElementById('smooth');
    if (smoothBtn) {
        smoothBtn.onclick = () => {
            if (!S.selected || typeof S.selected.findComponent !== 'function') return alert("Pilih objek dulu!");
            if (S.isSmoothing) return;

            const renderComp = S.selected.findComponent('render');
            if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return;
            if (renderComp.meshInstances.some(mi => mi && mi.skinInstance != null)) {
                return alert("Model dengan tulang (Skinned Mesh) tidak bisa di-smooth.");
            }

            const validInstances = renderComp.meshInstances.filter(mi => mi && mi.mesh);
            if (validInstances.length === 0) return;

            const maxVerts = (typeof window.CONFIG !== 'undefined' && window.CONFIG && window.CONFIG.MAX_SMOOTH_VERTEX)
                ? window.CONFIG.MAX_SMOOTH_VERTEX
                : 20000;

            try {
                for (let i = 0; i < validInstances.length; i++) {
                    const m = validInstances[i].mesh;
                    const pos = m.getPositions ? m.getPositions() : null;
                    const idx = m.getIndices ? m.getIndices() : null;
                    if (!pos || !idx || pos.length === 0 || idx.length < 3) {
                        throw new Error("Mesh data kosong atau compressed (Draco).");
                    }
                    const count = Math.floor(pos.length / 3);
                    if (count > maxVerts) {
                        return alert("Mesh terlalu besar untuk di-smooth (>" + maxVerts + " vertex).");
                    }
                }

                S.isSmoothing = true;
                setSmoothStatus("Memproses Smooth...");
                smoothBtn.disabled = true;
                const targetEntity = S.selected;

                requestAnimationFrame(() => {
                    try {
                        let smoothedCount = 0;
                        validInstances.forEach((mi, idxSlot) => {
                            if (smoothSingleMesh(mi.mesh, mi, maxVerts)) {
                                smoothedCount++;
                                syncSmoothCacheSafe(targetEntity, mi.mesh, idxSlot);
                            }
                        });

                        if (smoothedCount > 0) {
                            if (typeof saveState === 'function') saveState();
                            setSmoothStatus("Mesh smoothed (" + smoothedCount + " part): " + (targetEntity.name || "Objek"));
                        } else {
                            setSmoothStatus("Tidak ada mesh yang dapat di-smooth.");
                        }
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
})();
