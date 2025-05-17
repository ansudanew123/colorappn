document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); // For better getImageData performance

    const colorPaletteContainer = document.getElementById('colorPalette');
    const brushSizeInput = document.getElementById('brushSize');
    const brushSizeValueDisplay = document.getElementById('brushSizeValue');
    const penToolBtn = document.getElementById('penTool');
    const eraserToolBtn = document.getElementById('eraserTool');
    const fillToolBtn = document.getElementById('fillTool'); // New fill tool button
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const templateContainer = document.getElementById('templateContainer');

    // Audio elements
    const clickSound = document.getElementById('clickSound');
    const drawSound = document.getElementById('drawSound');
    const eraseSound = document.getElementById('eraseSound');
    const clearSound = document.getElementById('clearSound');
    // You might want a specific fill sound: const fillSound = document.getElementById('fillSound');

    // App state
    let isDrawing = false;
    let currentTool = 'pen'; // 'pen', 'eraser', or 'fill'
    let currentColor = '#000000';
    let currentBrushSize = 5;
    let lastX = 0;
    let lastY = 0;

    // Undo/Redo stacks
    let history = [];
    let historyStep = -1;
    let currentTemplateImage = null;

    const colors = [
        '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3',
        '#000000', '#FFFFFF', '#808080', '#C0C0C0', '#FFC0CB', '#A52A2A', '#FFA500',
        '#ADD8E6', '#90EE90', '#FFFFE0', '#E6E6FA', '#D2B48C', '#F5DEB3', '#FAEBD7'
    ];

    const templates = [
        // Replace with your actual local image paths or keep using placeholders
        { name: 'Animal Theme', src: 'assets/images/Coolfun.png' }, // Example for local
        { name: 'Vehicle Theme', src: 'https://picsum.photos/seed/carB/300/225?grayscale' },
        { name: 'Nature Theme', src: 'https://picsum.photos/seed/natureC/300/225?grayscale' },
    ];

    function playSound(soundElement) {
        if (soundElement) {
            soundElement.currentTime = 0;
            soundElement.play().catch(e => console.warn("Audio play failed:", e));
        }
    }

    // --- Initialize ---
    function init() {
        setupCanvas();
        populateColorPalette();
        populateTemplates();
        addEventListeners();
        setBrushSize(currentBrushSize);
        setActiveTool(penToolBtn); // Pen is default
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
        clearCanvas(false);
        setupCanvas();
        if (currentTemplateImage) {
            drawTemplate(currentTemplateImage);
        }
        history = [];
        historyStep = -1;
        saveInitialState();
        updateUndoRedoButtons();
    });

    function handleColorSelection(swatchElement, color) {
        currentColor = color;
        ctx.strokeStyle = currentColor; // For pen tool
        ctx.fillStyle = currentColor;   // For fill tool (and future shape tools)
        playSound(clickSound);

        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected-color'));
        swatchElement.classList.add('selected-color');

        // If eraser was active, switch to pen when a color is picked.
        // If fill was active, it remains active with the new color.
        if (currentTool === 'eraser') {
            currentTool = 'pen';
            setActiveTool(penToolBtn);
        }
    }

    function populateColorPalette() {
        colorPaletteContainer.innerHTML = '';
        if (colors.length === 0) {
            ctx.strokeStyle = currentColor; // Default
            return;
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
            swatch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleColorSelection(swatch, color);
                }
            });
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
            item.innerHTML = `
                <div class="w-full h-[100px] bg-gray-200 animate-pulse rounded flex items-center justify-center">
                    <i class="fas fa-image fa-2x text-gray-400"></i>
                </div>
                <p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>
            `;
            const img = new Image();
            if (template.src.startsWith('https://')) { // Only for external images
                img.crossOrigin = "Anonymous";
            }
            img.onload = () => {
                item.innerHTML = `
                    <img src="${img.src}" alt="${template.name}" class="w-full h-auto max-h-[100px] object-contain rounded">
                    <p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>
                `;
            };
            img.onerror = (event) => {
                item.innerHTML = `
                    <div class="w-full h-[100px] bg-red-100 rounded flex flex-col items-center justify-center">
                        <i class="fas fa-exclamation-triangle fa-2x text-red-400"></i>
                        <p class="text-xs text-red-500 mt-1">Load failed</p>
                    </div>
                    <p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>
                `;
                console.error(`Failed to load template: ${img.src}`, event);
            };
            img.src = template.src;

            item.addEventListener('click', () => {
                if (img.complete && img.naturalWidth !== 0) {
                    playSound(clickSound);
                    loadTemplate(img);
                } else {
                    alert("Template image is still loading or failed to load.");
                }
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
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > canvasAspect) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgAspect;
        } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgAspect;
        }
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = (canvas.height - drawHeight) / 2;
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }


    // --- Event Handlers ---
    function addEventListeners() {
        canvas.addEventListener('mousedown', handleCanvasInteraction);
        canvas.addEventListener('mousemove', draw); // Draw is only for pen/eraser while mouse is down
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing); // Stop if mouse leaves canvas

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); handleCanvasInteraction(e.touches[0]);
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (currentTool === 'pen' || currentTool === 'eraser') draw(e.touches[0]);
        }, { passive: false });
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault(); stopDrawing();
        }, { passive: false });

        brushSizeInput.addEventListener('input', (e) => setBrushSize(e.target.value));

        penToolBtn.addEventListener('click', () => {
            currentTool = 'pen';
            playSound(clickSound);
            setActiveTool(penToolBtn);
        });
        eraserToolBtn.addEventListener('click', () => {
            currentTool = 'eraser';
            playSound(clickSound);
            setActiveTool(eraserToolBtn);
        });
        fillToolBtn.addEventListener('click', () => { // Listener for fill tool
            currentTool = 'fill';
            playSound(clickSound);
            setActiveTool(fillToolBtn);
        });

        clearBtn.addEventListener('click', () => {
            playSound(clearSound);
            if (confirm("Are you sure you want to clear everything?")) {
                clearCanvas(false); // Clear without saving to history yet
                if (currentTemplateImage) { // If there was a template, redraw it
                    drawTemplate(currentTemplateImage);
                }
                saveState(); // Save the cleared (or template-restored) state
            }
        });
        saveBtn.addEventListener('click', () => {
            playSound(clickSound);
            saveImage();
        });
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
    }

    function handleCanvasInteraction(e) {
        if (currentTool === 'fill') {
            const pos = getMousePos(e);
            floodFill(Math.floor(pos.x), Math.floor(pos.y), hexToRgb(currentColor));
            // playSound(fillSound || clickSound); // Use a specific fill sound if available
            playSound(clickSound);
            saveState(); // Save state after fill
        } else if (currentTool === 'pen' || currentTool === 'eraser') {
            startDrawing(e);
        }
    }

    function setActiveTool(activeButton) {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active-tool'));
        activeButton.classList.add('active-tool');
        // Update cursor based on active tool
        if (activeButton === penToolBtn || activeButton === eraserToolBtn) {
            canvas.style.cursor = 'crosshair';
        } else if (activeButton === fillToolBtn) {
            canvas.style.cursor = 'copy'; // Or 'url(path/to/bucket-cursor.cur), auto'
        } else {
            canvas.style.cursor = 'default';
        }
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

    // --- Drawing Logic (Pen/Eraser) ---
    function startDrawing(e) {
        if (currentTool !== 'pen' && currentTool !== 'eraser') return;
        isDrawing = true;
        const pos = getMousePos(e);
        [lastX, lastY] = [pos.x, pos.y];

        if (currentTool === 'pen' && drawSound) drawSound.play().catch(err => console.warn("Draw sound failed", err));
        else if (currentTool === 'eraser' && eraseSound) eraseSound.play().catch(err => console.warn("Erase sound failed", err));

        // For single click drawing (dots)
        ctx.beginPath();
        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = currentColor; // Use fillStyle for dots
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)'; // For destination-out, actual color doesn't matter, alpha does
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Reset for line drawing
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
    }

    function draw(e) {
        if (!isDrawing || (currentTool !== 'pen' && currentTool !== 'eraser')) return;
        const pos = getMousePos(e);
        // ctx.beginPath(); // No: continue the path started in startDrawing or previous draw
        ctx.moveTo(lastX, lastY);

        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentBrushSize;
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = currentBrushSize;
        }
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        [lastX, lastY] = [pos.x, pos.y];
    }

    function stopDrawing() {
        if (!isDrawing && currentTool !== 'fill') return; // Fill tool doesn't use isDrawing state in the same way

        if (currentTool === 'pen' || currentTool === 'eraser') {
            if (isDrawing) { // Only if a stroke was actually made
                ctx.closePath();
                saveState(); // Save state after pen/eraser stroke
            }
            if (drawSound && !drawSound.paused) drawSound.pause();
            if (eraseSound && !eraseSound.paused) eraseSound.pause();
        }
        isDrawing = false; // Reset for next pen/eraser stroke
    }

    // --- Flood Fill Implementation ---
    function hexToRgb(hex) {
        const bigint = parseInt(hex.slice(1), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return [r, g, b, 255]; // RGBA, A is 255 for fully opaque
    }

    function colorsMatch(c1, c2, tolerance = 5) { // Added small tolerance for anti-aliasing
        if (!c1 || !c2 || c1.length !== c2.length) return false;
        return Math.abs(c1[0] - c2[0]) <= tolerance &&
               Math.abs(c1[1] - c2[1]) <= tolerance &&
               Math.abs(c1[2] - c2[2]) <= tolerance &&
               Math.abs(c1[3] - c2[3]) <= tolerance;
    }

    function floodFill(startX, startY, fillColorRgba) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const getPixelIndex = (x, y) => (y * canvasWidth + x) * 4;

        const startNode = getPixelIndex(startX, startY);
        if (startNode < 0 || startNode >= data.length) return; // Clicked outside

        const targetColorRgba = [
            data[startNode], data[startNode + 1], data[startNode + 2], data[startNode + 3]
        ];

        if (colorsMatch(targetColorRgba, fillColorRgba, 0)) { // Exact match for this check
            console.log("Target color is same as fill color.");
            return;
        }
        // If target is fully transparent and fill is also fully transparent, skip
        if (targetColorRgba[3] === 0 && fillColorRgba[3] === 0) {
             console.log("Target and fill are both transparent.");
            return;
        }


        const queue = [[startX, startY]];
        // Using a typed array for visited map can be more memory efficient for large canvases
        // but Set is fine for most cases and simpler.
        const visited = new Set();
        visited.add(`${startX},${startY}`); // Mark start as visited

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const currentIndex = getPixelIndex(x, y);

            // Set the color for the current pixel
            data[currentIndex] = fillColorRgba[0];
            data[currentIndex + 1] = fillColorRgba[1];
            data[currentIndex + 2] = fillColorRgba[2];
            data[currentIndex + 3] = fillColorRgba[3];

            const neighbors = [
                [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
            ];

            for (const [nx, ny] of neighbors) {
                const neighborKey = `${nx},${ny}`;
                if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight && !visited.has(neighborKey)) {
                    const neighborIndex = getPixelIndex(nx, ny);
                    const neighborColorRgba = [
                        data[neighborIndex], data[neighborIndex + 1],
                        data[neighborIndex + 2], data[neighborIndex + 3]
                    ];
                    if (colorsMatch(neighborColorRgba, targetColorRgba)) {
                        visited.add(neighborKey);
                        queue.push([nx, ny]);
                    }
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // --- Actions ---
    function clearCanvas(saveHistory = true) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'white';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        currentTemplateImage = null;
        // No saveState here, it's called by the clearBtn handler after potential template redraw
    }

    function saveImage() {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'my-coloring.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Undo/Redo ---
    function saveInitialState() {
        history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        historyStep = 0;
        updateUndoRedoButtons();
    }

    function saveState() {
        if (historyStep < history.length - 1) {
            history = history.slice(0, historyStep + 1);
        }
        const maxHistorySize = 20;
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > maxHistorySize) {
            history.shift();
        }
        historyStep = history.length - 1;
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyStep > 0) {
            playSound(clickSound);
            historyStep--;
            ctx.putImageData(history[historyStep], 0, 0);
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyStep < history.length - 1) {
            playSound(clickSound);
            historyStep++;
            ctx.putImageData(history[historyStep], 0, 0);
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyStep <= 0;
        redoBtn.disabled = historyStep >= history.length - 1;
        undoBtn.classList.toggle('opacity-50', undoBtn.disabled);
        undoBtn.classList.toggle('cursor-not-allowed', undoBtn.disabled);
        redoBtn.classList.toggle('opacity-50', redoBtn.disabled);
        redoBtn.classList.toggle('cursor-not-allowed', redoBtn.disabled);
    }

    // --- Start the app ---
    init();
});