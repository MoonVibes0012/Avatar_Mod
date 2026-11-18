/* ===== VTuber Forge — js/editing/bone.js ===== */
// Mode editing bone hierarchy

function setupBoneEditing() {
    if (!S.selected) return alert("Pilih objek dulu!");
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return;
    
    let skin = null;
    for (const mi of renderComp.meshInstances) {
        if (mi.skinInstance) { skin = mi.skinInstance; break; }
    }
    
    if (!skin) return alert("Objek ini tidak memiliki tulang (Bone).\n\nImport model VRM/GLB yang memiliki skeletal mesh.");
    
    if (!S.selected._bindPose) {
        S.selected._bindPose = skin.bones.map(b => b.getLocalEulerAngles().clone());
    }
    
    $('bonePanel').style.display = 'block';
    $('boneEditControls').style.display = 'none';
    
    const boneList = $('boneList');
    boneList.innerHTML = '<option value="">-- Pilih Tulang --</option>';
    skin.bones.forEach((boneEntity, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = boneEntity.name || `Bone_${index}`;
        boneList.appendChild(opt);
    });
    
    boneList.onchange = (e) => {
        const idx = e.target.value;
        if (idx === "") {
            $('boneEditControls').style.display = 'none';
            return;
        }
        $('boneEditControls').style.display = 'block';
        const bone = skin.bones[idx];
        const rot = bone.getLocalEulerAngles();
        $('bRx').value = rot.x; $('bRxO').textContent = rot.x.toFixed(0);
        $('bRy').value = rot.y; $('bRyO').textContent = rot.y.toFixed(0);
        $('bRz').value = rot.z; $('bRzO').textContent = rot.z.toFixed(0);
        
        const updateBone = () => {
            bone.setLocalEulerAngles(
                parseFloat($('bRx').value),
                parseFloat($('bRy').value),
                parseFloat($('bRz').value)
            );
            $('status').textContent = "⚠ Bone diubah (preview). Save/Undo/Dup akan reset ke T-pose.";
        };
        
        $('bRx').oninput = () => { $('bRxO').textContent = $('bRx').value; updateBone(); };
        $('bRy').oninput = () => { $('bRyO').textContent = $('bRy').value; updateBone(); };
        $('bRz').oninput = () => { $('bRzO').textContent = $('bRz').value; updateBone(); };
    };
}

$('resetBone').onclick = () => {
    if (!S.selected || !S.selected._bindPose) return;
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances) return;
    let skin = null;
    for (const mi of renderComp.meshInstances) {
        if (mi.skinInstance) { skin = mi.skinInstance; break; }
    }
    if (!skin) return;
    const idx = parseInt($('boneList').value);
    if (isNaN(idx)) return alert("Pilih bone dulu!");
    const bp = S.selected._bindPose[idx];
    skin.bones[idx].setLocalEulerAngles(bp.x, bp.y, bp.z);
    $('bRx').value = bp.x; $('bRxO').textContent = bp.x.toFixed(0);
    $('bRy').value = bp.y; $('bRyO').textContent = bp.y.toFixed(0);
    $('bRz').value = bp.z; $('bRzO').textContent = bp.z.toFixed(0);
    $('status').textContent = "Bone di-reset ke bind pose.";
};

$('resetAllBones').onclick = () => {
    if (!S.selected || !S.selected._bindPose) return;
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances) return;
    let skin = null;
    for (const mi of renderComp.meshInstances) {
        if (mi.skinInstance) { skin = mi.skinInstance; break; }
    }
    if (!skin) return;
    skin.bones.forEach((bone, i) => {
        const bp = S.selected._bindPose[i];
        bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
    });
    $('status').textContent = "Semua bone di-reset ke bind pose (safe).";
};
