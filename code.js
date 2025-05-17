document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');

    const colorPaletteContainer = document.getElementById('colorPalette');
    const brushSizeInput = document.getElementById('brushSize');
    const brushSizeValueDisplay = document.getElementById('brushSizeValue');
    const penToolBtn = document.getElementById('penTool');
    const eraserToolBtn = document.getElementById('eraserTool');
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

    // App state
    let isDrawing = false;
    let currentTool = 'pen';
    let currentColor = '#000000'; // Default color
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

    // Updated templates with Unsplash Source URLs
    // Note: These provide random images. For a real app, use specific, locally hosted images.
    // Keywords like 'outline', 'coloring page', 'line art' are used to get suitable images.
  // In your script.js
const templates = [
    { name: 'Animal Theme', src: 'assets/images/Coolfun.png' },
    { name: 'Vehicle Theme', src: 'https://picsum.photos/seed/carB/300/225?grayscale' },
    { name: 'Nature Theme', src: 'https://picsum.photos/seed/natureC/300/225?grayscale' },
    { name: 'Abstract Theme', src: 'https://picsum.photos/seed/monsterD/300/225?grayscale&blur=2' }
];

    function playSound(soundElement) {
        if (soundElement) {
            soundElement.currentTime = 0;
            soundElement.play().catch(e => console.warn("Audio play failed:", e));
        }
    }

    function init() {
        setupCanvas();
        populateColorPalette(); // Now correctly sets initial color
        populateTemplates();
        addEventListeners();
        setBrushSize(currentBrushSize);
        setActiveTool(penToolBtn);
        saveInitialState();
        updateUndoRedoButtons();
    }

    function setupCanvas() {
        const canvasContainer = document.querySelector('.canvas-container');
        const containerWidth = canvasContainer.offsetWidth - 20; // Account for padding
        const containerHeight = canvasContainer.offsetHeight - 20;

        let canvasWidth = containerWidth;
        let canvasHeight = containerWidth * (3/4); // Maintain 4:3 aspect ratio

        if (canvasHeight > containerHeight) {
            canvasHeight = containerHeight;
            canvasWidth = canvasHeight * (4/3);
        }
        if (canvasWidth > containerWidth) { // Ensure it doesn't exceed container width after height adjustment
            canvasWidth = containerWidth;
            canvasHeight = canvasWidth * (3/4);
        }

        canvas.width = Math.max(300, canvasWidth); // Min width 300px
        canvas.height = Math.max(225, canvasHeight); // Min height 225px (maintaining 4:3)
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentColor; // Set initial stroke color
        ctx.lineWidth = currentBrushSize; // Set initial line width
    }
    
    window.addEventListener('resize', () => {
        // Simpler resize: clear canvas, redraw template if present, reset history.
        // This avoids complex scaling of existing drawings which can be error-prone.
        clearCanvas(false); // Clear without saving this intermediate step to history
        setupCanvas();      // Re-calculates canvas size and clears to white

        if (currentTemplateImage) {
            drawTemplate(currentTemplateImage);
        }
        // Reset history as pixel data from before resize is not directly compatible
        history = [];
        historyStep = -1;
        saveInitialState(); // Save the new blank/template state
        updateUndoRedoButtons();
    });

    // *** MODIFIED populateColorPalette and new handleColorSelection ***
    function handleColorSelection(swatchElement, color) {
        currentColor = color;
        ctx.strokeStyle = currentColor; // Update context's stroke style immediately
        playSound(clickSound);

        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected-color'));
        swatchElement.classList.add('selected-color');

        if (currentTool === 'eraser') {
            currentTool = 'pen';
            setActiveTool(penToolBtn);
        }
    }

    function populateColorPalette() {
        colorPaletteContainer.innerHTML = ''; // Clear existing swatches first

        if (colors.length === 0) {
            console.warn("No colors defined for the palette.");
            // currentColor remains the initial default '#000000'
            ctx.strokeStyle = currentColor; // Ensure context has a strokeStyle
            return;
        }

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.setAttribute('role', 'button');
            swatch.setAttribute('aria-label', `Color ${color}`);
            swatch.tabIndex = 0; // For keyboard accessibility

            swatch.addEventListener('click', () => handleColorSelection(swatch, color));
            swatch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); // Prevent page scroll on space
                    handleColorSelection(swatch, color);
                }
            });
            colorPaletteContainer.appendChild(swatch);
        });

        // Select the first color by default
        const firstSwatch = colorPaletteContainer.firstChild;
        if (firstSwatch) {
            firstSwatch.classList.add('selected-color');
            currentColor = firstSwatch.dataset.color;
            ctx.strokeStyle = currentColor; // Important: set initial context strokeStyle
        } else {
            // Fallback if colors array was not empty but no swatches were added (should not happen)
            currentColor = colors[0]; // Logical default
            ctx.strokeStyle = currentColor;
            console.warn("Color swatches were not added. Defaulting color logically.");
        }
    }

    function populateTemplates() {
        templateContainer.innerHTML = ''; // Clear existing templates
        templates.forEach(template => {
            const item = document.createElement('div');
            item.classList.add('template-item', 'p-2', 'bg-white', 'rounded', 'shadow-sm', 'hover:shadow-md', 'flex', 'flex-col', 'items-center');
            // Add a placeholder for the image while it loads
            item.innerHTML = `
                <div class="w-full h-[100px] bg-gray-200 animate-pulse rounded flex items-center justify-center">
                    <i class="fas fa-image fa-2x text-gray-400"></i>
                </div>
                <p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>
            `;
            
            const img = new Image();
            // *** MODIFIED: Add crossOrigin for external images ***
           
            img.onload = () => {
                // Replace placeholder with actual image
                item.innerHTML = `
                    <img src="${img.src}" alt="${template.name}" class="w-full h-auto max-h-[100px] object-contain rounded">
                    <p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>
                `;
            };
            img.onerror = () => {
                item.innerHTML = `
                    <div class="w-full h-[100px] bg-red-100 rounded flex flex-col items-center justify-center">
                        <i class="fas fa-exclamation-triangle fa-2x text-red-400"></i>
                        <p class="text-xs text-red-500 mt-1">Load failed. Path attempted: ${img.src}</p>
                    </div>
                    <p class="text-sm text-center text-gray-600 mt-1 truncate w-full">${template.name}</p>
                `;
            };
            img.src = template.src; // Start loading image

            item.addEventListener('click', () => {
                if (img.complete && !img.naturalWidth == 0) { // Check if image actually loaded
                    playSound(clickSound);
                    loadTemplate(img); // Pass the already loaded image object
                } else {
                    alert("Template image is still loading or failed to load. Please wait or try another.");
                }
            });
            templateContainer.appendChild(item);
        });
    }
    
    // *** MODIFIED: loadTemplate now accepts an Image object ***
    function loadTemplate(imgObject) { // Expects an already loaded Image object
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

    function addEventListeners() {
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchend', (e) => { e.preventDefault(); stopDrawing(); }, { passive: false });

        brushSizeInput.addEventListener('input', (e) => setBrushSize(e.target.value));
        
        penToolBtn.addEventListener('click', () => {
            currentTool = 'pen';
            ctx.strokeStyle = currentColor; // Ensure pen uses selected color
            playSound(clickSound);
            setActiveTool(penToolBtn);
        });
        eraserToolBtn.addEventListener('click', () => {
            currentTool = 'eraser';
            playSound(clickSound);
            setActiveTool(eraserToolBtn);
        });

        clearBtn.addEventListener('click', () => {
            playSound(clearSound);
            if (confirm("Are you sure you want to clear everything?")) {
                clearCanvas(true); // Clears and saves history
                // currentTemplateImage is reset in clearCanvas
                // No need to redraw template here as clearCanvas implies starting fresh
            }
        });
        saveBtn.addEventListener('click', () => {
            playSound(clickSound);
            saveImage();
        });
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
    }

    function setActiveTool(activeButton) {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active-tool'));
        activeButton.classList.add('active-tool');
    }

    function setBrushSize(size) {
        currentBrushSize = size;
        ctx.lineWidth = currentBrushSize; // Update context's line width immediately
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
        isDrawing = true;
        const pos = getMousePos(e);
        [lastX, lastY] = [pos.x, pos.y];
        
        if (currentTool === 'pen' && drawSound) {
            drawSound.play().catch(err => console.warn("Draw sound play failed", err));
        } else if (currentTool === 'eraser' && eraseSound) {
            eraseSound.play().catch(err => console.warn("Erase sound play failed", err));
        }

        // For single click drawing (dots)
        // Set composite operation and fill/stroke style based on tool *before* drawing
        ctx.beginPath(); // Important to start a new path for the dot
        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = currentColor;
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            // For destination-out, fillStyle's alpha component is what matters.
            // Any opaque color will "erase".
            ctx.fillStyle = 'rgba(0,0,0,1)'; 
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Prepare for line drawing (if mouse moves)
        // The draw() function will handle its own beginPath, moveTo, lineTo, stroke for segments.
        // So, we don't strictly need to beginPath/moveTo here for the line part.
        // lastX, lastY is already set for the draw() function to pick up.
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        
        ctx.beginPath(); // Start a new path for this segment
        ctx.moveTo(lastX, lastY);

        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor; // Already set by color selection or pen tool click
            ctx.lineWidth = currentBrushSize; // Already set by brush size slider
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)'; // Alpha must be 1 for destination-out to work
            ctx.lineWidth = currentBrushSize;
        }
        
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        [lastX, lastY] = [pos.x, pos.y];
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        // ctx.closePath(); // Not strictly necessary for line segments drawn this way
        
        if (drawSound && !drawSound.paused) drawSound.pause();
        if (eraseSound && !eraseSound.paused) eraseSound.pause();
        
        saveState();
    }

    function clearCanvas(saveHistory = true) {
        ctx.globalCompositeOperation = 'source-over'; // Reset composite operation
        ctx.fillStyle = 'white';
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear
        ctx.fillRect(0, 0, canvas.width, canvas.height);  // Fill with white (important for save)
        currentTemplateImage = null; // Reset template tracking
        if (saveHistory) {
            saveState();
        }
    }

    function saveImage() {
        // Temporarily draw a white background if canvas is transparent and has a template
        // This ensures saved PNG has a white background instead of transparent if desired.
        // Our current setup always draws on an opaque white canvas from setupCanvas/clearCanvas.
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'my-coloring.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function saveInitialState() {
        // Ensure any default drawing state (e.g. white background) is captured.
        // This needs to be called after setupCanvas() and any initial template loading (if any).
        // Currently, setupCanvas makes it white, which is correct.
        history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        historyStep = 0;
        updateUndoRedoButtons();
    }
    
    function saveState() {
        if (historyStep < history.length - 1) {
            history = history.slice(0, historyStep + 1);
        }
        const maxHistorySize = 20;
        if (history.length >= maxHistorySize) {
            history.shift();
        } else {
            historyStep++; // Increment step only if not replacing last or shifting
        }
         // If history was truncated, historyStep might be out of sync with length before push
        history[history.length > 0 ? Math.min(historyStep, history.length -1) : 0] = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Simpler:
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > maxHistorySize) {
            history.shift(); // Remove oldest
        }
        historyStep = history.length -1;


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

    init();
});