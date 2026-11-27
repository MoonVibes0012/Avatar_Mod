/* ===== VTuber Forge — js/editing/bone.js ===== */
// Mode editing bone hierarchy (membedakan Joint Deformasi vs Node/Helper Hierarki)

(function () {
    'use strict';

    let currentScope = 'deform'; // 'deform' | 'all'

    function setBoneStatus(msg) {
        try {
            const el = document.getElementById('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    function getBoneState() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    function getSelectedRigData() {
        const st = getBoneState();
        if (!st || !st.selected) {
            return { hasSkinned: false, bones: [], helperNodes: [], bindPose: [], helperBindPose: [] };
        }

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
            helperNodes: [],
            bindPose: st.selected._bindPose || [],
            helperBindPose: []
        };
    }

    function getScopedEntries(rig) {
        const entries = [];
        if (!rig) return entries;
        for (let i = 0; i < rig.bones.length; i++) {
            entries.push({
                kind: 'deform',
                entity: rig.bones[i],
                bind: rig.bindPose[i] || null
            });
        }
        if (currentScope === 'all' && Array.isArray(rig.helperNodes)) {
            for (let j = 0; j < rig.helperNodes.length; j++) {
                entries.push({
                    kind: 'helper',
                    entity: rig.helperNodes[j],
                    bind: (rig.helperBindPose && rig.helperBindPose[j]) || null
                });
            }
        }
        return entries;
    }

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

    function ensureScopeSelectorUI(bonePanel, boneList) {
        if (!bonePanel || !boneList) return null;
        let wrap = document.getElementById('boneScopeWrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'boneScopeWrap';
            wrap.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;';
            wrap.innerHTML = [
                '<button type="button" id="btnBoneScopeDeform" style="flex:1;min-height:28px;padding:4px 6px;font-size:11px;">Joint Deformasi</button>',
                '<button type="button" id="btnBoneScopeAll" style="flex:1;min-height:28px;padding:4px 6px;font-size:11px;">+ Helper/Node</button>'
            ].join('');
            bonePanel.insertBefore(wrap, boneList.parentNode || boneList);
        }
        return wrap;
    }

    function populateBoneDropdown(rig) {
        const boneList = document.getElementById('boneList');
        const boneEditControls = document.getElementById('boneEditControls');
        if (!boneList) return;

        const entries = getScopedEntries(rig);
        if (boneEditControls) boneEditControls.style.display = 'none';

        const headerLabel = currentScope === 'all'
            ? `-- Pilih Joint (${rig.bones.length}) / Helper (${rig.helperNodes.length}) --`
            : `-- Pilih Joint Deformasi (${rig.bones.length}) --`;
        boneList.innerHTML = `<option value="">${headerLabel}</option>`;

        entries.forEach((item, index) => {
            const opt = document.createElement('option');
            opt.value = String(index);
            const rawName = (item.entity && item.entity.name) ? item.entity.name : `Node_${index}`;
            const tag = item.kind === 'deform' ? '[Joint] ' : '[Node/Helper] ';
            opt.textContent = tag + rawName;
            boneList.appendChild(opt);
        });

        const btnDeform = document.getElementById('btnBoneScopeDeform');
        const btnAll = document.getElementById('btnBoneScopeAll');
        if (btnDeform) {
            btnDeform.classList.toggle('on', currentScope === 'deform');
            btnDeform.style.borderColor = currentScope === 'deform' ? '#d946ef' : '';
            btnDeform.onclick = () => {
                currentScope = 'deform';
                populateBoneDropdown(getSelectedRigData());
            };
        }
        if (btnAll) {
            btnAll.classList.toggle('on', currentScope === 'all');
            btnAll.style.borderColor = currentScope === 'all' ? '#d946ef' : '';
            btnAll.onclick = () => {
                currentScope = 'all';
                populateBoneDropdown(getSelectedRigData());
            };
        }
    }

    function setupBoneEditing() {
        const st = getBoneState();
        if (!st || !st.selected) {
            setBoneStatus("⚠ Pilih objek dulu sebelum Edit Bone!");
            return;
        }
        const rig = getSelectedRigData();
        if (!rig.hasSkinned || rig.bones.length === 0) {
            setBoneStatus("⚠ Objek ini tidak memiliki joint deformasi (Bone).");
            return;
        }

        const bonePanel = document.getElementById('bonePanel');
        const boneEditControls = document.getElementById('boneEditControls');
        const boneList = document.getElementById('boneList');
        if (!bonePanel || !boneEditControls || !boneList) return;

        bonePanel.style.display = 'block';
        ensureScopeSelectorUI(bonePanel, boneList);
        populateBoneDropdown(rig);

        boneList.onchange = (e) => {
            const currentRig = getSelectedRigData();
            const entries = getScopedEntries(currentRig);

            const raw = e.target.value;
            if (raw === "") {
                boneEditControls.style.display = 'none';
                return;
            }
            const idx = parseInt(raw, 10);
            if (isNaN(idx) || idx < 0 || idx >= entries.length) {
                boneEditControls.style.display = 'none';
                return;
            }

            const entry = entries[idx];
            const bone = entry ? entry.entity : null;
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

            const kindLabel = entry.kind === 'deform' ? 'Joint deformasi' : 'Node/Helper';
            const updateBone = () => {
                const x = rxEl ? parseFloat(rxEl.value) : 0;
                const y = ryEl ? parseFloat(ryEl.value) : 0;
                const z = rzEl ? parseFloat(rzEl.value) : 0;
                bone.setLocalEulerAngles(
                    isFinite(x) ? x : 0,
                    isFinite(y) ? y : 0,
                    isFinite(z) ? z : 0
                );
                setBoneStatus("🦴 " + kindLabel + " '" + (bone.name || idx) + "' diubah.");
            };

            if (rxEl) rxEl.oninput = () => { if (rxO) rxO.textContent = rxEl.value; updateBone(); };
            if (ryEl) ryEl.oninput = () => { if (ryO) ryO.textContent = ryEl.value; updateBone(); };
            if (rzEl) rzEl.oninput = () => { if (rzO) rzO.textContent = rzEl.value; updateBone(); };
        };

        bindBoneControls();
        setBoneStatus(`🦴 ${rig.bones.length} joint deformasi & ${rig.helperNodes.length} node/helper terdeteksi.`);
    }
    window.setupBoneEditing = setupBoneEditing;

    function resetSelectedBonePose() {
        const st = getBoneState();
        if (!st || !st.selected) return;
        const rig = getSelectedRigData();
        const entries = getScopedEntries(rig);

        const boneList = document.getElementById('boneList');
        const idx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (isNaN(idx) || idx < 0 || idx >= entries.length) {
            setBoneStatus("⚠ Pilih bone/node dulu sebelum reset!");
            return;
        }

        const entry = entries[idx];
        const bp = entry.bind;
        const bone = entry.entity;
        if (!bp || !bone || typeof bone.setLocalEulerAngles !== 'function') return;

        bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
        syncBoneSlidersFromEuler(bp);
        setBoneStatus("✓ Bone/node di-reset ke bind pose.");
    }

    function resetAllBonesPose() {
        const st = getBoneState();
        if (!st || !st.selected) return;
        const rig = getSelectedRigData();

        rig.bones.forEach((bone, i) => {
            const bp = rig.bindPose[i];
            if (bp && bone && typeof bone.setLocalEulerAngles === 'function') {
                bone.setLocalEulerAngles(bp.x, bp.y, bp.z);
            }
        });
        rig.helperNodes.forEach((node, i) => {
            const bp = rig.helperBindPose[i];
            if (bp && node && typeof node.setLocalEulerAngles === 'function') {
                node.setLocalEulerAngles(bp.x, bp.y, bp.z);
            }
        });

        const entries = getScopedEntries(rig);
        const boneList = document.getElementById('boneList');
        const selectedIdx = boneList ? parseInt(boneList.value, 10) : NaN;
        if (!isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < entries.length && entries[selectedIdx].bind) {
            syncBoneSlidersFromEuler(entries[selectedIdx].bind);
        }

        setBoneStatus("✓ Semua joint & node di-reset ke bind pose.");
    }

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
