/* ===== VTuber Forge — js/editing/bone.js ===== */
// Mode editing bone hierarchy & re-binding tombol reset bone

(function () {
    'use strict';

    /**
     * Memperbarui teks status pada bar status aplikasi jika elemen tersedia.
     */
    function setBoneStatus(msg) {
        try {
            const el = document.getElementById('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Mengambil state scene global `S` secara aman.
     */
    function getBoneState() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    /**
     * Mengambil skinInstance pertama dari komponen render objek terpilih.
     */
    function getSelectedSkinInstance() {
        const st = getBoneState();
        if (!st || !st.selected || typeof st.selected.findComponent !== 'function') return null;
        const renderComp = st.selected.findComponent('render');
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return null;
        for (const mi of renderComp.meshInstances) {
            if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                return mi.skinInstance;
            }
        }
        return null;
    }

    /**
     * Menyinkronkan nilai slider dan label sudut rotasi bone pada UI.
     */
    function syncBoneSlidersFromEuler(rot) {
        const rxEl = document.getElementById('bRx');
        const ryEl = document.getElementById('bRy');
        const rzEl = document.getElementById('bRz');
        const rxO = document.getElementById('bRxO');
        const ryO = document.getElementById('bRyO');
        const rzO = document.getElementById('bRzO');

        const x = (rot && isFinite(Number(rot.x))) ? Number(rot.x) : 0;
        const y = (rot && isFinite(Number(rot.y))) ? Number(rot.y) : 0;
        const z = (rot && isFinite(Number(rot.z))) ? Number(rot.z) : 0;

        if (rxEl) rxEl.value = String(x);
        if (ryEl) ryEl.value = String(y);
        if (rzEl) rzEl.value = String(z);
        if (rxO) rxO.textContent = x.toFixed(0);
        if (ryO) ryO.textContent = y.toFixed(0);
        if (rzO) rzO.textContent = z.toFixed(0);
    }

    /**
     * Membuka panel editor tulang dan mengisi daftar bone dari model terpilih.
     */
    function setupBoneEditing() {
        const st = getBoneState();
        if (!st || !st.selected) {
            setBoneStatus("⚠ Pilih objek dulu sebelum Edit Bone!");
            return;
        }
        const skin = getSelectedSkinInstance();
        if (!skin) {
            setBoneStatus("⚠ Objek ini tidak memiliki tulang (Bone).");
            return;
        }

        if (!Array.isArray(st.selected._bindPose) || st.selected._bindPose.length < skin.bones.length) {
            st.selected._bindPose = skin.bones.map(b => {
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
            syncBoneSlidersFromEuler(rot);

            const rxEl = document.getElementById('bRx');
            const ryEl = document.getElementById('bRy');
            const rzEl = document.getElementById('bRz');
            const rxO = document.getElementById('bRxO');
            const ryO = document.getElementById('bRyO');
            const rzO = document.getElementById('bRzO');

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

        bindBoneControls();
        setBoneStatus("🦴 Pilih tulang dari daftar untuk mengatur rotasinya.");
    }
    window.setupBoneEditing = setupBoneEditing;

    /**
     * Mengembalikan rotasi tulang yang sedang dipilih ke bind pose awal.
     */
    function resetSelectedBonePose() {
        const st = getBoneState();
        if (!st || !st.selected || !Array.isArray(st.selected._bindPose)) return;
        const skin = getSelectedSkinInstance();
        if (!skin) return;

        const boneList = document.getElementById('boneList');
        const idx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (isNaN(idx) || idx < 0 || idx >= skin.bones.length) {
            setBoneStatus("⚠ Pilih bone dulu sebelum reset!");
            return;
        }

        const bp = st.selected._bindPose[idx];
        const bone = skin.bones[idx];
        if (!bp || !bone || typeof bone.setLocalEulerAngles !== 'function') return;

        bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
        syncBoneSlidersFromEuler(bp);
        setBoneStatus("✓ Bone di-reset ke bind pose.");
    }

    /**
     * Mengembalikan seluruh tulang model terpilih ke bind pose awal.
     */
    function resetAllBonesPose() {
        const st = getBoneState();
        if (!st || !st.selected || !Array.isArray(st.selected._bindPose)) return;
        const skin = getSelectedSkinInstance();
        if (!skin) return;

        skin.bones.forEach((bone, i) => {
            const bp = st.selected._bindPose[i];
            if (bp && bone && typeof bone.setLocalEulerAngles === 'function') {
                bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
            }
        });

        const boneList = document.getElementById('boneList');
        const selectedIdx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (!isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < st.selected._bindPose.length) {
            syncBoneSlidersFromEuler(st.selected._bindPose[selectedIdx]);
        }

        setBoneStatus("✓ Semua bone di-reset ke bind pose.");
    }

    /**
     * Menghubungkan tombol Edit Bone, Reset Bone, dan Reset All Bones setelah panel dirender.
     */
    function bindBoneControls() {
        try {
            const editBoneBtn = document.getElementById('btnEditBone');
            if (editBoneBtn) {
                editBoneBtn.onclick = setupBoneEditing;
            }

            const resetBoneBtn = document.getElementById('resetBone');
            if (resetBoneBtn) {
                resetBoneBtn.onclick = resetSelectedBonePose;
            }

            const resetAllBonesBtn = document.getElementById('resetAllBones');
            if (resetAllBonesBtn) {
                resetAllBonesBtn.onclick = resetAllBonesPose;
            }
        } catch (e) {
            setBoneStatus("⚠ Gagal bind kontrol bone: " + e.message);
        }
    }

    bindBoneControls();
    window.__vtfBindBoneControls = bindBoneControls;
})();
