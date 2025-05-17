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
    let currentTool = 'pen'; // 'pen' or 'eraser'
    let currentColor = '#000000';
    let currentBrushSize = 5;
    let lastX = 0;
    let lastY = 0;

    // Undo/Redo stacks
    let history = [];
    let historyStep = -1;
    let currentTemplateImage = null; // To store the loaded template image

    const colors = [
        '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', // Rainbow
        '#000000', '#FFFFFF', '#808080', '#C0C0C0', '#FFC0CB', '#A52A2A', '#FFA500', // Basic
        '#ADD8E6', '#90EE90', '#FFFFE0', '#E6E6FA', '#D2B48C', '#F5DEB3', '#FAEBD7'  // Pastels
    ];

    const templates = [
        { name: 'Cute Animal', src: 'assets/images/template-animal.png' },
        { name: 'Cool Car', src: 'assets/images/template-car.png' },
        { name: 'Nature Scene', src: 'assets/images/template-nature.png' },
        // Add more templates here
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
        setBrushSize(currentBrushSize); // Initialize brush size display
        setActiveTool(penToolBtn); // Pen is default
        saveInitialState(); // Save blank canvas state for undo
        updateUndoRedoButtons();
    }

    function setupCanvas() {
        const canvasContainer = document.querySelector('.canvas-container');
        // Make canvas responsive by fitting it to its container
        // Use a fixed aspect ratio, e.g., 4:3 or 16:9, or make it more dynamic
        const containerWidth = canvasContainer.offsetWidth - 20; // Account for padding
        const containerHeight = canvasContainer.offsetHeight -20; // Account for padding

        // Let's aim for a common aspect ratio like 4:3 for the drawing area
        // Or, use a simpler approach: make it mostly square-ish or fit available space
        
        // Simple fit:
        // canvas.width = containerWidth;
        // canvas.height = containerHeight > 400 ? containerHeight : 400; // Min height

        // More controlled aspect ratio (e.g. 4:3)
        let canvasWidth = containerWidth;
        let canvasHeight = containerWidth * (3/4);

        if (canvasHeight > containerHeight) {
            canvasHeight = containerHeight;
            canvasWidth = canvasHeight * (4/3);
        }
        // Ensure it doesn't exceed container width
        if (canvasWidth > containerWidth) {
            canvasWidth = containerWidth;
            canvasHeight = containerWidth * (3/4);
        }


        canvas.width = canvasWidth > 300 ? canvasWidth : 300; // Min width
        canvas.height = canvasHeight > 225 ? canvasHeight : 225; // Min height
        
        ctx.fillStyle = 'white'; // Default background for saved images if not transparent
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
    
    window.addEventListener('resize', () => {
        // Debounce resize or save current drawing, resize, then redraw
        // For simplicity, let's just re-init. A better way is to save image data, resize, then put image data.
        const currentDrawing = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setupCanvas();
        ctx.putImageData(currentDrawing, 0, 0);
        if (currentTemplateImage) { // Redraw template if one was active
            drawTemplate(currentTemplateImage);
        }
        // History might be invalidated here, or you'd need to rescale history states.
        // For simplicity, we'll clear history on resize for this example.
        history = [];
        historyStep = -1;
        saveInitialState();
        updateUndoRedoButtons();
    });


    function populateColorPalette() {
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.setAttribute('role', 'button');
            swatch.setAttribute('aria-label', `Color ${color}`);
            swatch.addEventListener('click', () => {
                currentColor = color;
                playSound(clickSound);
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected-color'));
                swatch.classList.add('selected-color');
                // Switch to pen tool if a color is selected
                if (currentTool !== 'pen') {
                    currentTool = 'pen';
                    setActiveTool(penToolBtn);
                }
            });
            colorPaletteContainer.appendChild(swatch);
        });
        // Select the first color by default
        colorPaletteContainer.firstChild.classList.add('selected-color');
    }

    function populateTemplates() {
        templates.forEach(template => {
            const item = document.createElement('div');
            item.classList.add('template-item', 'p-2', 'bg-white', 'rounded', 'shadow-sm', 'hover:shadow-md');
            item.innerHTML = `
                <img src="${template.src}" alt="${template.name}" class="w-full h-auto object-contain rounded">
                <p class="text-sm text-center text-gray-600 mt-1">${template.name}</p>
            `;
            item.addEventListener('click', () => {
                playSound(clickSound);
                loadTemplate(template.src);
            });
            templateContainer.appendChild(item);
        });
    }
    
    function loadTemplate(src) {
        const img = new Image();
        img.onload = () => {
            clearCanvas(false); // Clear without saving history for template load
            currentTemplateImage = img; // Store the current template
            drawTemplate(img);
            saveState(); // Save state *after* template is drawn
        };
        img.onerror = () => {
            alert("Oops! Could not load the coloring page. Please try another one.");
        }
        img.src = src;
    }

    function drawTemplate(img) {
        // Calculate aspect ratio to fit and center the image
        const canvasAspect = canvas.width / canvas.height;
        const imgAspect = img.width / img.height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > canvasAspect) { // Image is wider than canvas
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgAspect;
        } else { // Image is taller or same aspect
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgAspect;
        }

        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = (canvas.height - drawHeight) / 2;
        
        // Set composite operation to draw template 'behind' existing drawings if any (though we clear first)
        // For coloring books, usually you draw on top of the lines.
        // If lines should be preserved, this needs a different strategy (e.g. layers or selective coloring)
        // For this example, the template is just a background.
        // ctx.globalCompositeOperation = 'destination-over'; // If template should be truly in background
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        // ctx.globalCompositeOperation = 'source-over'; // Reset to default
    }


    // --- Event Handlers ---
    function addEventListeners() {
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing); // Stop if mouse leaves canvas

        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchend', (e) => { e.preventDefault(); stopDrawing(); }, { passive: false });


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

        clearBtn.addEventListener('click', () => {
            playSound(clearSound);
            if (confirm("Are you sure you want to clear everything?")) {
                clearCanvas(true);
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

    function setActiveTool(activeButton) {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active-tool'));
        activeButton.classList.add('active-tool');
    }

    function setBrushSize(size) {
        currentBrushSize = size;
        brushSizeValueDisplay.textContent = `${size}px`;
    }

    // --- Drawing Logic ---
    function getMousePos(event) {
        const rect = canvas.getBoundingClientRect();
        // For touch events, clientX/Y are on the event object itself if it's a touch
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
        
        // Play sound based on tool
        if (currentTool === 'pen' && drawSound) {
            drawSound.play().catch(e => console.warn("Draw sound play failed", e));
        } else if (currentTool === 'eraser' && eraseSound) {
            eraseSound.play().catch(e => console.warn("Erase sound play failed", e));
        }

        // For single click drawing (dots)
        ctx.beginPath();
        ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = currentTool === 'pen' ? currentColor : 'white'; // Eraser color
        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fill();
        ctx.beginPath(); // Reset path for line drawing
        ctx.moveTo(lastX, lastY);
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        ctx.beginPath(); // Ensure new path for each segment
        ctx.moveTo(lastX, lastY);

        if (currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentBrushSize;
        } else if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out'; // Erases
            ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter for destination-out, but alpha must be 1
            ctx.lineWidth = currentBrushSize;
        }
        
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        [lastX, lastY] = [pos.x, pos.y];
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.closePath(); // Close the current path
        // Stop sounds
        if (drawSound && !drawSound.paused) drawSound.pause();
        if (eraseSound && !eraseSound.paused) eraseSound.pause();
        
        // Save state for undo/redo
        saveState();
    }

    // --- Actions ---
    function clearCanvas(saveHistory = true) {
        ctx.fillStyle = 'white'; // Ensure background is white for subsequent operations
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Explicitly fill white for saved images
        currentTemplateImage = null; // Reset template if canvas is cleared fully
        if (saveHistory) {
            saveState();
        }
    }

    function saveImage() {
        const dataURL = canvas.toDataURL('image/png'); // Or image/jpeg
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'my-coloring.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Undo/Redo ---
    function saveInitialState() {
        // Save the initial blank (or template-loaded) state
        history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        historyStep = 0;
        updateUndoRedoButtons();
    }
    
    function saveState() {
        // If we've undone, and then draw something new, clear the "redo" history
        if (historyStep < history.length - 1) {
            history = history.slice(0, historyStep + 1);
        }
        // Limit history size (e.g., 20 steps)
        const maxHistorySize = 20;
        if (history.length >= maxHistorySize) {
            history.shift(); // Remove oldest entry
        } else {
            historyStep++;
        }
        history[historyStep] = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
        // Basic styling for disabled state (Tailwind might handle some via :disabled)
        undoBtn.classList.toggle('opacity-50', undoBtn.disabled);
        undoBtn.classList.toggle('cursor-not-allowed', undoBtn.disabled);
        redoBtn.classList.toggle('opacity-50', redoBtn.disabled);
        redoBtn.classList.toggle('cursor-not-allowed', redoBtn.disabled);
    }

    // --- Start the app ---
    init();
});