document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // ... (all other const declarations remain the same) ...
    const colorPaletteContainer = document.getElementById('colorPalette');
    const brushSizeInput = document.getElementById('brushSize');
    const brushSizeValueDisplay = document.getElementById('brushSizeValue');
    const penToolBtn = document.getElementById('penTool');
    const eraserToolBtn = document.getElementById('eraserTool');
    const fillToolBtn = document.getElementById('fillTool');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const templateContainer = document.getElementById('templateContainer');

    const clickSound = document.getElementById('clickSound');
    const drawSound = document.getElementById('drawSound');
    const eraseSound = document.getElementById('eraseSound');
    const clearSound = document.getElementById('clearSound');

    let isDrawing = false;
    let currentTool = 'pen';
    let currentColor = '#000000';
    let currentBrushSize = 5;
    let lastX = 0;
    let lastY = 0;

    let history = [];
    let historyStep = -1;
    let currentTemplateImage = null;

    const colors = [
        '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3',
        '#000000', '#FFFFFF', '#808080', '#C0C0C0', '#FFC0CB', '#A52A2A', '#FFA500',
        '#ADD8E6', '#90EE90', '#FFFFE0', '#E6E6FA', '#D2B48C', '#F5DEB3', '#FAEBD7'
    ];

    const templates = [ // Ensure these paths are correct
        { name: 'Animal Theme', src: 'assets/images/Coolfun.png' },
        { name: 'Car Theme', src: 'assets/images/template-car.png' },
        { name: 'Nature Theme', src: 'assets/images/template-nature.png' },
    ];

    function playSound(soundElement) {
        if (soundElement) {
            soundElement.currentTime = 0;
            soundElement.play().catch(e => console.warn("Audio play failed:", e));
        }
    }

    function init() {
        setupCanvas();
        populateColorPalette();
        populateTemplates();
        addEventListeners();
        setBrushSize(currentBrushSize);
        setActiveTool(penToolBtn);
        saveInitialState();
        updateUndoRedoButtons();
    }

    function setupCanvas() {
        const canvasContainer = document.querySelector('.canvas-container');
        const containerWidth = canvasContainer.offsetWidth - 20;
        const containerHeight = canvasContainer.offsetHeight - 20;
        let canvasWidth = containerWidth;
        let canvasHeight = containerWidth * (3/4);
        if (canvasHeight > containerHeight) {
            canvasHeight = containerHeight;
            canvasWidth = canvasHeight * (4/3);
        }
        if (canvasWidth > containerWidth) {
            canvasWidth = containerWidth;
            canvasHeight = canvasWidth * (3/4);
        }
        canvas.width = Math.max(300, canvasWidth);
        canvas.height = Math.max(225, canvasHeight);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
    }

    window.addEventListener('resize', () => {
        const currentDrawingData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Save before resize
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;

        setupCanvas(); // Resizes and clears

        // Attempt to redraw content proportionally - this is tricky and might not be perfect
        // For simpler behavior, you might just clear or reset history like before
        // But this tries to preserve content
        if (currentDrawingData) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = oldWidth;
            tempCanvas.height = oldHeight;
            tempCtx.putImageData(currentDrawingData, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, oldWidth, oldHeight, 0, 0, canvas.width, canvas.height);
        }


        // History is likely invalidated by resize if not handled carefully.
        // For simplicity here, we reset it. A robust app would scale history states.
        history = [];
        historyStep = -1;
        saveInitialState();
        updateUndoRedoButtons();
    });

    function handleColorSelection(swatchElement, color) {
        currentColor = color;
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        playSound(clickSound);
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected-color'));
        swatchElement.classList.add('selected-color');
        if (currentTool === 'eraser') {
            currentTool = 'pen';
            setActiveTool(penToolBtn);
        }
    }

    function populateColorPalette() {
        colorPaletteContainer.innerHTML = '';
        if (colors.length === 0) {
            ctx.strokeStyle = currentColor; return;
        }
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.setAttribute('role', 'button');
            swatch.setAttribute('aria-label', `Color ${color}`);
            swatch.tabIndex = 0;
            swatch.addEventListener('click', () => handleColorSelection(swatch, color));
            swatch.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleColorSelection(swatch, color); } });
            colorPaletteContainer.appendChild(swatch);
        });
        const firstSwatch = colorPaletteContainer.firstChild;
        if (firstSwatch) {
            firstSwatch.classList.add('selected-color');
            currentColor = firstSwatch.dataset.color;
            ctx.strokeStyle = currentColor;
            ctx.fillStyle = currentColor;
        }
    }

    function populateTemplates() {
        templateContainer.innerHTML = '';
        templates.forEach(template => {
            const item = document.createElement('div');
            item.classList.add('template-item', 'p-2', 'bg-white', 'rounded', 'shadow-sm', 'hover:shadow-md', 'flex', 'flex-col', 'items-center');
            item.innerHTML = `<div class="w-full h-[100px] bg-gray-200 animate-pulse rounded flex items-center justify-center"><i class="fas fa-image fa-2x text-gray-400"></i></div><p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>`;
            const img = new Image();
            if (template.src.startsWith('http')) img.crossOrigin = "Anonymous";
            img.onload = () => { item.innerHTML = `<img src="${img.src}" alt="${template.name}" class="w-full h-auto max-h-[100px] object-contain rounded"><p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>`; };
            img.onerror = (e) => { item.innerHTML = `<div class="w-full h-[100px] bg-red-100 rounded flex flex-col items-center justify-center"><i class="fas fa-exclamation-triangle fa-2x text-red-400"></i><p class="text-xs text-red-500 mt-1">Load failed</p></div><p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>`; console.error(`Template load error: ${img.src}`, e); };
            img.src = template.src;
            item.addEventListener('click', () => {
                if (img.complete && img.naturalWidth !== 0) { playSound(clickSound); loadTemplate(img); }
                else { alert("Template image not ready."); }
            });
            templateContainer.appendChild(item);
        });
    }

    function loadTemplate(imgObject) {
        clearCanvas(false);
        currentTemplateImage = imgObject;
        drawTemplate(imgObject);
        saveState();
    }

    function drawTemplate(img) {
        const canvasAspect = canvas.width / canvas.height;
        const imgAspect = img.width / img.height;
        let drw, drh, ox, oy;
        if (imgAspect > canvasAspect) { drw = canvas.width; drh = canvas.width / imgAspect; }
        else { drh = canvas.height; drw = canvas.height * imgAspect; }
        ox = (canvas.width - drw) / 2; oy = (canvas.height - drh) / 2;
        ctx.drawImage(img, ox, oy, drw, drh);
    }

    function addEventListeners() {
        canvas.addEventListener('mousedown', handleCanvasInteraction);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleCanvasInteraction(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (currentTool === 'pen' || currentTool === 'eraser') draw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchend', (e) => { e.preventDefault(); stopDrawing(); }, { passive: false });
        brushSizeInput.addEventListener('input', (e) => setBrushSize(e.target.value));
        penToolBtn.addEventListener('click', () => { currentTool = 'pen'; playSound(clickSound); setActiveTool(penToolBtn); });
        eraserToolBtn.addEventListener('click', () => { currentTool = 'eraser'; playSound(clickSound); setActiveTool(eraserToolBtn); });
        fillToolBtn.addEventListener('click', () => { currentTool = 'fill'; playSound(clickSound); setActiveTool(fillToolBtn); });
        clearBtn.addEventListener('click', () => {
            playSound(clearSound);
            if (confirm("Are you sure you want to clear everything?")) {
                clearCanvas(false);
                if (currentTemplateImage) drawTemplate(currentTemplateImage);
                saveState();
            }
        });
        saveBtn.addEventListener('click', () => { playSound(clickSound); saveImage(); });
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
    }

    function handleCanvasInteraction(e) {
        if (currentTool === 'fill') {
            const pos = getMousePos(e);
            // Ensure fill color alpha is 255 for opaque fill
            const fillRgba = hexToRgb(currentColor);
            fillRgba[3] = 255; // Force opaque fill
            floodFill(Math.floor(pos.x), Math.floor(pos.y), fillRgba);
            playSound(clickSound);
            saveState();
        } else if (currentTool === 'pen' || currentTool === 'eraser') {
            startDrawing(e);
        }
    }

    function setActiveTool(activeButton) {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active-tool'));
        activeButton.classList.add('active-tool');
        if (activeButton === penToolBtn || activeButton === eraserToolBtn) canvas.style.cursor = 'crosshair';
        else if (activeButton === fillToolBtn) canvas.style.cursor = 'copy';
        else canvas.style.cursor = 'default';
    }

    function setBrushSize(size) {
        currentBrushSize = size;
        ctx.lineWidth = currentBrushSize;
        brushSizeValueDisplay.textContent = `${size}px`;
    }

    function getMousePos(event) {
        const rect = canvas.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    function startDrawing(e) {
        if (currentTool !== 'pen' && currentTool !== 'eraser') return;
        isDrawing = true;
        const pos = getMousePos(e);
        [lastX, lastY] = [pos.x, pos.y];
        if (currentTool === 'pen' && drawSound) drawSound.play().catch(err => console.warn("Draw sound fail", err));
        else if (currentTool === 'eraser' && eraseSound) eraseSound.play().catch(err => console.warn("Erase sound fail", err));
        ctx.beginPath();
        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = currentColor;
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(lastX, lastY);
    }

    function draw(e) {
        if (!isDrawing || (currentTool !== 'pen' && currentTool !== 'eraser')) return;
        const pos = getMousePos(e);
        ctx.moveTo(lastX, lastY);
        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor; ctx.lineWidth = currentBrushSize;
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = currentBrushSize;
        }
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
        [lastX, lastY] = [pos.x, pos.y];
    }

    function stopDrawing() {
        if (!isDrawing && currentTool !== 'fill') return;
        if (currentTool === 'pen' || currentTool === 'eraser') {
            if (isDrawing) { ctx.closePath(); saveState(); }
            if (drawSound && !drawSound.paused) drawSound.pause();
            if (eraseSound && !eraseSound.paused) eraseSound.pause();
        }
        isDrawing = false;
    }

    function hexToRgb(hex) {
        const bigint = parseInt(hex.slice(1), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return [r, g, b, 255]; // Always return with Alpha = 255 for opaque fill
    }

    /**
     * Checks if two colors match within a given tolerance.
     * c1, c2 are [R, G, B, A] arrays.
     * Tolerance applies to R, G, B components. Alpha must match exactly if both are not 0.
     * If target alpha is 0 (transparent), any fill color alpha can match it for filling.
     */
    function colorsMatch(c1, c2, tolerance = 10) {
        if (!c1 || !c2 || c1.length !== c2.length) return false;

        const rMatch = Math.abs(c1[0] - c2[0]) <= tolerance;
        const gMatch = Math.abs(c1[1] - c2[1]) <= tolerance;
        const bMatch = Math.abs(c1[2] - c2[2]) <= tolerance;

        // Alpha matching logic:
        // If target (c1) is fully transparent, we allow filling it (alpha can differ).
        // Otherwise, alpha should be similar or exact.
        // For simplicity, if we are trying to fill, and target is not the fill color,
        // we consider alpha match if both are substantially opaque or both substantially transparent.
        // More precise: If c1[3] (target alpha) is low (e.g. < tolerance), we are filling transparent space.
        // If c1[3] is high, then c2[3] (fill alpha) should also be high.
        // For this coloring book, we mostly care about RGB if the target is "white space".
        // And we stop at boundary lines which have different RGB.
        // Alpha of template lines is typically 255. Alpha of white space is also 255.
        const alphaMatch = Math.abs(c1[3] - c2[3]) <= tolerance;


        return rMatch && gMatch && bMatch && alphaMatch;
    }

    // Defines if a color is considered a "boundary" color (e.g., black lines)
    // This helps prevent filling over lines if the click is slightly off.
    function isBoundaryColor(colorRgba, boundaryRgbThreshold = 60, boundaryAlphaThreshold = 200) {
        if (!colorRgba) return false;
        // Check if it's dark enough (R,G,B are low) and opaque enough (Alpha is high)
        return colorRgba[0] < boundaryRgbThreshold &&
               colorRgba[1] < boundaryRgbThreshold &&
               colorRgba[2] < boundaryRgbThreshold &&
               colorRgba[3] > boundaryAlphaThreshold;
    }


    function floodFill(startX, startY, fillColorRgba) {
        console.log(`Starting fill at (${startX}, ${startY}) with color RGB(${fillColorRgba.slice(0,3).join(',')})`);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const getPixel = (x, y) => {
            if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) return null;
            const i = (y * canvasWidth + x) * 4;
            return [data[i], data[i+1], data[i+2], data[i+3]];
        };

        const setPixel = (x, y, color) => {
            const i = (y * canvasWidth + x) * 4;
            data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = color[3];
        };

        const targetColorRgba = getPixel(startX, startY);

        if (!targetColorRgba) {
            console.log("Clicked outside canvas bounds for fill.");
            return; // Clicked outside
        }
        console.log(`Target color at start: RGB(${targetColorRgba.slice(0,3).join(',')}), A=${targetColorRgba[3]}`);


        // 1. If trying to fill an area that is already the fill color, do nothing.
        if (colorsMatch(targetColorRgba, fillColorRgba, 0)) { // Use 0 tolerance for exact match
            console.log("Target area is already the fill color.");
            return;
        }

        // 2. If the clicked point IS a boundary line, don't fill.
        //    This prevents filling the line itself if the user mis-clicks.
        //    Adjust `isBoundaryColor` thresholds as needed for your template lines.
        if (isBoundaryColor(targetColorRgba)) {
            console.log("Clicked on a boundary line. Cannot fill line itself.");
            // Optionally, you could try to find a nearby non-boundary pixel to start from,
            // but that adds complexity. For now, user must click inside.
            return;
        }


        const queue = [[startX, startY]];
        const visited = new Set(); // To avoid re-processing pixels. Key: "x,y"

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const pixelKey = `${x},${y}`;

            if (visited.has(pixelKey)) continue;
            visited.add(pixelKey);

            const currentColorRgba = getPixel(x, y);

            if (!currentColorRgba) continue; // Should not happen if bounds check in getPixel is good

            // Core condition:
            // - If current pixel matches the ORIGINAL target color (the color of the first clicked pixel)
            // - AND current pixel is NOT a boundary color itself (important for anti-aliased edges)
            if (colorsMatch(currentColorRgba, targetColorRgba) && !isBoundaryColor(currentColorRgba)) {
                setPixel(x, y, fillColorRgba);

                // Add neighbors
                if (x + 1 < canvasWidth) queue.push([x + 1, y]);
                if (x - 1 >= 0) queue.push([x - 1, y]);
                if (y + 1 < canvasHeight) queue.push([x, y + 1]);
                if (y - 1 >= 0) queue.push([x, y - 1]);
            }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log("Fill operation complete.");
    }


    function clearCanvas(saveHistory = true) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'white';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        currentTemplateImage = null;
    }

    function saveImage() {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'my-coloring.png';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    function saveInitialState() {
        history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        historyStep = 0;
        updateUndoRedoButtons();
    }

    function saveState() {
        if (historyStep < history.length - 1) history = history.slice(0, historyStep + 1);
        const maxHistorySize = 20;
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > maxHistorySize) history.shift();
        historyStep = history.length - 1;
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyStep > 0) { playSound(clickSound); historyStep--; ctx.putImageData(history[historyStep], 0, 0); updateUndoRedoButtons(); }
    }

    function redo() {
        if (historyStep < history.length - 1) { playSound(clickSound); historyStep++; ctx.putImageData(history[historyStep], 0, 0); updateUndoRedoButtons(); }
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyStep <= 0;
        redoBtn.disabled = historyStep >= history.length - 1;
        [undoBtn, redoBtn].forEach(btn => {
            btn.classList.toggle('opacity-50', btn.disabled);
            btn.classList.toggle('cursor-not-allowed', btn.disabled);
        });
    }

    init();
});