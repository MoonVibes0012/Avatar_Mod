/* ===== VTuber Forge — js/editing/bone.js ===== */
// Mode editing bone hierarchy (mendukung multi-render VRM/GLB & bind pose awal)

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
     * Mengumpulkan seluruh rig (bones & bindPose) dari hierarki objek terpilih.
     */
    function getSelectedRigData() {
        const st = getBoneState();
        if (!st || !st.selected) return { hasSkinned: false, bones: [], bindPose: [] };

        if (typeof window.collectRigFromEntity === 'function') {
            return window.collectRigFromEntity(st.selected, false);
        }

        const renders = typeof st.selected.findComponents === 'function'
            ? (st.selected.findComponents('render') || [])
            : (st.selected.render ? [st.selected.render] : []);
        const seen = new Set();
        const bones = [];
        renders.forEach((rc) => {
            if (!rc || !Array.isArray(rc.meshInstances)) return;
            rc.meshInstances.forEach((mi) => {
                if (mi && mi.skinInstance && Array.isArray(mi.skinInstance.bones)) {
                    mi.skinInstance.bones.forEach((b) => {
                        if (b && !seen.has(b)) {
                            seen.add(b);
                            bones.push(b);
                        }
                    });
                }
            });
        });

        if (bones.length > 0 && (!Array.isArray(st.selected._bindPose) || st.selected._bindPose.length !== bones.length)) {
            st.selected._bindPose = bones.map((b) => {
                const r = b.getLocalEulerAngles ? b.getLocalEulerAngles() : { x: 0, y: 0, z: 0 };
                return { x: Number(r.x) || 0, y: Number(r.y) || 0, z: Number(r.z) || 0 };
            });
        }

        return {
            hasSkinned: bones.length > 0,
            bones: bones,
            bindPose: st.selected._bindPose || []
        };
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
     * Membuka panel editor tulang dan mengisi daftar bone unik dari seluruh hierarki model terpilih.
     */
    function setupBoneEditing() {
        const st = getBoneState();
        if (!st || !st.selected) {
            setBoneStatus("⚠ Pilih objek dulu sebelum Edit Bone!");
            return;
        }
        const rig = getSelectedRigData();
        if (!rig.hasSkinned || rig.bones.length === 0) {
            setBoneStatus("⚠ Objek ini tidak memiliki tulang (Bone).");
            return;
        }

        const bonePanel = document.getElementById('bonePanel');
        const boneEditControls = document.getElementById('boneEditControls');
        const boneList = document.getElementById('boneList');
        if (!bonePanel || !boneEditControls || !boneList) return;

        bonePanel.style.display = 'block';
        boneEditControls.style.display = 'none';

        boneList.innerHTML = '<option value="">-- Pilih Tulang (' + rig.bones.length + ') --</option>';
        rig.bones.forEach((boneEntity, index) => {
            const opt = document.createElement('option');
            opt.value = String(index);
            opt.textContent = (boneEntity && boneEntity.name) ? boneEntity.name : `Bone_${index}`;
            boneList.appendChild(opt);
        });

        boneList.onchange = (e) => {
            const currentRig = getSelectedRigData();
            if (!currentRig.hasSkinned) return;

            const raw = e.target.value;
            if (raw === "") {
                boneEditControls.style.display = 'none';
                return;
            }
            const idx = parseInt(raw, 10);
            if (isNaN(idx) || idx < 0 || idx >= currentRig.bones.length) {
                boneEditControls.style.display = 'none';
                return;
            }

            const bone = currentRig.bones[idx];
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
                setBoneStatus("🦴 Bone '" + (bone.name || idx) + "' diubah.");
            };

            if (rxEl) rxEl.oninput = () => { if (rxO) rxO.textContent = rxEl.value; updateBone(); };
            if (ryEl) ryEl.oninput = () => { if (ryO) ryO.textContent = ryEl.value; updateBone(); };
            if (rzEl) rzEl.oninput = () => { if (rzO) rzO.textContent = rzEl.value; updateBone(); };
        };

        bindBoneControls();
        setBoneStatus("🦴 " + rig.bones.length + " tulang terdeteksi — pilih dari daftar.");
    }
    window.setupBoneEditing = setupBoneEditing;

    /**
     * Mengembalikan rotasi tulang yang sedang dipilih ke bind pose awal.
     */
    function resetSelectedBonePose() {
        const st = getBoneState();
        if (!st || !st.selected) return;
        const rig = getSelectedRigData();
        if (!rig.hasSkinned) return;

        const boneList = document.getElementById('boneList');
        const idx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (isNaN(idx) || idx < 0 || idx >= rig.bones.length) {
            setBoneStatus("⚠ Pilih bone dulu sebelum reset!");
            return;
        }

        const bp = rig.bindPose[idx];
        const bone = rig.bones[idx];
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
        if (!st || !st.selected) return;
        const rig = getSelectedRigData();
        if (!rig.hasSkinned) return;

        rig.bones.forEach((bone, i) => {
            const bp = rig.bindPose[i];
            if (bp && bone && typeof bone.setLocalEulerAngles === 'function') {
                bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
            }
        });

        const boneList = document.getElementById('boneList');
        const selectedIdx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (!isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < rig.bindPose.length) {
            syncBoneSlidersFromEuler(rig.bindPose[selectedIdx]);
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
