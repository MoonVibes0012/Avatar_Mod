/* ===== VTuber Forge — js/ui/panels_template.js ===== */
// Template panel kiri (MENU) dan kanan (INSPECTOR) agar app.html tetap ringkas

(function () {
    'use strict';

    const PANELS_HTML = `
        <!-- LEFT PANEL: MENU -->
        <div id="left" class="panel" aria-hidden="true">
            <div class="panel-header">
                <h3>MENU</h3>
                <button type="button" class="btn-close-panel" data-panel="left">✕ Tutup</button>
            </div>

            <div class="section">
                <h3>File</h3>
                <div class="grid">
                    <button type="button" id="importMenu">Import x-vrm/glb</button>
                    <button type="button" id="loadSceneBtn">Load JSON</button>
                    <button type="button" id="x-vrm">Export VRM</button>
                    <button type="button" id="obj">Export OBJ</button>
                </div>
            </div>

            <div class="section">
                <h3>Primitives</h3>
                <div class="grid">
                    <button type="button" data-add="box">Cube</button>
                    <button type="button" data-add="sphere">Sphere</button>
                    <button type="button" data-add="cylinder">Cylinder</button>
                    <button type="button" data-add="capsule">Capsule</button>
                </div>
            </div>

            <div class="section">
                <h3>Avatar parts</h3>
                <div class="grid">
                    <button type="button" data-add="body">Body</button>
                    <button type="button" data-add="head">Head</button>
                    <button type="button" data-add="eye">Eye</button>
                    <button type="button" data-add="hair">Hair</button>
                </div>
            </div>

            <div class="section">
                <h3>Scene</h3>
                <div class="field">
                    <label class="check"><input type="checkbox" id="toggleGrid" checked> <span>Show Grid / Floor</span></label>
                </div>
                <div class="field">
                    <label>Background Color</label>
                    <select id="bgColor">
                        <option value="dark">Dark (Default)</option>
                        <option value="light">Light (White)</option>
                        <option value="green">Green Screen</option>
                        <option value="blue">Blue Screen</option>
                    </select>
                </div>
            </div>

            <div class="section">
                <h3>Performance</h3>
                <div class="field">
                    <label>FPS Limit <span id="fpsOut">60</span></label>
                    <input type="range" id="fpsLimit" min="10" max="120" value="60">
                </div>
                <div class="field">
                    <label>Texture Scale <span id="texScaleOut">100</span>%</label>
                    <input type="range" id="texScale" min="10" max="100" value="100">
                </div>
                <button type="button" id="screenshot" style="width:100%; margin-top:5px;">Take Screenshot</button>
            </div>
        </div>

        <!-- RIGHT PANEL: INSPECTOR -->
        <div id="right" class="panel" aria-hidden="true">
            <div class="panel-header">
                <h3>INSPECTOR</h3>
                <button type="button" class="btn-close-panel" data-panel="right">✕ Tutup</button>
            </div>

            <div class="section">
                <h3>Object</h3>
                <div class="tree" id="tree"></div>
                <button type="button" id="focusBtn" style="width:100%; margin-top:5px;">🎯 Focus</button>
            </div>

            <div class="section">
                <h3>Transform</h3>
                <div class="field">
                    <label>X <span id="pxo">0.00</span></label>
                    <input type="number" id="px" step="0.1">
                    <input type="range" id="pxR" min="-10" max="10" step="0.1">
                </div>
                <div class="field">
                    <label>Y <span id="pyo">1.00</span></label>
                    <input type="number" id="py" step="0.1">
                    <input type="range" id="pyR" min="-10" max="10" step="0.1">
                </div>
                <div class="field">
                    <label>Z <span id="pzo">0.00</span></label>
                    <input type="number" id="pz" step="0.1">
                    <input type="range" id="pzR" min="-10" max="10" step="0.1">
                </div>
                <div class="field">
                    <label>Scale <span id="sco">1.00</span></label>
                    <input type="number" id="sc" step="0.1">
                    <input type="range" id="scR" min="0.1" max="5" step="0.1">
                </div>
            </div>

            <div class="section">
                <h3>Rotation</h3>
                <div class="field">
                    <label>X <span id="rxo">0</span></label>
                    <input type="number" id="rx">
                    <input type="range" id="rxR" min="-180" max="180">
                </div>
                <div class="field">
                    <label>Y <span id="ryo">0</span></label>
                    <input type="number" id="ry">
                    <input type="range" id="ryR" min="-180" max="180">
                </div>
                <div class="field">
                    <label>Z <span id="rzo">0</span></label>
                    <input type="number" id="rz">
                    <input type="range" id="rzR" min="-180" max="180">
                </div>
            </div>

            <div class="section">
                <h3>Tools</h3>
                <div class="toolrow">
                    <button type="button" data-mode="object" class="on">Object</button>
                    <button type="button" data-mode="vertex">Vertex</button>
                    <button type="button" data-mode="bone">Bone</button>
                </div>
                <div class="toolrow" style="margin-top:5px;">
                    <button type="button" id="dup">Duplicate</button>
                    <button type="button" id="del">Delete</button>
                    <button type="button" id="mirror">Mirror X</button>
                </div>
                <div class="toolrow" style="margin-top:5px;">
                    <button type="button" id="center">Center</button>
                    <button type="button" id="smooth">Smooth Mesh</button>
                    <button type="button" id="snapToggle">Grid Snap</button>
                </div>
                <div class="toolrow" style="margin-top:5px;">
                    <button type="button" id="splitConnected" title="Split mesh menjadi bagian-bagian terpisah berdasarkan koneksi vertex">Split Parts</button>
                    <button type="button" id="splitMaterial" title="Split mesh berdasarkan material berbeda">Split Material</button>
                    <button type="button" id="btnNew" style="background:#3a193e; border-color:#d946ef;">New Scene</button>
                </div>
            </div>

            <div class="section">
                <h3>Object Motion</h3>
                <div class="toolrow">
                    <button type="button" id="animSpin">Auto-Spin</button>
                    <button type="button" id="animPulse">Idle Pulse</button>
                    <button type="button" id="animWobble">Spring Wobble</button>
                </div>
            </div>

            <!-- VERTEX EDIT PANEL -->
            <div id="vertexPanel" class="section" style="display:none;">
                <h3>Vertex Edit Mode</h3>
                <div class="field">
                    <label>Vertex Index <span id="viO">0</span></label>
                    <input type="range" id="vi" min="0" max="0">
                </div>
                <div class="field">
                    <label>Vert X <span id="vxo">0</span></label>
                    <input type="number" id="vx" step="0.01">
                </div>
                <div class="field">
                    <label>Vert Y <span id="vyo">0</span></label>
                    <input type="number" id="vy" step="0.01">
                </div>
                <div class="field">
                    <label>Vert Z <span id="vzo">0</span></label>
                    <input type="number" id="vz" step="0.01">
                </div>
            </div>

            <!-- BONE EDIT PANEL -->
            <div id="bonePanel" class="section" style="display:none;">
                <h3>Bone Hierarchy (Preview)</h3>
                <select id="boneList" style="width:100%; margin-bottom:8px;"></select>
                <div id="boneEditControls" style="display:none;">
                    <div class="field">
                        <label>Rot X <span id="bRxO">0</span></label>
                        <input type="range" id="bRx" min="-180" max="180">
                    </div>
                    <div class="field">
                        <label>Rot Y <span id="bRyO">0</span></label>
                        <input type="range" id="bRy" min="-180" max="180">
                    </div>
                    <div class="field">
                        <label>Rot Z <span id="bRzO">0</span></label>
                        <input type="range" id="bRz" min="-180" max="180">
                    </div>
                    <div class="grid">
                        <button type="button" id="resetBone">Reset Bone</button>
                        <button type="button" id="resetAllBones">Reset All</button>
                    </div>
                </div>
            </div>

            <!-- ANIMATION CLIP CONTROLS -->
            <div id="animControls" class="section" style="display:none;">
                <h3>Animation Clip</h3>
                <select id="animSelect" style="width:100%; margin-bottom:8px;"></select>
                <div class="grid">
                    <button type="button" id="animPlay">▶ Play</button>
                    <button type="button" id="animPause">⏸ Pause</button>
                    <button type="button" id="animStop">⏹ Stop</button>
                </div>
            </div>

            <!-- MORPH TARGETS / BLENDSHAPES -->
            <div id="morphSection" class="section" style="display:none;">
                <h3>Blendshapes (Morph)</h3>
                <div id="morphControls"></div>

                <div id="expressionSection" style="margin-top:10px; border-top:1px solid #292930; padding-top:10px;">
                    <h3>Expression Presets</h3>
                    <div class="grid">
                        <button type="button" class="expr-btn" data-expr="neutral">😌</button>
                        <button type="button" class="expr-btn" data-expr="smile">😊</button>
                        <button type="button" class="expr-btn" data-expr="laugh">😁</button>
                        <button type="button" class="expr-btn" data-expr="surprise">😮</button>
                        <button type="button" class="expr-btn" data-expr="angry">😠</button>
                        <button type="button" class="expr-btn" data-expr="sad">😢</button>
                        <button type="button" class="expr-btn" data-expr="wink_l">😉</button>
                        <button type="button" class="expr-btn" data-expr="wink_r">😜</button>
                        <button type="button" class="expr-btn" data-expr="shock">😲</button>
                        <button type="button" class="expr-btn" data-expr="happy">😄</button>
                        <button type="button" class="expr-btn" data-expr="cool">😎</button>
                        <button type="button" class="expr-btn" data-expr="love">😍</button>
                    </div>
                    <div class="field" style="margin-top:8px;">
                        <label>Intensity <span id="exprIntensityOut">1.00</span></label>
                        <input type="range" id="exprIntensity" min="0" max="2" step="0.1" value="1">
                    </div>
                    <button type="button" id="exprSaveCustom" style="width:100%; margin-top:5px;">💾 Save Current as Custom</button>
                    <div id="customExprList" style="margin-top:5px;"></div>
                </div>
            </div>

            <!-- FACE TRACKING SETTINGS -->
            <div id="faceTrackingSection" class="section">
                <h3>📷 Face Tracking</h3>
                <button type="button" id="btnFaceTrackToggle" style="width:100%; margin-bottom:6px;">Start / Stop Face Tracking</button>
                <div class="field">
                    <label>Sensitivity <span id="faceSensitivityOut">1.00</span></label>
                    <input type="range" id="faceSensitivity" min="0.1" max="2.5" step="0.05" value="1.0">
                </div>
                <div class="field">
                    <label>Smoothing <span id="faceSmoothingOut">0.50</span></label>
                    <input type="range" id="faceSmoothing" min="0" max="0.95" step="0.05" value="0.5">
                </div>
            </div>

            <!-- CHARACTER DRIVER PANEL -->
            <div id="charDriverPanel" class="section" style="display:none;">
                <h3>🎭 Character Driver</h3>
                <div class="field">
                    <label class="check"><input type="checkbox" id="toggleBlink"> <span>Auto-Blink (mata)</span></label>
                </div>
                <div class="field">
                    <label class="check"><input type="checkbox" id="toggleBreath"> <span>Breathing (napas)</span></label>
                </div>
                <div class="field">
                    <label>Speed <span id="breathSpeedOut">1.2</span></label>
                    <input type="range" id="breathSpeed" min="0.3" max="3" step="0.1" value="1.2">
                </div>
                <div class="field">
                    <label class="check"><input type="checkbox" id="toggleSway"> <span>Idle Sway (goyang)</span></label>
                </div>
                <div class="field">
                    <label>Amount <span id="swayAmountOut">2.0</span></label>
                    <input type="range" id="swayAmount" min="0.5" max="10" step="0.5" value="2">
                </div>
                <div class="field">
                    <label class="check"><input type="checkbox" id="toggleHeadBob"> <span>Head Bob (angguk)</span></label>
                </div>
                <div class="field">
                    <label class="check"><input type="checkbox" id="toggleWalk"> <span>Walk Cycle (jalan)</span></label>
                </div>
                <div class="field">
                    <label>Speed <span id="walkSpeedOut">2.0</span></label>
                    <input type="range" id="walkSpeed" min="0.5" max="5" step="0.1" value="2">
                </div>
                <div class="grid" style="margin-top:8px;">
                    <button type="button" id="resetDriverPose">Reset Pose</button>
                    <button type="button" id="btnDetachDriver" style="background:#3a193e; border-color:#d946ef;">Detach</button>
                </div>
            </div>

            <div class="section">
                <h3>Material</h3>
                <div class="field">
                    <label>Color</label>
                    <input type="color" id="color" class="color" value="#9933cc">
                </div>
                <div class="field">
                    <label>Gloss <span id="rougho">0.50</span></label>
                    <input type="range" id="rough" min="0" max="1" step="0.01" value="0.5">
                </div>
                <div class="field">
                    <label>Metalness <span id="meto">0.00</span></label>
                    <input type="range" id="metal" min="0" max="1" step="0.01" value="0">
                </div>
            </div>
        </div>
    `;

    const host = document.getElementById('panelHost');
    if (host) {
        host.innerHTML = PANELS_HTML;
    }
})();
