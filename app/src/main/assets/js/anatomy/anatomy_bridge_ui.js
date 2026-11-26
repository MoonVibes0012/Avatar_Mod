/* ===== VTuber Forge — js/anatomy/anatomy_bridge_ui.js ===== */
// Integrasi kontrol Anatomi, Preset Pose, Pose Kustom, & Diagnostik ke panel UI

(function () {
    'use strict';

    let anatomyActive = false;
    let lastWatchedRoot = null;

    /**
     * Mengambil elemen DOM berdasarkan ID secara aman.
     */
    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            return null;
        }
    }

    /**
     * Memperbarui teks status pada elemen #status jika tersedia.
     */
    function setAnatomyStatus(msg) {
        try {
            const el = byId('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Mencatat snapshot undo/redo secara aman setelah perubahan pose.
     */
    function commitHistorySafe() {
        if (typeof window.saveState === 'function') {
            try { window.saveState(); } catch (e) {}
            return;
        }
        try {
            if (typeof saveState === 'function') saveState();
        } catch (e) {}
    }

    /**
     * Mengambil entitas model yang sedang terpilih pada state global S.
     */
    function getCurrentModelEntity() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) {
            return window.S.selected;
        }
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    /**
     * Mengekstrak dan menyinkronkan peta bagian anatomi dari model terpilih ke AnatomySolver.
     */
    function refreshModelAnatomy(force) {
        if (!window.VrmPartExtractor || !window.AnatomySolver) return null;
        const model = getCurrentModelEntity();
        if (!model) {
            if (lastWatchedRoot !== null) {
                lastWatchedRoot = null;
                window.AnatomySolver.setRecord(null);
                populatePartSelector(null);
            }
            return null;
        }

        if (force || model !== lastWatchedRoot) {
            lastWatchedRoot = model;
            const rec = window.VrmPartExtractor.extract(model, !!force);
            window.AnatomySolver.setRecord(rec);
            populatePartSelector(rec);
            return rec;
        }
        return window.AnatomySolver.getRecord();
    }

    /**
     * Mengisi opsi dropdown bagian anatomi berdasarkan record model aktif.
     */
    function populatePartSelector(record) {
        const sel = byId('anatPartSelect');
        if (!sel) return;
        const prevVal = sel.value;
        sel.textContent = '';

        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = '-- Pilih Bagian Anatomi --';
        sel.appendChild(defOpt);

        if (!record || !record.parts || !window.AnatomyRegistry) return;
        const ids = Object.keys(record.parts);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const info = window.AnatomyRegistry.getPartDef(id);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = (info && info.label) ? info.label : id;
            sel.appendChild(opt);
        }

        if (prevVal && record.parts[prevVal]) {
            sel.value = prevVal;
        }
    }

    /**
     * Memperbarui daftar opsi pose kustom dari AnatomyPoses ke dropdown panel.
     */
    function refreshCustomPoseSelect() {
        const sel = byId('anatCustomPoseSelect');
        if (!sel) return;
        const prev = sel.value;
        sel.textContent = '';

        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = '-- Pose Kustom --';
        sel.appendChild(defOpt);

        if (window.AnatomyPoses && typeof window.AnatomyPoses.listCustomPoses === 'function') {
            const names = window.AnatomyPoses.listCustomPoses();
            for (let i = 0; i < names.length; i++) {
                const opt = document.createElement('option');
                opt.value = names[i];
                opt.textContent = names[i];
                sel.appendChild(opt);
            }
        }
        if (prev) sel.value = prev;
    }

    /**
     * Merender kartu kontrol Gerak Anatomi, Preset Pose, Pose Kustom, dan Diagnostik
     * ke dalam panel kanan (#rightBody).
     */
    function ensureAnatomySectionInPanel() {
        const rightBody = byId('rightBody');
        if (!rightBody) return;
        if (byId('anatomySectionCard')) return;

        const sec = document.createElement('div');
        sec.id = 'anatomySectionCard';
        sec.className = 'sec';
        sec.innerHTML = [
            '<div class="sec-title">🦴 GERAK ANATOMI</div>',
            '<div class="grid2">',
            '  <button type="button" id="anatToggleBtn">Mode: OFF</button>',
            '  <button type="button" id="anatDensityBtn">Boxes: Core</button>',
            '</div>',
            '<div class="prop" style="margin-top:6px;">',
            '  <label for="anatPartSelect">Bagian Aktif</label>',
            '  <select id="anatPartSelect"><option value="">-- Pilih Bagian Anatomi --</option></select>',
            '</div>',
            '<div class="grid2" style="margin-top:6px;">',
            '  <button type="button" id="anatDragModeBtn">Aksi: Rotate</button>',
            '  <button type="button" id="anatMirrorBtn">Mirror: OFF</button>',
            '</div>',
            '<div class="grid2" style="margin-top:6px;">',
            '  <button type="button" id="anatResetPartBtn">Reset Bagian</button>',
            '  <button type="button" id="anatResetAllBtn">Reset Semua</button>',
            '</div>',
            '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.12);">',
            '  <div class="sec-title">PRESET & POSE KUSTOM</div>',
            '  <div class="grid3">',
            '    <button type="button" data-anat-pose="rest">Rest</button>',
            '    <button type="button" data-anat-pose="relaxed">Relaxed</button>',
            '    <button type="button" data-anat-pose="wave_right">Wave</button>',
            '  </div>',
            '  <div class="row" style="margin-top:6px;gap:4px;">',
            '    <input type="text" id="anatCustomPoseName" placeholder="Nama pose..." style="flex:1;min-width:0;">',
            '    <button type="button" id="anatSavePoseBtn">Simpan</button>',
            '  </div>',
            '  <div class="row" style="margin-top:6px;gap:4px;">',
            '    <select id="anatCustomPoseSelect" style="flex:1;min-width:0;"><option value="">-- Pose Kustom --</option></select>',
            '    <button type="button" id="anatLoadPoseBtn">Muat</button>',
            '  </div>',
            '  <div class="row" style="margin-top:6px;">',
            '    <button type="button" id="anatDiagBtn" style="flex:1;">🩺 Diagnostik Anatomi</button>',
            '  </div>',
            '</div>'
        ].join('');

        const host = byId('anatomyHostSection');
        if (host) {
            host.replaceWith(sec);
        } else {
            rightBody.appendChild(sec);
        }
        bindAnatomyUiControls();
        populatePartSelector(refreshModelAnatomy(false));
        refreshCustomPoseSelect();
    }

    /**
     * Menyinkronkan tampilan label dan class aktif tombol-tombol kontrol anatomi.
     */
    function syncAnatomyButtonsUi() {
        const tBtn = byId('anatToggleBtn');
        if (tBtn) {
            tBtn.textContent = anatomyActive ? 'Mode: ON' : 'Mode: OFF';
            tBtn.classList.toggle('on', anatomyActive);
        }
        const dBtn = byId('anatDensityBtn');
        if (dBtn && window.AnatomyAnchorBoxes) {
            const isFull = window.AnatomyAnchorBoxes.getDensityMode() === 'full';
            dBtn.textContent = isFull ? 'Boxes: Full' : 'Boxes: Core';
            dBtn.classList.toggle('on', isFull);
        }
        const mBtn = byId('anatDragModeBtn');
        if (mBtn && window.AnatomySelectionSphere) {
            const isTrans = window.AnatomySelectionSphere.getDragMode() === 'translate';
            mBtn.textContent = isTrans ? 'Aksi: Move' : 'Aksi: Rotate';
            mBtn.classList.toggle('on', isTrans);
        }
        const mirBtn = byId('anatMirrorBtn');
        if (mirBtn && window.AnatomySolver) {
            const mir = window.AnatomySolver.isMirrorEnabled();
            mirBtn.textContent = mir ? 'Mirror: ON' : 'Mirror: OFF';
            mirBtn.classList.toggle('on', mir);
        }
    }

    /**
     * Mengaktifkan atau menonaktifkan mode interaksi kotak jangkar & bola penanda anatomi.
     */
    function setAnatomyEnabled(flag) {
        anatomyActive = !!flag;
        if (anatomyActive) {
            const rec = refreshModelAnatomy(false);
            if (!rec) {
                anatomyActive = false;
                syncAnatomyButtonsUi();
                setAnatomyStatus('⚠ Pilih atau import model .VRM / objek terlebih dahulu.');
                return;
            }
            if (window.AnatomyAnchorBoxes) {
                window.AnatomyAnchorBoxes.setTargetRecord(rec);
                window.AnatomyAnchorBoxes.setEnabled(true);
            }
            if (window.AnatomySelectionSphere) {
                window.AnatomySelectionSphere.setEnabled(true);
            }
            setAnatomyStatus('🦴 Mode Anatomi aktif — tap kotak kecil untuk memunculkan bola penanda.');
        } else {
            if (window.AnatomySelectionSphere) {
                window.AnatomySelectionSphere.setEnabled(false);
            }
            if (window.AnatomyAnchorBoxes) {
                window.AnatomyAnchorBoxes.setEnabled(false);
            }
            setAnatomyStatus('🦴 Mode Anatomi nonaktif.');
        }
        syncAnatomyButtonsUi();
    }

    /**
     * Menghubungkan seluruh event listener kontrol anatomi, preset pose, pose kustom, dan diagnostik.
     */
    function bindAnatomyUiControls() {
        const tBtn = byId('anatToggleBtn');
        if (tBtn && tBtn.dataset.vtfAnatBound !== '1') {
            tBtn.dataset.vtfAnatBound = '1';
            tBtn.onclick = function () {
                setAnatomyEnabled(!anatomyActive);
            };
        }

        const dBtn = byId('anatDensityBtn');
        if (dBtn && dBtn.dataset.vtfAnatBound !== '1') {
            dBtn.dataset.vtfAnatBound = '1';
            dBtn.onclick = function () {
                if (!window.AnatomyAnchorBoxes) return;
                const next = (window.AnatomyAnchorBoxes.getDensityMode() === 'full') ? 'core' : 'full';
                window.AnatomyAnchorBoxes.setDensityMode(next);
                syncAnatomyButtonsUi();
                setAnatomyStatus('Kepadatan kotak anatomi: ' + next.toUpperCase());
            };
        }

        const partSel = byId('anatPartSelect');
        if (partSel && partSel.dataset.vtfAnatBound !== '1') {
            partSel.dataset.vtfAnatBound = '1';
            partSel.onchange = function (e) {
                const pid = e.target.value;
                if (!pid) return;
                if (!anatomyActive) setAnatomyEnabled(true);
                refreshModelAnatomy(false);
                if (window.AnatomySolver) {
                    window.AnatomySolver.selectPart(pid);
                }
            };
        }

        const mBtn = byId('anatDragModeBtn');
        if (mBtn && mBtn.dataset.vtfAnatBound !== '1') {
            mBtn.dataset.vtfAnatBound = '1';
            mBtn.onclick = function () {
                if (!window.AnatomySelectionSphere) return;
                const next = (window.AnatomySelectionSphere.getDragMode() === 'translate') ? 'rotate' : 'translate';
                window.AnatomySelectionSphere.setDragMode(next);
                syncAnatomyButtonsUi();
                setAnatomyStatus('Mode geser bola penanda: ' + next.toUpperCase());
            };
        }

        const mirBtn = byId('anatMirrorBtn');
        if (mirBtn && mirBtn.dataset.vtfAnatBound !== '1') {
            mirBtn.dataset.vtfAnatBound = '1';
            mirBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.setMirrorEnabled(!window.AnatomySolver.isMirrorEnabled());
                syncAnatomyButtonsUi();
                setAnatomyStatus('Mirror anatomi: ' + (window.AnatomySolver.isMirrorEnabled() ? 'ON' : 'OFF'));
            };
        }

        const rpBtn = byId('anatResetPartBtn');
        if (rpBtn && rpBtn.dataset.vtfAnatBound !== '1') {
            rpBtn.dataset.vtfAnatBound = '1';
            rpBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.resetSelectedPart();
                commitHistorySafe();
                setAnatomyStatus('↩ Pose bagian terpilih di-reset.');
            };
        }

        const raBtn = byId('anatResetAllBtn');
        if (raBtn && raBtn.dataset.vtfAnatBound !== '1') {
            raBtn.dataset.vtfAnatBound = '1';
            raBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.resetAllParts();
                commitHistorySafe();
                setAnatomyStatus('↩ Semua pose anatomi di-reset ke Rest Pose.');
            };
        }

        document.querySelectorAll('button[data-anat-pose]').forEach(function (btn) {
            if (btn.dataset.vtfAnatBound === '1') return;
            btn.dataset.vtfAnatBound = '1';
            btn.onclick = function () {
                const presetId = btn.getAttribute('data-anat-pose');
                refreshModelAnatomy(false);
                if (window.AnatomyPoses && typeof window.AnatomyPoses.applyPreset === 'function') {
                    const ok = window.AnatomyPoses.applyPreset(presetId);
                    if (ok) {
                        commitHistorySafe();
                        setAnatomyStatus('🧍 Preset pose anatomi diterapkan: ' + presetId);
                    } else {
                        setAnatomyStatus('⚠ Model anatomi belum siap untuk preset pose.');
                    }
                }
            };
        });

        const savePoseBtn = byId('anatSavePoseBtn');
        if (savePoseBtn && savePoseBtn.dataset.vtfAnatBound !== '1') {
            savePoseBtn.dataset.vtfAnatBound = '1';
            savePoseBtn.onclick = function () {
                const inp = byId('anatCustomPoseName');
                const poseName = inp ? inp.value.trim() : '';
                if (!poseName) {
                    setAnatomyStatus('⚠ Isi nama pose kustom terlebih dahulu.');
                    return;
                }
                refreshModelAnatomy(false);
                if (window.AnatomyPoses && typeof window.AnatomyPoses.saveCustomPose === 'function') {
                    if (window.AnatomyPoses.saveCustomPose(poseName)) {
                        if (inp) inp.value = '';
                        refreshCustomPoseSelect();
                        setAnatomyStatus('💾 Pose kustom disimpan: ' + poseName);
                    } else {
                        setAnatomyStatus('⚠ Gagal menyimpan pose kustom (pilih model VRM dulu).');
                    }
                }
            };
        }

        const loadPoseBtn = byId('anatLoadPoseBtn');
        if (loadPoseBtn && loadPoseBtn.dataset.vtfAnatBound !== '1') {
            loadPoseBtn.dataset.vtfAnatBound = '1';
            loadPoseBtn.onclick = function () {
                const sel = byId('anatCustomPoseSelect');
                const poseName = sel ? sel.value : '';
                if (!poseName) {
                    setAnatomyStatus('⚠ Pilih pose kustom dari daftar.');
                    return;
                }
                refreshModelAnatomy(false);
                if (window.AnatomyPoses && typeof window.AnatomyPoses.applyCustomPose === 'function') {
                    if (window.AnatomyPoses.applyCustomPose(poseName)) {
                        commitHistorySafe();
                        setAnatomyStatus('▶ Pose kustom dimuat: ' + poseName);
                    } else {
                        setAnatomyStatus('⚠ Gagal memuat pose kustom.');
                    }
                }
            };
        }

        const diagBtn = byId('anatDiagBtn');
        if (diagBtn && diagBtn.dataset.vtfAnatBound !== '1') {
            diagBtn.dataset.vtfAnatBound = '1';
            diagBtn.onclick = function () {
                refreshModelAnatomy(false);
                if (window.AnatomyDiagnostics && typeof window.AnatomyDiagnostics.printReport === 'function') {
                    const summary = window.AnatomyDiagnostics.printReport();
                    setAnatomyStatus('🩺 ' + summary);
                } else {
                    setAnatomyStatus('⚠ Modul diagnostik anatomi tidak tersedia.');
                }
            };
        }
    }

    /**
     * Menangani pembaruan UI saat seleksi objek di scene berubah.
     */
    function handleSelectionChanged() {
        ensureAnatomySectionInPanel();
        const cur = getCurrentModelEntity();
        if (cur !== lastWatchedRoot) {
            const rec = refreshModelAnatomy(false);
            if (anatomyActive) {
                if (rec && window.AnatomyAnchorBoxes) {
                    window.AnatomyAnchorBoxes.setTargetRecord(rec);
                    window.AnatomyAnchorBoxes.syncBoxes(true);
                } else {
                    setAnatomyEnabled(false);
                }
            }
        } else if (anatomyActive && window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.syncBoxes(false);
        }
    }

    window.__vtfOnAnatomyBoxTapped = function (partId) {
        if (!window.AnatomySolver) return;
        refreshModelAnatomy(false);
        window.AnatomySolver.selectPart(partId);
        const selEl = byId('anatPartSelect');
        if (selEl) selEl.value = partId;
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;
        setAnatomyStatus('🎯 Bola aktif pada: ' + ((def && def.label) ? def.label : partId) + ' — geser bola untuk menggerakkan.');
    };

    window.__vtfOnAnatomyPartSelected = function (partId, mode) {
        const selEl = byId('anatPartSelect');
        if (selEl && partId) selEl.value = partId;
        syncAnatomyButtonsUi();
    };

    window.__vtfOnAnatomyModeChanged = function () {
        syncAnatomyButtonsUi();
    };

    window.__vtfOnAnatomyDragStart = function (partId, mode) {
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;
        setAnatomyStatus('✋ Menggeser (' + mode + '): ' + ((def && def.label) ? def.label : partId));
    };

    window.__vtfOnAnatomyDragMove = function (partId, mode, dx, dy, camEnt) {
        if (!window.AnatomySolver) return;
        window.AnatomySolver.handleDragMove(partId, mode, dx, dy, camEnt);
    };

    window.__vtfOnAnatomyDragEnd = function (partId) {
        commitHistorySafe();
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;
        setAnatomyStatus('✅ Pose diperbarui: ' + ((def && def.label) ? def.label : partId));
    };

    window.__vtfOnAnatomySelectionChanged = handleSelectionChanged;

    const origRenderPanels = window.renderPanelsTemplates;
    if (typeof origRenderPanels === 'function' && !origRenderPanels.__vtfWrappedByAnatomy) {
        const wrappedRenderPanels = function () {
            const res = origRenderPanels.apply(this, arguments);
            ensureAnatomySectionInPanel();
            return res;
        };
        wrappedRenderPanels.__vtfWrappedByAnatomy = true;
        window.renderPanelsTemplates = wrappedRenderPanels;
    }

    document.addEventListener('click', function (e) {
        if (!e || !e.target || typeof e.target.closest !== 'function') return;
        if (e.target.closest('#tree, [data-add], #importMenu, #btnImport, #loadSceneBtn, #btnNew, #del')) {
            setTimeout(handleSelectionChanged, 0);
        }
    });

    window.AnatomyBridgeUI = {
        setEnabled: setAnatomyEnabled,
        refresh: function () {
            ensureAnatomySectionInPanel();
            refreshCustomPoseSelect();
            return refreshModelAnatomy(true);
        },
        notifySelectionChanged: handleSelectionChanged
    };

    if (document.readyState !== 'loading') {
        ensureAnatomySectionInPanel();
    } else {
        document.addEventListener('DOMContentLoaded', ensureAnatomySectionInPanel);
    }
})();
