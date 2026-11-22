/* ===== VTuber Forge — js/ui/panels_template.js ===== */
// Template konten Panel Kiri (#leftBody: Primitif, Scene, Gerak, Ekspresi, Face Tracking)
// & Panel Kanan (#rightBody: Transform, Material, Anatomi, Edit)

(function () {
    'use strict';

    function renderLeftPanel(leftBody) {
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
            '    <button type="button" data-expr="happy">Happy</button>',
            '    <button type="button" data-expr="angry">Angry</button>',
            '    <button type="button" data-expr="sad">Sad</button>',
            '    <button type="button" data-expr="surprised">Surprised</button>',
            '    <button type="button" data-expr="blink">Blink</button>',
            '    <button type="button" data-expr="neutral">Reset</button>',
            '  </div>',
            '  <div class="row" style="margin-top:6px;">',
            '    <button type="button" id="btnFaceTrack" style="flex:1;">🎥 Face Tracking</button>',
            '  </div>',
            '</div>',
            '<div class="sec">',
            '  <div class="sec-title">HIERARKI SCENE</div>',
            '  <div id="tree" class="tree-box">Kosong</div>',
            '</div>'
        ].join('\n');
    }

    function renderRightPanel(rightBody) {
        rightBody.innerHTML = [
            '<div class="sec">',
            '  <div class="sec-title">TRANSFORM & SNAP</div>',
            '  <div class="row"><button type="button" id="snapToggle">Grid Snap (0.5)</button></div>',
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
    }

    function renderPanelsTemplates() {
        const leftBody = document.getElementById('leftBody');
        const rightBody = document.getElementById('rightBody');
        if (leftBody) renderLeftPanel(leftBody);
        if (rightBody) renderRightPanel(rightBody);
    }

    window.renderPanelsTemplates = renderPanelsTemplates;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderPanelsTemplates);
    } else {
        renderPanelsTemplates();
    }
})();
