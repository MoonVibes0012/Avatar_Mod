/* ===== VTuber Forge — js/editing/bone.js ===== */
// Mode editing bone hierarchy

function setBoneStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function getSelectedSkinInstance() {
    if (!S.selected || typeof S.selected.findComponent !== 'function') return null;
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return null;
    for (const mi of renderComp.meshInstances) {
        if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
            return mi.skinInstance;
        }
    }
    return null;
}

function setupBoneEditing() {
    if (!S.selected) return alert("Pilih objek dulu!");
    const skin = getSelectedSkinInstance();
    if (!skin) {
        return alert("Objek ini tidak memiliki tulang (Bone).\n\nImport model VRM/GLB yang memiliki skeletal mesh.");
    }

    if (!Array.isArray(S.selected._bindPose) || S.selected._bindPose.length < skin.bones.length) {
        S.selected._bindPose = skin.bones.map(b => {
            const rot = (b && typeof b.getLocalEulerAngles === 'function')
                ? b.getLocalEulerAngles()
                : { x: 0, y: 0, z: 0 };
            return (rot && typeof rot.clone === 'function')
                ? rot.clone()
                : { x: rot.x || 0, y: rot.y || 0, z: rot.z || 0 };
        });
    }

    const bonePanel = document.getElementById('bonePanel');
    const boneEditControls = document.getElementById('boneEditControls');
    const boneList = document.getElementById('boneList');
    if (!bonePanel || !boneEditControls || !boneList) return;

    bonePanel.style.display = 'block';
    boneEditControls.style.display = 'none';

    boneList.innerHTML = '<option value="">-- Pilih Tulang --</option>';
    skin.bones.forEach((boneEntity, index) => {
        const opt = document.createElement('option');
        opt.value = String(index);
        opt.textContent = (boneEntity && boneEntity.name) ? boneEntity.name : `Bone_${index}`;
        boneList.appendChild(opt);
    });

    boneList.onchange = (e) => {
        const currentSkin = getSelectedSkinInstance();
        if (!currentSkin) return;

        const raw = e.target.value;
        if (raw === "") {
            boneEditControls.style.display = 'none';
            return;
        }
        const idx = parseInt(raw, 10);
        if (isNaN(idx) || idx < 0 || idx >= currentSkin.bones.length) {
            boneEditControls.style.display = 'none';
            return;
        }

        const bone = currentSkin.bones[idx];
        if (!bone || typeof bone.getLocalEulerAngles !== 'function' || typeof bone.setLocalEulerAngles !== 'function') {
            boneEditControls.style.display = 'none';
            return;
        }

        boneEditControls.style.display = 'block';
        const rot = bone.getLocalEulerAngles();
        const rxEl = document.getElementById('bRx');
        const ryEl = document.getElementById('bRy');
        const rzEl = document.getElementById('bRz');
        const rxO = document.getElementById('bRxO');
        const ryO = document.getElementById('bRyO');
        const rzO = document.getElementById('bRzO');

        if (rxEl) rxEl.value = rot.x;
        if (ryEl) ryEl.value = rot.y;
        if (rzEl) rzEl.value = rot.z;
        if (rxO) rxO.textContent = Number(rot.x || 0).toFixed(0);
        if (ryO) ryO.textContent = Number(rot.y || 0).toFixed(0);
        if (rzO) rzO.textContent = Number(rot.z || 0).toFixed(0);

        const updateBone = () => {
            const x = rxEl ? parseFloat(rxEl.value) : 0;
            const y = ryEl ? parseFloat(ryEl.value) : 0;
            const z = rzEl ? parseFloat(rzEl.value) : 0;
            bone.setLocalEulerAngles(
                isFinite(x) ? x : 0,
                isFinite(y) ? y : 0,
                isFinite(z) ? z : 0
            );
            setBoneStatus("⚠ Bone diubah (preview). Save/Undo/Dup akan reset ke T-pose.");
        };

        if (rxEl) rxEl.oninput = () => { if (rxO) rxO.textContent = rxEl.value; updateBone(); };
        if (ryEl) ryEl.oninput = () => { if (ryO) ryO.textContent = ryEl.value; updateBone(); };
        if (rzEl) rzEl.oninput = () => { if (rzO) rzO.textContent = rzEl.value; updateBone(); };
    };
}
window.setupBoneEditing = setupBoneEditing;

const resetBoneBtn = document.getElementById('resetBone');
if (resetBoneBtn) {
    resetBoneBtn.onclick = () => {
        if (!S.selected || !Array.isArray(S.selected._bindPose)) return;
        const skin = getSelectedSkinInstance();
        if (!skin) return;

        const boneList = document.getElementById('boneList');
        const idx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (isNaN(idx) || idx < 0 || idx >= skin.bones.length) return alert("Pilih bone dulu!");

        const bp = S.selected._bindPose[idx];
        const bone = skin.bones[idx];
        if (!bp || !bone || typeof bone.setLocalEulerAngles !== 'function') return;

        bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
        const rxEl = document.getElementById('bRx');
        const ryEl = document.getElementById('bRy');
        const rzEl = document.getElementById('bRz');
        const rxO = document.getElementById('bRxO');
        const ryO = document.getElementById('bRyO');
        const rzO = document.getElementById('bRzO');
        if (rxEl) rxEl.value = bp.x;
        if (ryEl) ryEl.value = bp.y;
        if (rzEl) rzEl.value = bp.z;
        if (rxO) rxO.textContent = Number(bp.x || 0).toFixed(0);
        if (ryO) ryO.textContent = Number(bp.y || 0).toFixed(0);
        if (rzO) rzO.textContent = Number(bp.z || 0).toFixed(0);
        setBoneStatus("Bone di-reset ke bind pose.");
    };
}

const resetAllBonesBtn = document.getElementById('resetAllBones');
if (resetAllBonesBtn) {
    resetAllBonesBtn.onclick = () => {
        if (!S.selected || !Array.isArray(S.selected._bindPose)) return;
        const skin = getSelectedSkinInstance();
        if (!skin) return;

        skin.bones.forEach((bone, i) => {
            const bp = S.selected._bindPose[i];
            if (bp && bone && typeof bone.setLocalEulerAngles === 'function') {
                bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
            }
        });
        setBoneStatus("Semua bone di-reset ke bind pose (safe).");
    };
}
