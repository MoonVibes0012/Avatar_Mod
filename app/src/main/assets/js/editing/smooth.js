/* ===== VTuber Forge — js/editing/smooth.js ===== */
// Algoritma smoothing mesh

$('smooth').onclick = () => {
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
        if (!pos || !idx || pos.length === 0) return;
        if (pos.length / 3 > 20000) return alert("Mesh terlalu besar untuk di-smooth (>20k vertex).");
        
        S.isSmoothing = true;
        $('status').textContent = "Memproses Smooth...";
        $('smooth').disabled = true;
        
        requestAnimationFrame(() => {
            try {
                const count = pos.length / 3;
                const nb = new Array(count);
                for (let i = 0; i < count; i++) nb[i] = new Set();
                for (let i = 0; i < idx.length; i += 3) {
                    const a = idx[i], b = idx[i+1], c = idx[i+2];
                    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
                }
                
                const newPos = new Float32Array(pos);
                for (let v = 0; v < count; v++) {
                    const set = nb[v]; if (set.size === 0) continue;
                    let ax = 0, ay = 0, az = 0;
                    set.forEach(n => { ax += pos[n*3]; ay += pos[n*3+1]; az += pos[n*3+2]; });
                    const inv = 1 / set.size;
                    newPos[v*3]   = pos[v*3]   * 0.5 + (ax * inv) * 0.5;
                    newPos[v*3+1] = pos[v*3+1] * 0.5 + (ay * inv) * 0.5;
                    newPos[v*3+2] = pos[v*3+2] * 0.5 + (az * inv) * 0.5;
                }
                
                mi.mesh.setPositions(newPos);
                mi.mesh.calculateNormals();
                mi.mesh.update(pc.PRIMITIVE_TRIANGLES);
                mi.aabb = pc.BoundingBox.fromMesh(mi.mesh);
                saveState();
                syncPrimaryMeshCache(targetEntity, mi.mesh);
                $('status').textContent = "Mesh smoothed: " + targetEntity.name;
            } catch(e) {
                dbg("Smooth error: " + e.message);
                $('status').textContent = "Smooth gagal: " + e.message;
            } finally {
                S.isSmoothing = false;
                $('smooth').disabled = false;
            }
        });
    } catch(e) {
        dbg("Smooth outer error: " + e.message);
        S.isSmoothing = false;
        $('smooth').disabled = false;
        $('status').textContent = "Smooth gagal: mesh compressed/korup.";
    }
};
