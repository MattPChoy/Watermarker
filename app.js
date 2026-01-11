// Application State
const state = {
    images: [],                    // Array of loaded images
    currentImageIndex: 0,          // Currently displayed image
    watermarkSettings: [],         // Per-image watermark settings
    canvas: null,
    ctx: null,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    isLoading: false,              // Loading state
    loadingProgress: 0,            // Number of images loaded
    totalToLoad: 0,                // Total images to load
    cancelLoading: false,          // Cancel flag
    isRotating: false,             // Rotation handle state
    rotationStartAngle: 0,         // Starting angle for rotation
    isResizing: false,             // Resize handle state
    resizeStartSize: 0,            // Starting size for resize
    resizeStartDistance: 0         // Starting distance for resize
};

// Default watermark settings
const defaultWatermarkSettings = {
    text: '© MattPChoy 2025',
    x: 400,
    y: 300,
    opacity: 0.5,
    fontSize: 48,
    rotation: 0
};

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const canvasSection = document.getElementById('canvasSection');
const controlsSection = document.getElementById('controlsSection');
const canvas = document.getElementById('canvas');
const watermarkTextInput = document.getElementById('watermarkText');
const opacitySlider = document.getElementById('opacitySlider');
const sizeSlider = document.getElementById('sizeSlider');
const rotationSlider = document.getElementById('rotationSlider');
const opacityValue = document.getElementById('opacityValue');
const sizeValue = document.getElementById('sizeValue');
const rotationValue = document.getElementById('rotationValue');
const downloadBtn = document.getElementById('downloadBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const newImageBtn = document.getElementById('newImageBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const imageCounter = document.getElementById('imageCounter');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const cancelLoadingBtn = document.getElementById('cancelLoadingBtn');

// Initialize
function init() {
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');

    // Upload zone events
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);

    // File input
    fileInput.addEventListener('change', handleFileSelect);

    // Canvas events for dragging watermark
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // Control panel events
    watermarkTextInput.addEventListener('input', debounce(handleTextChange, 150));
    opacitySlider.addEventListener('input', handleOpacityChange);
    sizeSlider.addEventListener('input', handleSizeChange);
    rotationSlider.addEventListener('input', handleRotationChange);
    downloadBtn.addEventListener('click', downloadImage);
    downloadAllBtn.addEventListener('click', downloadAllImages);
    newImageBtn.addEventListener('click', resetToUpload);

    // Navigation events
    prevBtn.addEventListener('click', showPreviousImage);
    nextBtn.addEventListener('click', showNextImage);

    // Loading events
    cancelLoadingBtn.addEventListener('click', cancelImageLoading);
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        handleFiles(files);
    }
}

// File Processing
async function handleFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        alert('Please select image files (JPG, PNG, GIF, WebP)');
        return;
    }

    // Reset state for new batch of images
    state.images = [];
    state.watermarkSettings = [];
    state.currentImageIndex = 0;
    state.isLoading = true;
    state.loadingProgress = 0;
    state.totalToLoad = imageFiles.length;
    state.cancelLoading = false;

    // Show loading UI
    showLoadingUI();

    try {
        // Load images with batching (2 at a time for better performance)
        const BATCH_SIZE = 2;
        let firstImageLoaded = false;

        for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
            if (state.cancelLoading) {
                break;
            }

            const batch = imageFiles.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map((file, batchIndex) =>
                loadSingleImage(file, i + batchIndex)
            );

            await Promise.all(batchPromises);

            // Show first image as soon as it's ready
            if (!firstImageLoaded && state.images.length > 0) {
                loadImageToCanvas();
                showCanvasView();
                updateNavigationUI();
                firstImageLoaded = true;
            }

            // Yield to browser to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Ensure UI is updated if not cancelled
        if (!state.cancelLoading && state.images.length > 0) {
            updateNavigationUI();
        }

    } catch (error) {
        console.error('Error loading images:', error);
        alert('An error occurred while loading some images. Successfully loaded images are still available.');
    } finally {
        state.isLoading = false;
        hideLoadingUI();
    }
}

async function loadSingleImage(file, index) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => {
            console.error(`Failed to read file: ${file.name}`);
            state.loadingProgress++;
            updateLoadingProgress();
            resolve(); // Continue with other images
        };

        reader.onload = async (e) => {
            try {
                const img = new Image();

                await new Promise((imgResolve, imgReject) => {
                    img.onload = () => imgResolve();
                    img.onerror = () => imgReject(new Error('Image decode failed'));
                    img.src = e.target.result;
                });

                state.images[index] = img;
                state.watermarkSettings[index] = { ...defaultWatermarkSettings };
                state.loadingProgress++;

                updateLoadingProgress();
                resolve();

            } catch (error) {
                console.error(`Failed to decode image: ${file.name}`, error);
                state.loadingProgress++;
                updateLoadingProgress();
                resolve(); // Continue with other images
            }
        };

        reader.readAsDataURL(file);
    });
}

// Canvas Operations
function loadImageToCanvas() {
    const img = getCurrentImage();
    if (!img) return;

    const maxWidth = 1400;
    const maxHeight = 900;

    // Calculate scaled dimensions while maintaining aspect ratio
    let width = img.width;
    let height = img.height;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

    width = width * ratio;
    height = height * ratio;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Set initial watermark position to center if not already set
    const settings = getCurrentSettings();
    if (settings.x === defaultWatermarkSettings.x && settings.y === defaultWatermarkSettings.y) {
        settings.x = width / 2;
        settings.y = height / 2;
    }

    // Update UI controls with current settings
    updateControlsFromSettings();

    // Render
    renderCanvas();
}

function renderCanvas() {
    const ctx = state.ctx;
    const img = getCurrentImage();
    const settings = getCurrentSettings();

    if (!img) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw watermark if text exists
    if (settings.text.trim()) {
        drawWatermark();
        drawRotationHandle();
    }
}

function drawWatermark() {
    const ctx = state.ctx;
    const settings = getCurrentSettings();

    ctx.save();

    // Set watermark properties
    ctx.globalAlpha = settings.opacity;
    ctx.font = `bold ${settings.fontSize}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Apply transformations
    ctx.translate(settings.x, settings.y);
    ctx.rotate((settings.rotation * Math.PI) / 180);

    // Draw text with stroke (outline) for better visibility
    ctx.strokeText(settings.text, 0, 0);
    ctx.fillText(settings.text, 0, 0);

    ctx.restore();
}

function drawRotationHandle() {
    const ctx = state.ctx;
    const settings = getCurrentSettings();

    ctx.save();

    // Calculate text bounds
    ctx.font = `bold ${settings.fontSize}px Arial`;
    const metrics = ctx.measureText(settings.text);
    const textHeight = settings.fontSize;

    // Line extends straight up from top of text (accounting for rotation)
    const lineLength = 50;
    const rotationRad = (settings.rotation * Math.PI) / 180;

    // Start point: top of text
    const startX = settings.x;
    const startY = settings.y - textHeight / 2;

    // End point: straight up from there (in rotated space)
    ctx.translate(settings.x, settings.y);
    ctx.rotate(rotationRad);

    // Draw line from top of text going up
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -textHeight / 2);
    ctx.lineTo(0, -textHeight / 2 - lineLength);
    ctx.stroke();

    // Draw rotation handle at end of line
    const handleX = 0;
    const handleY = -textHeight / 2 - lineLength;

    ctx.fillStyle = '#6366f1';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(handleX, handleY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw rotation icon inside handle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handleX, handleY, 5, 0, Math.PI * 1.5);
    ctx.stroke();
    // Draw arrow
    ctx.beginPath();
    ctx.moveTo(handleX - 3, handleY - 5);
    ctx.lineTo(handleX - 3, handleY - 8);
    ctx.lineTo(handleX, handleY - 5);
    ctx.stroke();

    ctx.restore();

    // Draw resize handle at bottom right
    drawResizeHandle();
}

function drawResizeHandle() {
    const ctx = state.ctx;
    const settings = getCurrentSettings();

    ctx.save();

    // Calculate text bounds
    ctx.font = `bold ${settings.fontSize}px Arial`;
    const metrics = ctx.measureText(settings.text);
    const textWidth = metrics.width;
    const textHeight = settings.fontSize;

    // Position at bottom-right corner of text (accounting for rotation)
    const rotationRad = (settings.rotation * Math.PI) / 180;

    ctx.translate(settings.x, settings.y);
    ctx.rotate(rotationRad);

    // Draw bounding box around text with dotted line
    const padding = 10;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
        -textWidth / 2 - padding,
        -textHeight / 2 - padding,
        textWidth + padding * 2,
        textHeight + padding * 2
    );
    ctx.setLineDash([]);

    // Bottom-right corner handle
    const handleX = textWidth / 2 + padding;
    const handleY = textHeight / 2 + padding;

    // Draw resize handle
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(handleX, handleY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw resize icon (diagonal arrows)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Bottom-right arrow
    ctx.moveTo(handleX - 4, handleY + 4);
    ctx.lineTo(handleX + 4, handleY + 4);
    ctx.lineTo(handleX + 4, handleY - 4);
    ctx.stroke();

    ctx.restore();
}

// Mouse Event Handlers for Dragging, Rotation, and Resizing
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const settings = getCurrentSettings();

    // Priority order: handles first, then watermark
    // Check if clicking on rotation handle (highest priority)
    if (isPointInRotationHandle(x, y)) {
        state.isRotating = true;
        const dx = x - settings.x;
        const dy = y - settings.y;
        state.rotationStartAngle = Math.atan2(dy, dx) * (180 / Math.PI) - settings.rotation;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    // Check if clicking on resize handle
    if (isPointInResizeHandle(x, y)) {
        state.isResizing = true;
        const dx = x - settings.x;
        const dy = y - settings.y;
        state.resizeStartDistance = Math.sqrt(dx * dx + dy * dy);
        state.resizeStartSize = settings.fontSize;
        canvas.style.cursor = 'nwse-resize';
        e.preventDefault();
        return;
    }

    // Check if clicking in the bounding box area (for dragging)
    if (isPointInBoundingBox(x, y)) {
        state.isDragging = true;
        state.dragOffsetX = x - settings.x;
        state.dragOffsetY = y - settings.y;
        canvas.classList.add('dragging');
        canvas.classList.remove('draggable');
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const settings = getCurrentSettings();

    if (state.isResizing) {
        const dx = x - settings.x;
        const dy = y - settings.y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const scale = currentDistance / state.resizeStartDistance;

        // Update font size with constraints
        const newSize = Math.max(10, Math.min(200, state.resizeStartSize * scale));
        settings.fontSize = Math.round(newSize);

        // Update slider
        sizeSlider.value = settings.fontSize;
        sizeValue.textContent = `${settings.fontSize}px`;

        renderCanvas();
    } else if (state.isRotating) {
        const dx = x - settings.x;
        const dy = y - settings.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        settings.rotation = (angle - state.rotationStartAngle + 360) % 360;

        // Update slider
        rotationSlider.value = Math.round(settings.rotation);
        rotationValue.textContent = `${Math.round(settings.rotation)}°`;

        renderCanvas();
    } else if (state.isDragging) {
        settings.x = x - state.dragOffsetX;
        settings.y = y - state.dragOffsetY;
        renderCanvas();
    } else {
        // Update cursor based on hover position
        if (isPointInRotationHandle(x, y)) {
            canvas.style.cursor = 'grab';
        } else if (isPointInResizeHandle(x, y)) {
            canvas.style.cursor = 'nwse-resize';
        } else if (isPointInBoundingBox(x, y)) {
            canvas.classList.add('draggable');
            canvas.style.cursor = 'move';
        } else {
            canvas.classList.remove('draggable');
            canvas.style.cursor = 'default';
        }
    }
}

function handleMouseUp() {
    state.isDragging = false;
    state.isRotating = false;
    state.isResizing = false;
    canvas.classList.remove('dragging');
    canvas.style.cursor = 'default';
}

// Touch Event Handlers for Mobile
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    const settings = getCurrentSettings();

    if (isPointInWatermark(x, y)) {
        state.isDragging = true;
        state.dragOffsetX = x - settings.x;
        state.dragOffsetY = y - settings.y;
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    const settings = getCurrentSettings();

    if (state.isDragging) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        settings.x = x - state.dragOffsetX;
        settings.y = y - state.dragOffsetY;
        renderCanvas();
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    state.isDragging = false;
}

// Hit Detection
function isPointInBoundingBox(x, y) {
    const settings = getCurrentSettings();
    if (!settings.text.trim()) return false;

    const ctx = state.ctx;
    ctx.font = `bold ${settings.fontSize}px Arial`;

    const metrics = ctx.measureText(settings.text);
    const textWidth = metrics.width;
    const textHeight = settings.fontSize; // Use full fontSize to match visual box
    const padding = 10; // Match the visual box padding

    // Transform point to local rotated space
    const rotationRad = (settings.rotation * Math.PI) / 180;
    const dx = x - settings.x;
    const dy = y - settings.y;

    // Rotate point back to align with text (inverse rotation)
    const cosR = Math.cos(-rotationRad);
    const sinR = Math.sin(-rotationRad);
    const localX = dx * cosR - dy * sinR;
    const localY = dx * sinR + dy * cosR;


    // Check if point is within the bounding box that matches the visual green box
    return (
        localX >= -textWidth / 2 - padding &&
        localX <= textWidth / 2 + padding &&
        localY >= -textHeight / 2 - padding &&
        localY <= textHeight / 2 + padding
    );
}

function isPointInWatermark(x, y) {
    // Alias for backward compatibility
    return isPointInBoundingBox(x, y);
}

function isPointInRotationHandle(x, y) {
    const settings = getCurrentSettings();
    if (!settings.text.trim()) return false;

    const ctx = state.ctx;
    ctx.font = `bold ${settings.fontSize}px Arial`;
    const textHeight = settings.fontSize;
    const lineLength = 50;

    // Calculate handle position in rotated space
    const rotationRad = (settings.rotation * Math.PI) / 180;

    // Handle is straight up from top of text
    const localHandleX = 0;
    const localHandleY = -textHeight / 2 - lineLength;

    // Transform to canvas space
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    const handleX = settings.x + localHandleX * cosR - localHandleY * sinR;
    const handleY = settings.y + localHandleX * sinR + localHandleY * cosR;

    // Check if point is within handle circle (10px radius + 5px tolerance)
    const dx = x - handleX;
    const dy = y - handleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= 15;
}

function isPointInResizeHandle(x, y) {
    const settings = getCurrentSettings();
    if (!settings.text.trim()) return false;

    const ctx = state.ctx;
    ctx.font = `bold ${settings.fontSize}px Arial`;
    const metrics = ctx.measureText(settings.text);
    const textWidth = metrics.width;
    const textHeight = settings.fontSize;

    // Calculate handle position in rotated space
    const rotationRad = (settings.rotation * Math.PI) / 180;
    const padding = 10;

    // Handle is at bottom-right corner of bounding box
    const localHandleX = textWidth / 2 + padding;
    const localHandleY = textHeight / 2 + padding;

    // Transform to canvas space
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    const handleX = settings.x + localHandleX * cosR - localHandleY * sinR;
    const handleY = settings.y + localHandleX * sinR + localHandleY * cosR;

    // Check if point is within handle circle (10px radius + 5px tolerance)
    const dx = x - handleX;
    const dy = y - handleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= 15;
}

// Control Panel Handlers
function handleTextChange(e) {
    const settings = getCurrentSettings();
    settings.text = e.target.value;
    renderCanvas();
}

function handleOpacityChange(e) {
    const value = e.target.value;
    const settings = getCurrentSettings();
    settings.opacity = value / 100;
    opacityValue.textContent = `${value}%`;
    renderCanvas();
}

function handleSizeChange(e) {
    const value = e.target.value;
    const settings = getCurrentSettings();
    settings.fontSize = parseInt(value);
    sizeValue.textContent = `${value}px`;
    renderCanvas();
}

function handleRotationChange(e) {
    const value = e.target.value;
    const settings = getCurrentSettings();
    settings.rotation = parseInt(value);
    rotationValue.textContent = `${value}°`;
    renderCanvas();
}

// Download Functionality
function downloadImage() {
    // Create a temporary canvas at full resolution
    const img = getCurrentImage();
    const settings = getCurrentSettings();

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Set canvas to original image size (full resolution)
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    // Draw original image at full size
    tempCtx.drawImage(img, 0, 0);

    // Calculate scale factor between display canvas and original image
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;

    // Draw watermark at scaled position
    if (settings.text.trim()) {
        tempCtx.save();

        // Scale watermark properties
        const scaledX = settings.x * scaleX;
        const scaledY = settings.y * scaleY;
        const scaledFontSize = settings.fontSize * ((scaleX + scaleY) / 2);

        tempCtx.globalAlpha = settings.opacity;
        tempCtx.font = `bold ${scaledFontSize}px Arial`;
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.strokeStyle = '#000000';
        tempCtx.lineWidth = 2 * ((scaleX + scaleY) / 2);
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';

        tempCtx.translate(scaledX, scaledY);
        tempCtx.rotate((settings.rotation * Math.PI) / 180);

        tempCtx.strokeText(settings.text, 0, 0);
        tempCtx.fillText(settings.text, 0, 0);

        tempCtx.restore();
    }

    // Export at full quality
    tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
        const imageNum = state.currentImageIndex + 1;
        link.download = `watermarked-${imageNum}-${timestamp}.png`;
        link.href = url;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, 'image/png', 1.0);
}

async function downloadAllImages() {
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = 'Downloading...';

    const totalImages = state.images.length;
    const currentIndex = state.currentImageIndex;

    for (let i = 0; i < totalImages; i++) {
        const img = state.images[i];
        const settings = state.watermarkSettings[i];

        // Create temporary canvas at full resolution
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = img.width;
        tempCanvas.height = img.height;

        // Draw original image
        tempCtx.drawImage(img, 0, 0);

        // Calculate scale factor
        const displayWidth = Math.min(1400, img.width);
        const displayHeight = Math.min(900, img.height);
        const ratio = Math.min(displayWidth / img.width, displayHeight / img.height, 1);
        const canvasWidth = img.width * ratio;
        const canvasHeight = img.height * ratio;

        const scaleX = img.width / canvasWidth;
        const scaleY = img.height / canvasHeight;

        // Draw watermark at scaled position
        if (settings.text.trim()) {
            tempCtx.save();

            const scaledX = settings.x * scaleX;
            const scaledY = settings.y * scaleY;
            const scaledFontSize = settings.fontSize * ((scaleX + scaleY) / 2);

            tempCtx.globalAlpha = settings.opacity;
            tempCtx.font = `bold ${scaledFontSize}px Arial`;
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.strokeStyle = '#000000';
            tempCtx.lineWidth = 2 * ((scaleX + scaleY) / 2);
            tempCtx.textAlign = 'center';
            tempCtx.textBaseline = 'middle';

            tempCtx.translate(scaledX, scaledY);
            tempCtx.rotate((settings.rotation * Math.PI) / 180);

            tempCtx.strokeText(settings.text, 0, 0);
            tempCtx.fillText(settings.text, 0, 0);

            tempCtx.restore();
        }

        // Download
        await new Promise(resolve => {
            tempCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                link.download = `watermarked-${i + 1}-${timestamp}.png`;
                link.href = url;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    resolve();
                }, 100);
            }, 'image/png', 1.0);
        });

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Stay on current image
    state.currentImageIndex = currentIndex;
    updateNavigationUI();

    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = 'Download All';
}

// UI State Management
function showCanvasView() {
    uploadSection.style.display = 'none';
    canvasSection.style.display = 'block';
    controlsSection.style.display = 'block';
}

function resetToUpload() {
    uploadSection.style.display = 'block';
    canvasSection.style.display = 'none';
    controlsSection.style.display = 'none';

    // Reset state
    state.images = [];
    state.watermarkSettings = [];
    state.currentImageIndex = 0;

    // Reset controls to defaults
    watermarkTextInput.value = defaultWatermarkSettings.text;
    opacitySlider.value = defaultWatermarkSettings.opacity * 100;
    sizeSlider.value = defaultWatermarkSettings.fontSize;
    rotationSlider.value = defaultWatermarkSettings.rotation;
    opacityValue.textContent = `${defaultWatermarkSettings.opacity * 100}%`;
    sizeValue.textContent = `${defaultWatermarkSettings.fontSize}px`;
    rotationValue.textContent = `${defaultWatermarkSettings.rotation}°`;

    // Reset file input
    fileInput.value = '';
}

// Navigation Functions
function showPreviousImage() {
    if (state.currentImageIndex > 0) {
        state.currentImageIndex--;
        loadImageToCanvas();
        updateNavigationUI();
    }
}

function showNextImage() {
    if (state.currentImageIndex < state.images.length - 1) {
        state.currentImageIndex++;
        loadImageToCanvas();
        updateNavigationUI();
    }
}

function updateNavigationUI() {
    const totalImages = state.images.length;
    const currentNum = state.currentImageIndex + 1;

    imageCounter.textContent = `${currentNum} / ${totalImages}`;

    // Enable/disable navigation buttons
    prevBtn.disabled = state.currentImageIndex === 0;
    nextBtn.disabled = state.currentImageIndex === totalImages - 1;
}

// Loading UI Functions
function showLoadingUI() {
    loadingOverlay.style.display = 'flex';
    updateLoadingProgress();
}

function hideLoadingUI() {
    loadingOverlay.style.display = 'none';
}

function updateLoadingProgress() {
    const percentage = Math.round((state.loadingProgress / state.totalToLoad) * 100);

    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `Loading image ${state.loadingProgress} of ${state.totalToLoad}...`;
    progressPercent.textContent = `${percentage}%`;
}

function cancelImageLoading() {
    state.cancelLoading = true;
    hideLoadingUI();

    if (state.images.length > 0) {
        // Keep already loaded images
        loadImageToCanvas();
        showCanvasView();
        updateNavigationUI();
    } else {
        // No images loaded, return to upload
        resetToUpload();
    }
}

// Helper Functions
function getCurrentImage() {
    return state.images[state.currentImageIndex];
}

function getCurrentSettings() {
    return state.watermarkSettings[state.currentImageIndex];
}

function updateControlsFromSettings() {
    const settings = getCurrentSettings();

    watermarkTextInput.value = settings.text;
    opacitySlider.value = settings.opacity * 100;
    sizeSlider.value = settings.fontSize;
    rotationSlider.value = settings.rotation;
    opacityValue.textContent = `${Math.round(settings.opacity * 100)}%`;
    sizeValue.textContent = `${settings.fontSize}px`;
    rotationValue.textContent = `${settings.rotation}°`;
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
