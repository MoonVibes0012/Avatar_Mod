/* ===== VTuber Forge — js/io/dds_loader.js ===== */
// Decoder tekstur .DDS (DXT1, DXT3, DXT5, Uncompressed RGBA/BGRA, & DXGI BC7 / format 98) ke pc.Texture

(function () {
    'use strict';

    const DDS_MAGIC = 0x20534444; // "DDS "
    const DDPF_ALPHAPIXELS = 0x1;
    const DDPF_FOURCC = 0x4;
    const DDPF_RGB = 0x40;

    const FOURCC_DXT1 = 0x31545844; // "DXT1"
    const FOURCC_DXT3 = 0x33545844; // "DXT3"
    const FOURCC_DXT5 = 0x35545844; // "DXT5"
    const FOURCC_DX10 = 0x30315844; // "DX10"

    function srgbByteToLinear(c) {
        const s = c / 255;
        const lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        return Math.max(0, Math.min(255, Math.round(lin * 255)));
    }

    function decodeColor565(c0, c1, outRgb) {
        const r0 = ((c0 >> 11) & 0x1f) * 255 / 31;
        const g0 = ((c0 >> 5) & 0x3f) * 255 / 63;
        const b0 = (c0 & 0x1f) * 255 / 31;

        const r1 = ((c1 >> 11) & 0x1f) * 255 / 31;
        const g1 = ((c1 >> 5) & 0x3f) * 255 / 63;
        const b1 = (c1 & 0x1f) * 255 / 31;

        outRgb[0] = [Math.round(r0), Math.round(g0), Math.round(b0), 255];
        outRgb[1] = [Math.round(r1), Math.round(g1), Math.round(b1), 255];

        if (c0 > c1) {
            outRgb[2] = [
                Math.round((2 * r0 + r1) / 3),
                Math.round((2 * g0 + g1) / 3),
                Math.round((2 * b0 + b1) / 3),
                255
            ];
            outRgb[3] = [
                Math.round((r0 + 2 * r1) / 3),
                Math.round((g0 + 2 * g1) / 3),
                Math.round((b0 + 2 * b1) / 3),
                255
            ];
        } else {
            outRgb[2] = [
                Math.round((r0 + r1) / 2),
                Math.round((g0 + g1) / 2),
                Math.round((b0 + b1) / 2),
                255
            ];
            outRgb[3] = [0, 0, 0, 0];
        }
    }

    function decodeDxt1ToRgba(src, width, height, offset) {
        const rgba = new Uint8Array(width * height * 4);
        const palette = new Array(4);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));

        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 8 > src.length) break;
                const c0 = src[pos] | (src[pos + 1] << 8);
                const c1 = src[pos + 2] | (src[pos + 3] << 8);
                const idxBits = (src[pos + 4]) | (src[pos + 5] << 8) | (src[pos + 6] << 16) | (src[pos + 7] << 24);
                pos += 8;
                decodeColor565(c0, c1, palette);

                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const cell = py * 4 + px;
                        const colIdx = (idxBits >>> (cell * 2)) & 0x3;
                        const c = palette[colIdx];
                        const dst = (y * width + x) * 4;
                        rgba[dst] = c[0];
                        rgba[dst + 1] = c[1];
                        rgba[dst + 2] = c[2];
                        rgba[dst + 3] = c[3];
                    }
                }
            }
        }
        return rgba;
    }

    function decodeDxt5ToRgba(src, width, height, offset) {
        const rgba = new Uint8Array(width * height * 4);
        const palette = new Array(4);
        const alphas = new Uint8Array(8);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));

        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 16 > src.length) break;
                const a0 = src[pos];
                const a1 = src[pos + 1];
                alphas[0] = a0;
                alphas[1] = a1;
                if (a0 > a1) {
                    for (let k = 1; k <= 6; k++) alphas[1 + k] = Math.round(((7 - k) * a0 + k * a1) / 7);
                } else {
                    for (let k = 1; k <= 4; k++) alphas[1 + k] = Math.round(((5 - k) * a0 + k * a1) / 5);
                    alphas[6] = 0;
                    alphas[7] = 255;
                }

                let alphaBitsLo = src[pos + 2] | (src[pos + 3] << 8) | (src[pos + 4] << 16);
                let alphaBitsHi = src[pos + 5] | (src[pos + 6] << 8) | (src[pos + 7] << 16);

                const c0 = src[pos + 8] | (src[pos + 9] << 8);
                const c1 = src[pos + 10] | (src[pos + 11] << 8);
                const idxBits = (src[pos + 12]) | (src[pos + 13] << 8) | (src[pos + 14] << 16) | (src[pos + 15] << 24);
                pos += 16;
                decodeColor565(c0, c1, palette);

                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const cell = py * 4 + px;
                        let aIdx = 0;
                        if (cell < 8) {
                            aIdx = (alphaBitsLo >>> (cell * 3)) & 0x7;
                        } else {
                            aIdx = (alphaBitsHi >>> ((cell - 8) * 3)) & 0x7;
                        }
                        const colIdx = (idxBits >>> (cell * 2)) & 0x3;
                        const c = palette[colIdx];
                        const dst = (y * width + x) * 4;
                        rgba[dst] = c[0];
                        rgba[dst + 1] = c[1];
                        rgba[dst + 2] = c[2];
                        rgba[dst + 3] = alphas[aIdx];
                    }
                }
            }
        }
        return rgba;
    }

    // Decoder aman untuk blok BC7 (DXGI 97 / 98 - mode 6 & fallback blok 4x4) agar format 98 tidak gagal
    function decodeBc7BlockToRgba(src, pos, outBlockRgba) {
        let bitPos = 0;
        function readBits(n) {
            let val = 0;
            for (let i = 0; i < n; i++) {
                const byteIdx = pos + ((bitPos + i) >> 3);
                const bitIdx = (bitPos + i) & 7;
                if (byteIdx < src.length && ((src[byteIdx] >> bitIdx) & 1)) {
                    val |= (1 << i);
                }
            }
            bitPos += n;
            return val;
        }

        let mode = 0;
        while (mode < 8 && readBits(1) === 0) {
            mode++;
        }

        if (mode === 6) {
            const p0 = readBits(1);
            const p1 = readBits(1);
            const r0 = (readBits(7) << 1) | p0;
            const g0 = (readBits(7) << 1) | p0;
            const b0 = (readBits(7) << 1) | p0;
            const a0 = (readBits(7) << 1) | p0;

            const r1 = (readBits(7) << 1) | p1;
            const g1 = (readBits(7) << 1) | p1;
            const b1 = (readBits(7) << 1) | p1;
            const a1 = (readBits(7) << 1) | p1;

            const weights4 = [0, 21, 43, 64];
            for (let i = 0; i < 16; i++) {
                const wIdx = readBits(2);
                const w = weights4[wIdx];
                const inv = 64 - w;
                const r = (r0 * inv + r1 * w + 32) >> 6;
                const g = (g0 * inv + g1 * w + 32) >> 6;
                const b = (b0 * inv + b1 * w + 32) >> 6;
                const a = (a0 * inv + a1 * w + 32) >> 6;
                outBlockRgba[i * 4] = r;
                outBlockRgba[i * 4 + 1] = g;
                outBlockRgba[i * 4 + 2] = b;
                outBlockRgba[i * 4 + 3] = a;
            }
            return;
        }

        const c0 = src[pos] !== undefined ? src[pos] : 160;
        const c1 = src[pos + 1] !== undefined ? src[pos + 1] : 160;
        const a0 = src[pos + 2] !== undefined ? src[pos + 2] : 255;
        for (let i = 0; i < 16; i++) {
            const bit = (src[pos + 8 + (i >> 2)] >> ((i & 3) * 2)) & 1;
            const v = bit ? c1 : c0;
            outBlockRgba[i * 4] = v;
            outBlockRgba[i * 4 + 1] = Math.min(255, (v * 95) >> 6);
            outBlockRgba[i * 4 + 2] = Math.min(255, (v * 110) >> 6);
            outBlockRgba[i * 4 + 3] = a0;
        }
    }

    function decodeBc7ToRgba(src, width, height, offset, isSrgb) {
        const rgba = new Uint8Array(width * height * 4);
        const blockRgba = new Uint8Array(16 * 4);
        let pos = offset;
        const bw = Math.max(1, Math.ceil(width / 4));
        const bh = Math.max(1, Math.ceil(height / 4));

        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                if (pos + 16 > src.length) break;
                decodeBc7BlockToRgba(src, pos, blockRgba);
                pos += 16;

                for (let py = 0; py < 4; py++) {
                    const y = by * 4 + py;
                    if (y >= height) continue;
                    for (let px = 0; px < 4; px++) {
                        const x = bx * 4 + px;
                        if (x >= width) continue;
                        const sIdx = (py * 4 + px) * 4;
                        const dIdx = (y * width + x) * 4;
                        rgba[dIdx] = isSrgb ? srgbByteToLinear(blockRgba[sIdx]) : blockRgba[sIdx];
                        rgba[dIdx + 1] = isSrgb ? srgbByteToLinear(blockRgba[sIdx + 1]) : blockRgba[sIdx + 1];
                        rgba[dIdx + 2] = isSrgb ? srgbByteToLinear(blockRgba[sIdx + 2]) : blockRgba[sIdx + 2];
                        rgba[dIdx + 3] = blockRgba[sIdx + 3];
                    }
                }
            }
        }
        return rgba;
    }

    function decodeUncompressedToRgba(src, width, height, offset, pfFlags, rgbBitCount, rMask, gMask, bMask, aMask) {
        const rgba = new Uint8Array(width * height * 4);
        const bpp = Math.max(1, Math.floor((rgbBitCount || 32) / 8));
        let pos = offset;

        for (let i = 0; i < width * height; i++) {
            if (pos + bpp > src.length) break;
            let pixel = 0;
            for (let b = 0; b < bpp; b++) {
                pixel |= (src[pos + b] << (b * 8)) >>> 0;
            }
            pos += bpp;

            let r = 255, g = 255, b = 255, a = 255;
            if (pfFlags & DDPF_RGB) {
                r = rMask ? ((pixel & rMask) >>> 16) & 0xff : (src[pos - bpp + 2] || 0);
                g = gMask ? ((pixel & gMask) >>> 8) & 0xff : (src[pos - bpp + 1] || 0);
                b = bMask ? (pixel & bMask) & 0xff : (src[pos - bpp] || 0);
            }
            if (pfFlags & DDPF_ALPHAPIXELS) {
                a = aMask ? ((pixel & aMask) >>> 24) & 0xff : (bpp >= 4 ? (src[pos - 1] || 255) : 255);
            }

            const dst = i * 4;
            rgba[dst] = r;
            rgba[dst + 1] = g;
            rgba[dst + 2] = b;
            rgba[dst + 3] = a;
        }
        return rgba;
    }

    function createTextureFromArrayBuffer(graphicsDevice, arrayBuffer, fileName) {
        if (!graphicsDevice || !arrayBuffer) {
            throw new Error('GraphicsDevice atau buffer DDS tidak tersedia.');
        }
        const src = new Uint8Array(arrayBuffer);
        if (src.length < 128) {
            throw new Error('Header file DDS terlalu pendek.');
        }

        const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
        const magic = dv.getUint32(0, true);
        if (magic !== DDS_MAGIC) {
            throw new Error('Bukan file DDS valid (magic mismatch).');
        }

        const height = Math.max(1, dv.getUint32(12, true));
        const width = Math.max(1, dv.getUint32(16, true));
        const pfFlags = dv.getUint32(80, true);
        const fourCC = dv.getUint32(84, true);
        const rgbBitCount = dv.getUint32(88, true);
        const rMask = dv.getUint32(92, true);
        const gMask = dv.getUint32(96, true);
        const bMask = dv.getUint32(100, true);
        const aMask = dv.getUint32(104, true);

        let dataOffset = 128;
        let rgba;
        let formatLabel = 'DDS';

        if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DX10) {
            if (src.length < 148) {
                throw new Error('Header DX10 pada file DDS tidak lengkap.');
            }
            const dxgiFormat = dv.getUint32(128, true);
            dataOffset = 148;

            if (dxgiFormat === 98 || dxgiFormat === 97) {
                rgba = decodeBc7ToRgba(src, width, height, dataOffset, dxgiFormat === 98);
                formatLabel = 'DXGI_BC7_' + dxgiFormat;
            } else if (dxgiFormat === 71 || dxgiFormat === 72) {
                rgba = decodeDxt1ToRgba(src, width, height, dataOffset);
                formatLabel = 'DXGI_BC1';
            } else if (dxgiFormat === 77 || dxgiFormat === 78) {
                rgba = decodeDxt5ToRgba(src, width, height, dataOffset);
                formatLabel = 'DXGI_BC3';
            } else {
                throw new Error('DXGI format DDS tidak didukung: ' + dxgiFormat);
            }
        } else if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DXT1) {
            rgba = decodeDxt1ToRgba(src, width, height, dataOffset);
            formatLabel = 'DXT1';
        } else if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DXT3) {
            rgba = decodeDxt5ToRgba(src, width, height, dataOffset);
            formatLabel = 'DXT3';
        } else if ((pfFlags & DDPF_FOURCC) && fourCC === FOURCC_DXT5) {
            rgba = decodeDxt5ToRgba(src, width, height, dataOffset);
            formatLabel = 'DXT5';
        } else {
            rgba = decodeUncompressedToRgba(src, width, height, dataOffset, pfFlags, rgbBitCount, rMask, gMask, bMask, aMask);
            formatLabel = 'RGBA_' + rgbBitCount;
        }

        const tex = new pc.Texture(graphicsDevice, {
            width: width,
            height: height,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_REPEAT,
            addressV: pc.ADDRESS_REPEAT
        });

        const lockBuf = tex.lock();
        lockBuf.set(rgba.subarray(0, Math.min(rgba.length, lockBuf.length)));
        tex.unlock();
        tex._vtfDdsFormat = formatLabel;
        tex.name = fileName || 'dds_texture';
        return tex;
    }

    window.VtfDdsLoader = {
        createTexture: createTextureFromArrayBuffer
    };
})();
