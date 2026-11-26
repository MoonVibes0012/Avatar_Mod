/* ===== VTuber Forge — js/ui/panels_template.js ===== */
// Template konten Panel Kiri (#leftBody: Primitif, Scene, Gerak, Ekspresi + Morph Slider + Custom, Face Tracking)
// & Panel Kanan (#rightBody: Mode Edit, Transform, Material, Edit Mesh & Bone, Character Driver, Anatomi, Aksi Objek)

(function () {
    'use strict';

    /**
     * Merender isi Panel Kiri (#leftBody) dengan kontrol primitif, file/scene,
     * animasi, preset ekspresi + slider morph + ekspresi kustom, face tracking, dan hierarki scene.
     */
    function renderLeftPanel(leftBody) {
        if (!leftBody) return;
        try {
            leftBody.innerHTML = [
                '<div class="sec">',
                '  <div class="sec-title">PRIMITIF & BONE</div>',
                '  <div class="grid2">',
                '    <button type="button" data-add="box">+ Box</button>',
                '    <button type="button" data-add="sphere">+ Sphere</button>',
                '    <button type="button" data-add="capsule">+ Capsule</button>',
                '    <button type="button" data-add="cylinder">+ Cylinder</button>',
                '    <button type="button" data-add="plane">+ Plane</button>',
                '    <button type="button" data-add="bone">+ Bone</button>',
                '  </div>',
                '</div>',
                '<div class="sec">',
                '  <div class="sec-title">FILE & SCENE</div>',
                '  <div class="grid2">',
                '    <button type="button" id="importMenu">Import File</button>',
                '    <button type="button" id="loadSceneBtn">Load JSON</button>',
                '    <button type="button" id="x-obj">Export OBJ</button>',
                '    <button type="button" id="x-vrm">Export VRM</button>',
                '  </div>',
                '  <div class="row" style="margin-top:6px;">',
                '    <button type="button" id="saveLogBtn" style="flex:1;">📄 Save Debug Log</button>',
                '  </div>',
                '</div>',
                '<div class="sec">',
                '  <div class="sec-title">GERAK & ANIMASI</div>',
                '  <div class="grid3">',
                '    <button type="button" id="animSpin">Spin</button>',
                '    <button type="button" id="animPulse">Pulse</button>',
                '    <button type="button" id="animWobble">Wobble</button>',
                '  </div>',
                '  <div class="row" style="margin-top:6px;">',
                '    <select id="animSelect" style="flex:1;"><option value="">-- Clip Animasi --</option></select>',
                '  </div>',
                '  <div class="grid3" style="margin-top:6px;">',
                '    <button type="button" id="animPlay">▶ Play</button>',
                '    <button type="button" id="animPause">⏸ Pause</button>',
                '    <button type="button" id="animStop">⏹ Stop</button>',
                '  </div>',
                '</div>',
                '<div class="sec">',
                '  <div class="sec-title">EKSPRESI & FACE TRACKING</div>',
                '  <div class="grid3" id="exprButtons">',
                '    <button type="button" class="expr-btn" data-expr="happy">Happy</button>',
                '    <button type="button" class="expr-btn" data-expr="angry">Angry</button>',
                '    <button type="button" class="expr-btn" data-expr="sad">Sad</button>',
                '    <button type="button" class="expr-btn" data-expr="surprised">Surprised</button>',
                '    <button type="button" class="expr-btn" data-expr="blink">Blink</button>',
                '    <button type="button" class="expr-btn" data-expr="neutral" id="resetExprBtn">Reset</button>',
                '  </div>',
                '  <div id="morphSection" style="display:none;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.12);">',
                '    <div class="sec-title" style="font-size:10px;margin-bottom:4px;">MORPH / BLENDSHAPE MANUAL</div>',
                '    <div id="morphControls" style="max-height:160px;overflow-y:auto;padding-right:4px;"></div>',
                '  </div>',
                '  <div class="row" style="margin-top:6px;gap:4px;">',
                '    <input type="text" id="customExprName" placeholder="Nama ekspresi..." style="flex:1;min-width:0;">',
                '    <button type="button" id="saveCustomExprBtn">Simpan</button>',
                '  </div>',
                '  <div class="grid2" id="customExprList" style="margin-top:4px;"></div>',
                '  <div class="row" style="margin-top:6px;">',
                '    <button type="button" id="btnFaceTrack" style="flex:1;">🎥 Face Tracking</button>',
                '  </div>',
                '</div>',
                '<div class="sec">',
                '  <div class="sec-title">HIERARKI SCENE</div>',
                '  <div id="tree" class="tree-box">Kosong</div>',
                '</div>'
            ].join('\n');
        } catch (err) {
            console.error('Gagal merender panel kiri:', err);
        }
    }

    /**
     * Merender isi Panel Kanan (#rightBody) termasuk Mode Switcher, Transform & Fokus Kamera,
     * Material, Edit Mesh & Bone, Character Driver, Anatomi, dan Aksi Objek.
     */
    function renderRightPanel(rightBody) {
        if (!rightBody) return;
        try {
            rightBody.innerHTML = [
                '<div class="sec">',
                '  <div class="sec-title">MODE EDITING (<span id="mode">OBJECT</span>)</div>',
                '  <div class="grid3">',
                '    <button type="button" data-mode="object" class="on">Object</button>',
                '    <button type="button" data-mode="vertex">Vertex</button>',
                '    <button type="button" data-mode="bone">Bone</button>',
                '  </div>',
                '</div>',
                '<div class="sec">',
                '  <div class="sec-title">TRANSFORM & SNAP</div>',
                '  <div class="grid2">',
                '    <button type="button" id="snapToggle">Grid Snap (0.5)</button>',
                '    <button type="button" id="focusBtn">🎯 Fokus Kamera</button>',
                '  </div>',
                '  <div class="trow"><label>Pos X</label><input type="number" id="px" step="0.1" value="0"><input type="range" id="pxR" min="-10" max="10" step="0.1" value="0"><span id="pxo">0.00</span></div>',
                '  <div class="trow"><label>Pos Y</label><input type="number" id="py" step="0.1" value="0"><input type="range" id="pyR" min="-10" max="10" step="0.1" value="0"><span id="pyo">0.00</span></div>',
                '  <div class="trow"><label>Pos Z</label><input type="number" id="pz" step="0.1" value="0"><input type="range" id="pzR" min="-10" max="10" step="0.1" value="0"><span id="pzo">0.00</span></div>',
                '  <div class="trow"><label>Rot X</label><input type="number" id="rx" step="1" value="0"><input type="range" id="rxR" min="-180" max="180" step="1" value="0"><span id="rxo">0</span></div>',
                '  <div class="trow"><label>Rot Y</label><input type="number" id="ry" step="1" value="0"><input type="range" id="ryR" min="-180" max="180" step="1" value="0"><span id="ryo">0</span></div>',
                '  <div class="trow"><label>Rot Z</label><input type="number" id="rz" step="1" value="0"><input type="range" id="rzR" min="-180" max="180" step="1" value="0"><span id="rzo">0</span></div>',
                '  <div class="trow"><label>Scale</label><input type="number" id="sc" step="0.05" value="1"><input type="range" id="scR" min="0.1" max="5" step="0.05" value="1"><span id="sco">1.00</span></div>',
                '</div>',
                '<div class="sec">',
                '  <div class="sec-title">MATERIAL & TEKSTUR</div>',
                '  <div class="trow"><label>Warna</label><input type="color" id="color" value="#8c73d9"></div>',
                '  <div class="trow"><label>Gloss</label><input type="range" id="rough" min="0" max="1" step="0.01" value="0.5"><span id="rougho">0.50</span></div>',
                '  <div class="trow"><label>Metal</label><input type="range" id="metal" min="0" max="1" step="0.01" value="0"><span id="meto">0.00</span></div>',
                '  <div class="trow"><label>Tex Tile</label><input type="range" id="texScale" min="0.25" max="8" step="0.25" value="1"><span id="texScaleOut">1</span></div>',
                '</div>',
                '<div class="sec" id="editToolsSection">',
                '  <div class="sec-title">EDIT MESH & BONE</div>',
                '  <div class="grid2">',
                '    <button type="button" id="smooth">Smooth Mesh</button>',
                '    <button type="button" id="splitConnected">Split Connected</button>',
                '    <button type="button" id="splitMaterial">Split Material</button>',
                '    <button type="button" id="btnEditBone" onclick="if(typeof window.setMode===\'function\')window.setMode(\'bone\');else if(typeof window.setupBoneEditing===\'function\')window.setupBoneEditing();">Edit Bone</button>',
                '  </div>',
                '  <div id="vertexPanel" style="display:none;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.12);">',
                '    <div class="trow"><label>Vertex #</label><input type="range" id="vi" min="0" max="0" step="1" value="0"><span id="viO">0</span></div>',
                '    <div class="trow"><label>VX</label><input type="number" id="vx" step="0.01" value="0"><span id="vxo">0.00</span></div>',
                '    <div class="trow"><label>VY</label><input type="number" id="vy" step="0.01" value="0"><span id="vyo">0.00</span></div>',
                '    <div class="trow"><label>VZ</label><input type="number" id="vz" step="0.01" value="0"><span id="vzo">0.00</span></div>',
                '  </div>',
                '  <div id="bonePanel" style="display:none;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.12);">',
                '    <div class="row"><select id="boneList" style="flex:1;"><option value="">-- Pilih Tulang --</option></select></div>',
                '    <div id="boneEditControls" style="display:none;margin-top:6px;">',
                '      <div class="trow"><label>Bone RX</label><input type="range" id="bRx" min="-180" max="180" step="1" value="0"><span id="bRxO">0</span></div>',
                '      <div class="trow"><label>Bone RY</label><input type="range" id="bRy" min="-180" max="180" step="1" value="0"><span id="bRyO">0</span></div>',
                '      <div class="trow"><label>Bone RZ</label><input type="range" id="bRz" min="-180" max="180" step="1" value="0"><span id="bRzO">0</span></div>',
                '      <div class="grid2" style="margin-top:4px;">',
                '        <button type="button" id="resetBone">Reset Bone</button>',
                '        <button type="button" id="resetAllBones">Reset All Bones</button>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>',
                '<div class="sec" id="charDriverSection">',
                '  <div class="sec-title">CHARACTER DRIVER</div>',
                '  <div class="row"><button type="button" id="btnCharDriver" style="flex:1;">🎭 Character Driver</button></div>',
                '  <div id="charDriverPanel" style="display:none;margin-top:6px;">',
                '    <div class="trow"><label><input type="checkbox" id="toggleBlink"> Auto-Blink</label></div>',
                '    <div class="trow"><label><input type="checkbox" id="toggleBreath"> Breathing</label><input type="range" id="breathSpeed" min="0.2" max="4" step="0.1" value="1.2"><span id="breathSpeedOut">1.2</span></div>',
                '    <div class="trow"><label><input type="checkbox" id="toggleSway"> Idle Sway</label><input type="range" id="swayAmount" min="0" max="10" step="0.2" value="2.0"><span id="swayAmountOut">2.0</span></div>',
                '    <div class="trow"><label><input type="checkbox" id="toggleHeadBob"> Head Bob</label></div>',
                '    <div class="trow"><label><input type="checkbox" id="toggleWalk"> Walk Cycle</label><input type="range" id="walkSpeed" min="0.5" max="5" step="0.1" value="2.0"><span id="walkSpeedOut">2.0</span></div>',
                '    <div class="grid2" style="margin-top:4px;">',
                '      <button type="button" id="resetDriverPose">Reset Pose</button>',
                '      <button type="button" id="btnDetachDriver">Detach</button>',
                '    </div>',
                '  </div>',
                '</div>',
                '<div class="sec" id="anatomyHostSection"></div>',
                '<div class="sec">',
                '  <div class="sec-title">AKSI OBJEK</div>',
                '  <div class="grid2">',
                '    <button type="button" id="dup">Duplicate</button>',
                '    <button type="button" id="del">Delete</button>',
                '    <button type="button" id="grp">Group</button>',
                '    <button type="button" id="ungrp">Ungroup</button>',
                '  </div>',
                '</div>'
            ].join('\n');
        } catch (err) {
            console.error('Gagal merender panel kanan:', err);
        }
    }

    /**
     * Merender kedua template panel utama jika elemen target tersedia di DOM.
     */
    function renderPanelsTemplates() {
        try {
            const leftBody = document.getElementById('leftBody');
            const rightBody = document.getElementById('rightBody');
            if (leftBody) renderLeftPanel(leftBody);
            if (rightBody) renderRightPanel(rightBody);
            if (typeof window.bindModeButtons === 'function') window.bindModeButtons();
            if (typeof window.bindSaveLogButton === 'function') window.bindSaveLogButton();
        } catch (err) {
            console.error('Gagal menjalankan renderPanelsTemplates:', err);
        }
    }

    window.renderPanelsTemplates = renderPanelsTemplates;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderPanelsTemplates);
    } else {
        renderPanelsTemplates();
    }
})();
