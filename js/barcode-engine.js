/**
 * =============================================================================
 * BARCODE ENGINE - LIVE VIDEO STREAM & CANVAS MULTI-FORMAT DECODER
 * Guaranteed Live Camera Feed + Native BarcodeDetector + ZXing Reader
 * =============================================================================
 */

const BarcodeEngine = (function() {
    let isCameraScanning = false;
    let currentScanMode = 'invoice'; // 'invoice' or 'inventory'
    let currentStream = null;
    let animationFrameId = null;
    let barcodeDetector = null;
    let zxingMultiReader = null;
    let availableCameras = [];
    let selectedDeviceId = null;

    let lastScanTime = 0;
    const SCAN_COOLDOWN_MS = 1500; // Cooldown to prevent double scanning

    // Hardware Scanner Keystroke Buffer
    let hardwareBuffer = '';
    let lastKeyTime = 0;

    /**
     * Initialize Barcode Engine
     */
    function init() {
        document.addEventListener('keydown', handleHardwareScannerInput);
        console.log('⚡ Barcode Scanner Engine Ready (Live Camera + Multi-Decoder)');
    }

    /**
     * Handle USB / Bluetooth Hardware Barcode Scanner Keypresses
     */
    function handleHardwareScannerInput(e) {
        const target = e.target;
        const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (target.id === 'pos-barcode-quick' && e.key === 'Enter') {
            e.preventDefault();
            const code = target.value.trim();
            if (code) {
                processScannedCode(code, 'invoice');
                target.value = '';
            }
            return;
        }

        if (target.id === 'inventory-barcode-quick' && e.key === 'Enter') {
            e.preventDefault();
            const code = target.value.trim();
            if (code) {
                processScannedCode(code, 'inventory');
                target.value = '';
            }
            return;
        }

        if (isEditable && target.id !== 'pos-barcode-quick' && target.id !== 'inventory-barcode-quick' && target.id !== 'modal-manual-barcode-input') {
            return;
        }

        const now = Date.now();
        if (now - lastKeyTime > 100) {
            hardwareBuffer = '';
        }
        lastKeyTime = now;

        if (e.key === 'Enter') {
            if (hardwareBuffer.length >= 3) {
                e.preventDefault();
                const code = hardwareBuffer.trim();
                hardwareBuffer = '';
                const activeView = getActiveViewMode();
                processScannedCode(code, activeView);
            }
        } else if (e.key.length === 1) {
            hardwareBuffer += e.key;
        }
    }

    /**
     * Determine currently visible view ('invoice' or 'inventory')
     */
    function getActiveViewMode() {
        const inventoryView = document.getElementById('view-inventory');
        if (inventoryView && !inventoryView.classList.contains('hidden')) {
            return 'inventory';
        }
        return 'invoice';
    }

    /**
     * Process Scanned Barcode Code (SKU / EAN / UPC)
     */
    function processScannedCode(code, mode = 'invoice') {
        const now = Date.now();
        if (now - lastScanTime < SCAN_COOLDOWN_MS) {
            return;
        }
        lastScanTime = now;

        playScanBeep();
        flashGreenScanBorder();

        if (mode === 'invoice') {
            if (typeof window.scanBarcodeToCart === 'function') {
                window.scanBarcodeToCart(code);
            } else {
                showToast(`Scanned Code: ${code}`, 'info');
            }
        } else if (mode === 'inventory') {
            if (typeof window.scanBarcodeToInventory === 'function') {
                window.scanBarcodeToInventory(code);
            } else {
                showToast(`Scanned Code: ${code}`, 'info');
            }
        }
    }

    /**
     * Open Camera Barcode Scanner Modal with Guaranteed Live Camera Feed
     */
    async function openCameraScanner(mode = 'invoice') {
        currentScanMode = mode;
        const modal = document.getElementById('modal-barcode-scanner');
        const modalTitle = document.getElementById('scanner-modal-title');
        const modeBadge = document.getElementById('scanner-mode-badge');
        const statusText = document.getElementById('scanner-status-text');
        const videoElement = document.getElementById('barcode-video-feed');

        if (modalTitle) {
            modalTitle.textContent = mode === 'invoice' 
                ? 'Scan Barcode to Add to Invoice' 
                : 'Scan Barcode for Stock & Price Update';
        }

        if (modeBadge) {
            modeBadge.textContent = mode === 'invoice' ? 'POS Invoice Mode' : 'Inventory Adjust Mode';
            modeBadge.className = mode === 'invoice'
                ? 'text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800';
        }

        if (statusText) {
            statusText.textContent = 'Accessing camera stream...';
        }

        if (modal) modal.classList.remove('hidden');

        stopCameraScannerTracks();
        isCameraScanning = true;

        try {
            await enumerateCameraDevices();

            let constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            if (selectedDeviceId) {
                constraints.video = {
                    deviceId: { exact: selectedDeviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                };
            }

            // Get live camera stream directly
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoElement) {
                videoElement.srcObject = currentStream;
                videoElement.style.display = 'block';
                await videoElement.play();
            }

            if (statusText) {
                statusText.innerHTML = `<span class="text-cyan-300 font-medium"><i class="fa-solid fa-circle-notch fa-spin mr-1.5 text-cyan-400"></i> Camera active. Align barcode inside laser line...</span>`;
            }

            // Initialize decoders
            initDecoders();

            // Start Canvas Decoding Frame Loop
            startCanvasFrameLoop(videoElement);

        } catch (err) {
            console.error('Camera stream error:', err);
            if (statusText) {
                statusText.innerHTML = `<span class="text-rose-400 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Camera error: ${err.message || 'Permission denied or webcam missing.'} Use manual entry below.</span>`;
            }
        }
    }

    /**
     * Initialize Barcode Decoders
     */
    function initDecoders() {
        // Native BarcodeDetector API
        if ('BarcodeDetector' in window && !barcodeDetector) {
            try {
                barcodeDetector = new BarcodeDetector({
                    formats: [
                        'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 
                        'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'itf', 'codabar'
                    ]
                });
            } catch(e) {}
        }

        // ZXing MultiFormat Reader
        if (window.ZXing && !zxingMultiReader) {
            try {
                const hints = new Map();
                const formats = [
                    ZXing.BarcodeFormat.CODE_128,
                    ZXing.BarcodeFormat.CODE_39,
                    ZXing.BarcodeFormat.EAN_13,
                    ZXing.BarcodeFormat.EAN_8,
                    ZXing.BarcodeFormat.UPC_A,
                    ZXing.BarcodeFormat.UPC_E,
                    ZXing.BarcodeFormat.QR_CODE,
                    ZXing.BarcodeFormat.ITF,
                    ZXing.BarcodeFormat.CODABAR,
                    ZXing.BarcodeFormat.DATA_MATRIX
                ];
                hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
                hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

                zxingMultiReader = new ZXing.MultiFormatReader();
                zxingMultiReader.setHints(hints);
            } catch(e) {}
        }
    }

    /**
     * Continuous Frame Loop - Samples Video & Decodes Barcode
     */
    function startCanvasFrameLoop(videoElement) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let frameCounter = 0;

        async function processFrame() {
            if (!isCameraScanning || !videoElement || videoElement.paused || videoElement.ended) return;

            frameCounter++;

            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

                let detectedCode = null;

                // 1. Native BarcodeDetector (Fastest on Chrome/Edge/Android)
                if (barcodeDetector) {
                    try {
                        const barcodes = await barcodeDetector.detect(canvas);
                        if (barcodes && barcodes.length > 0) {
                            detectedCode = barcodes[0].rawValue || barcodes[0].rawValueText;
                        }
                    } catch(e) {}
                }

                // 2. ZXing MultiFormat Canvas Reader
                if (!detectedCode && zxingMultiReader && frameCounter % 2 === 0) {
                    try {
                        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
                        const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
                        const result = zxingMultiReader.decode(binaryBitmap);
                        if (result && result.getText()) {
                            detectedCode = result.getText().trim();
                        }
                    } catch(e) {}
                }

                if (detectedCode) {
                    processScannedCode(detectedCode, currentScanMode);
                }
            }

            if (isCameraScanning) {
                animationFrameId = requestAnimationFrame(processFrame);
            }
        }

        processFrame();
    }

    /**
     * Enumerate Available Video Camera Devices
     */
    async function enumerateCameraDevices() {
        const camSelect = document.getElementById('scanner-camera-select');
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            availableCameras = devices.filter(d => d.kind === 'videoinput');

            if (camSelect) {
                if (availableCameras.length === 0) {
                    camSelect.innerHTML = `<option value="">Default Camera</option>`;
                } else {
                    camSelect.innerHTML = availableCameras.map((c, i) => 
                        `<option value="${c.deviceId}">${c.label || `Camera ${i + 1}`}</option>`
                    ).join('');

                    if (selectedDeviceId) {
                        camSelect.value = selectedDeviceId;
                    }

                    camSelect.onchange = (e) => {
                        selectedDeviceId = e.target.value;
                        if (isCameraScanning) {
                            openCameraScanner(currentScanMode);
                        }
                    };
                }
            }
        } catch (e) {
            console.warn('Camera enumeration error:', e);
        }
    }

    /**
     * Stop Camera Stream & Scanner Loop
     */
    function stopCameraScanner() {
        isCameraScanning = false;
        stopCameraScannerTracks();

        const modal = document.getElementById('modal-barcode-scanner');
        if (modal) modal.classList.add('hidden');
    }

    function stopCameraScannerTracks() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (currentStream) {
            try {
                currentStream.getTracks().forEach(track => track.stop());
            } catch(e){}
            currentStream = null;
        }

        const videoFeed = document.getElementById('barcode-video-feed');
        if (videoFeed) {
            videoFeed.srcObject = null;
        }
    }

    /**
     * Audio Beep Sound via Web Audio API
     */
    function playScanBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {}
    }

    /**
     * Flash Green Border on Video Box on Successful Scan
     */
    function flashGreenScanBorder() {
        const box = document.getElementById('scanner-video-box');
        if (!box) return;
        box.classList.add('ring-4', 'ring-emerald-500');
        setTimeout(() => {
            box.classList.remove('ring-4', 'ring-emerald-500');
        }, 450);
    }

    /**
     * Visual Toast Notification Manager
     */
    function showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const bgColors = {
            success: 'bg-slate-900 border-emerald-500/50 text-emerald-300 shadow-emerald-500/10',
            error: 'bg-slate-900 border-rose-500/50 text-rose-300 shadow-rose-500/10',
            warning: 'bg-slate-900 border-amber-500/50 text-amber-300 shadow-amber-500/10',
            info: 'bg-slate-900 border-cyan-500/50 text-cyan-300 shadow-cyan-500/10'
        };

        const icons = {
            success: 'fa-circle-check text-emerald-400',
            error: 'fa-circle-xmark text-rose-400',
            warning: 'fa-triangle-exclamation text-amber-400',
            info: 'fa-barcode text-cyan-400'
        };

        toast.className = `flex items-center gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-xl text-xs font-semibold transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto ${bgColors[type] || bgColors.info}`;
        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.info} text-lg shrink-0"></i>
            <div class="flex-1">${message}</div>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white transition">
                <i class="fa-solid fa-xmark text-sm"></i>
            </button>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /**
     * Show Interactive Sample Barcodes Test Sheet
     */
    function openSampleBarcodesModal() {
        let modal = document.getElementById('modal-sample-barcodes');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-sample-barcodes';
            modal.className = 'fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h3 class="font-bold text-white text-base flex items-center gap-2">
                            <i class="fa-solid fa-barcode text-cyan-400"></i> Sample Product Barcodes (Test Sheet)
                        </h3>
                        <button onclick="document.getElementById('modal-sample-barcodes').remove()" class="text-slate-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                    <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <p class="text-xs text-slate-400">Point your camera or barcode scanner at these sample product barcodes to test instant scanning:</p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" id="sample-barcodes-grid">
                        </div>
                    </div>
                    <div class="px-6 py-3 border-t border-slate-800 bg-slate-950 text-right">
                        <button onclick="document.getElementById('modal-sample-barcodes').remove()" class="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">
                            Close
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const grid = document.getElementById('sample-barcodes-grid');
        const sampleProducts = [
            { sku: 'FRM-RB-001', name: 'Ray-Ban Wayfarer Classic' },
            { sku: 'FRM-OK-002', name: 'Oakley Holbrook Black' },
            { sku: 'LNS-SV-156', name: 'Single Vision 1.56 Anti-Blue' },
            { sku: 'CNT-ACV-001', name: 'Acuvue Oasys Monthly' },
            { sku: 'ACC-CLT-001', name: 'Anti-Fog Microfiber Cloth' },
            { sku: 'SRV-EXM-001', name: 'Comprehensive Eye Exam' }
        ];

        grid.innerHTML = sampleProducts.map(p => `
            <div class="bg-white text-black p-4 rounded-xl flex flex-col items-center justify-center text-center shadow border border-slate-300">
                <div class="text-[11px] font-bold text-slate-800 mb-1 truncate w-full">${p.name}</div>
                <svg id="sample-bc-${p.sku}" class="w-full h-16"></svg>
                <div class="text-xs font-mono font-bold text-slate-900 mt-1">${p.sku}</div>
                <button onclick="BarcodeEngine.processScannedCode('${p.sku}'); document.getElementById('modal-sample-barcodes').remove();" class="mt-2 text-[10px] px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-bold transition">
                    Test Scan Code
                </button>
            </div>
        `).join('');

        setTimeout(() => {
            sampleProducts.forEach(p => {
                if (window.JsBarcode) {
                    try {
                        window.JsBarcode(`#sample-bc-${p.sku}`, p.sku, {
                            format: "CODE128",
                            width: 2,
                            height: 50,
                            displayValue: false,
                            margin: 2
                        });
                    } catch(e){}
                }
            });
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        openCameraScanner,
        stopCameraScanner,
        processScannedCode,
        openSampleBarcodesModal,
        playScanBeep,
        showToast
    };
})();

window.BarcodeEngine = BarcodeEngine;
