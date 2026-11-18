/* ===== VTuber Forge — js/editing/vertex.js ===== */
// Mode editing vertex

let currentMesh = null, currentPositions = null, currentMeshInstance = null;

function setupVertexEditing() {
    if (!S.selected) return;
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return;
    
    const hasAnySkinned = renderComp.meshInstances.some(mi => mi.skinInstance != null);
    if (hasAnySkinned) {
        alert("Mode Vertex Edit tidak tersedia untuk model dengan tulang (Skinned Mesh).\n\nGunakan Mode Bone untuk menggerakkan karakter.");
        resetMode();
        return;
    }
    
    currentMeshInstance = renderComp.meshInstances[0];
    currentMesh = currentMeshInstance.mesh;
    if (!currentMesh) return;
    
    try {
        currentPositions = currentMesh.getPositions();
        if (!currentPositions || currentPositions.length === 0) {
            throw new Error("Mesh data kosong atau compressed (Draco).");
        }
        
        const numVertices = currentPositions.length / 3;
        if (numVertices > 5000) {
            alert('Mesh ini memiliki ' + numVertices + ' vertex. Mode Vertex Edit dibatasi maksimal 5000 vertex agar HP tidak hang.');
            resetMode();
            return;
        }
        
        $('vi').max = numVertices - 1; $('vi').value = 0;
        
        const updateSliderValues = () => {
            if (!currentPositions) return;
            const idx = parseInt($('vi').value) || 0; $('viO').textContent = idx;
            const x = currentPositions[idx * 3], y = currentPositions[idx * 3 + 1], z = currentPositions[idx * 3 + 2];
            $('vx').value = x; $('vxo').textContent = x.toFixed(2);
            $('vy').value = y; $('vyo').textContent = y.toFixed(2);
            $('vz').value = z; $('vzo').textContent = z.toFixed(2);
        };
        
        $('vi').oninput = updateSliderValues; updateSliderValues();
        
        const updateMesh = () => {
            try {
                if (!currentMesh || !currentPositions) return;
                const idx = parseInt($('vi').value) || 0;
                let nx = parseFloat($('vx').value); if(!isFinite(nx)) nx = 0;
                let ny = parseFloat($('vy').value); if(!isFinite(ny)) ny = 0;
                let nz = parseFloat($('vz').value); if(!isFinite(nz)) nz = 0;
                
                currentPositions[idx * 3] = nx;
                currentPositions[idx * 3 + 1] = ny;
                currentPositions[idx * 3 + 2] = nz;
                
                currentMesh.setPositions(currentPositions);
                currentMesh.calculateNormals();
                currentMesh.update(pc.PRIMITIVE_TRIANGLES);
                currentMeshInstance.aabb = pc.BoundingBox.fromMesh(currentMesh);
                syncPrimaryMeshCache(S.selected, currentMesh);
            } catch(e) {
                dbg("updateMesh error: " + e.message);
                $('status').textContent = "⚠ Edit vertex gagal: " + e.message;
            }
        };
        
        $('vx').onchange = () => { updateMesh(); saveState(); };
        $('vy').onchange = () => { updateMesh(); saveState(); };
        $('vz').onchange = () => { updateMesh(); saveState(); };
        
    } catch (err) {
        dbg("Vertex edit gagal: " + err.message);
        $('status').textContent = "⚠ Mesh compressed/korup — tidak bisa edit vertex.";
        resetMode();
    }
}
