document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 600 * dpr;
    canvas.height = 600 * dpr;
    canvas.style.width = '600px';
    canvas.style.height = '600px';
    ctx.scale(dpr, dpr);
    const width = 600;
    const height = 600;
    const baseVectorLength = 50;
    let origin = { x: width / 2, y: height / 2 };

    let zoom = 1.0;
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4.0;

    const initialUnitVectorX = { x: baseVectorLength, y: 0 };
    const initialUnitVectorY = { x: 0, y: -baseVectorLength };
    let unitVectorX = { ...initialUnitVectorX };
    let unitVectorY = { ...initialUnitVectorY };

    let isFirstGame = true;
    let dragging = null;
    let gameWon = false;
    let timer = null;
    let elapsedTime = 0;
    let isPaused = false;
    let isShowingInstructions = false;
    let isShowingSolution = false;
    let hasMovedVector = false;
    let lastDragged = null;
    let isAnimating = false;
    let animationId = null;
    let winTimeoutId = null;
    let dragJustEnded = false;
    let lastShownSolution = { a: null, b: null, c: null, d: null };

    let lastPinchDist = null;
    let lastPinchCenter = null;

    // Pan state
    let panning = false;
    let panStart = null;

    function getScaledPoint(event, rect) {
        let x, y;
        const scaleX = width / canvas.clientWidth;
        const scaleY = height / canvas.clientHeight;

        if (event.type && event.type.includes('touch')) {
            const touch = event.touches[0];
            x = (touch.clientX - rect.left) * scaleX;
            y = (touch.clientY - rect.top) * scaleY;
        } else {
            x = (event.clientX - rect.left) * scaleX;
            y = (event.clientY - rect.top) * scaleY;
        }

        return { x, y };
    }

    function getRandomPoint() {
        if (isFirstGame) {
            const startingPoints = [
                { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
            ];
            isFirstGame = false;
            return startingPoints[Math.floor(Math.random() * startingPoints.length)];
        }
        const min = -5, max = 5;
        let x, y;
        do {
            x = Math.floor(Math.random() * (max - min + 1)) + min;
            y = Math.floor(Math.random() * (max - min + 1)) + min;
        } while ((x === 1 && y === 0) || (x === 0 && y === 1));
        return { x, y };
    }

    function hasIntegerSolution(bluePoint, redPoint) {
        const [b1, b2] = [bluePoint.x, bluePoint.y];
        const [r1, r2] = [redPoint.x, redPoint.y];
        let bestSolution = null;
        let minSum = Infinity;

        for (let a = -6; a <= 6; a++) {
            for (let b = -6; b <= 6; b++) {
                const x1 = a * b1 + b * b2;
                for (let c = -6; c <= 6; c++) {
                    for (let d = -6; d <= 6; d++) {
                        const x2 = c * b1 + d * b2;
                        if (x1 === r1 && x2 === r2) {
                            const sum = Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d);
                            if (sum < minSum) { minSum = sum; bestSolution = { a, b, c, d }; }
                        }
                    }
                }
            }
        }
        return bestSolution;
    }

    function generateValidPoints() {
        let bluePoint, redPoint, solution;
        do {
            bluePoint = getRandomPoint();
            redPoint = getRandomPoint();
            solution = hasIntegerSolution(bluePoint, redPoint);
        } while (bluePoint.x === redPoint.x && bluePoint.y === redPoint.y || !solution);
        return { bluePoint, redPoint, solution };
    }

    let { bluePoint, redPoint, solution } = generateValidPoints();

    // Coordinate conversion — vectors stored in base pixel units; zoom only affects rendering
    function gridToCanvas(point) {
        return {
            x: origin.x + point.x * baseVectorLength * zoom,
            y: origin.y - point.y * baseVectorLength * zoom
        };
    }

    function canvasToGrid(point) {
        return {
            x: Math.round((point.x - origin.x) / (baseVectorLength * zoom)),
            y: Math.round((origin.y - point.y) / (baseVectorLength * zoom))
        };
    }

    function drawGrid() {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'lightgray';
        const vl = baseVectorLength * zoom;

        const iMin = -Math.ceil(origin.x / vl);
        const iMax =  Math.ceil((width - origin.x) / vl);
        for (let i = iMin; i <= iMax; i++) {
            ctx.beginPath();
            ctx.moveTo(origin.x + i * vl, 0);
            ctx.lineTo(origin.x + i * vl, height);
            ctx.stroke();
        }

        const jMin = -Math.ceil(origin.y / vl);
        const jMax =  Math.ceil((height - origin.y) / vl);
        for (let j = jMin; j <= jMax; j++) {
            ctx.beginPath();
            ctx.moveTo(0, origin.y + j * vl);
            ctx.lineTo(width, origin.y + j * vl);
            ctx.stroke();
        }
    }

    function drawAxes() {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, origin.y);
        ctx.lineTo(width, origin.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, height);
        ctx.stroke();

        ctx.font = '16px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText('X', width - 20, origin.y - 10);
        ctx.fillText('Y', origin.x + 10, 20);
    }

    function drawArrow(start, end, color, label = '') {
        const headLength = baseVectorLength * zoom / 5;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        if (label) {
            ctx.font = '16px Arial';
            ctx.fillStyle = color;
            ctx.fillText(label, end.x + 5, end.y - 5);
        }
    }

    function drawPoints() {
        const r = baseVectorLength * zoom / 10;

        const redCanvasPoint = gridToCanvas(redPoint);
        ctx.beginPath();
        ctx.arc(redCanvasPoint.x, redCanvasPoint.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();

        const blueCanvasPoint = gridToCanvas(bluePoint);
        ctx.beginPath();
        ctx.arc(blueCanvasPoint.x, blueCanvasPoint.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'blue';
        ctx.fill();

        drawArrow(origin, blueCanvasPoint, 'blue');
    }

    function drawTransformedVector() {
        const A = [
            [(unitVectorX.x / baseVectorLength), (unitVectorY.x / baseVectorLength)],
            [(-unitVectorX.y / baseVectorLength), (-unitVectorY.y / baseVectorLength)]
        ];
        const transformedBluePoint = {
            x: (A[0][0] * bluePoint.x) + (A[0][1] * bluePoint.y),
            y: (A[1][0] * bluePoint.x) + (A[1][1] * bluePoint.y)
        };
        const transformedBlueCanvasPoint = gridToCanvas(transformedBluePoint);
        const r = baseVectorLength * zoom / 10;
        ctx.beginPath();
        ctx.arc(transformedBlueCanvasPoint.x, transformedBlueCanvasPoint.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'lightblue';
        ctx.fill();
        drawArrow(origin, transformedBlueCanvasPoint, 'lightblue');
        checkWinCondition(transformedBluePoint);
    }

    function drawTransformedGrid() {
        const vl = baseVectorLength * zoom;
        const diag = Math.ceil(Math.sqrt(width * width + height * height) / vl) + 4;
        const ux = unitVectorX.x * zoom, uy = unitVectorX.y * zoom;
        const vx = unitVectorY.x * zoom, vy = unitVectorY.y * zoom;

        ctx.save();
        ctx.strokeStyle = 'rgba(50, 50, 50, 0.55)';
        ctx.lineWidth = 1;

        for (let k = -diag; k <= diag; k++) {
            ctx.beginPath();
            ctx.moveTo(origin.x + k * ux - diag * vx, origin.y + k * uy - diag * vy);
            ctx.lineTo(origin.x + k * ux + diag * vx, origin.y + k * uy + diag * vy);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(origin.x - diag * ux + k * vx, origin.y - diag * uy + k * vy);
            ctx.lineTo(origin.x + diag * ux + k * vx, origin.y + diag * uy + k * vy);
            ctx.stroke();
        }
        ctx.restore();
    }

    function draw() {
        if (isShowingInstructions) return;

        drawGrid();

        const vectorsMoved = (
            unitVectorX.x !== initialUnitVectorX.x || unitVectorX.y !== initialUnitVectorX.y ||
            unitVectorY.x !== initialUnitVectorY.x || unitVectorY.y !== initialUnitVectorY.y
        );

        if (isShowingSolution || gameWon) drawTransformedGrid();
        drawAxes();

        drawArrow(origin,
                 { x: origin.x + initialUnitVectorX.x * zoom, y: origin.y + initialUnitVectorX.y * zoom },
                 'black', 'i');
        drawArrow(origin,
                 { x: origin.x + initialUnitVectorY.x * zoom, y: origin.y + initialUnitVectorY.y * zoom },
                 'black', 'j');

        const labelIX = (unitVectorX.x !== initialUnitVectorX.x || unitVectorX.y !== initialUnitVectorX.y) ? "i'" : '';
        const labelJY = (unitVectorY.x !== initialUnitVectorY.x || unitVectorY.y !== initialUnitVectorY.y) ? "j'" : '';

        drawArrow(origin,
                 { x: origin.x + unitVectorX.x * zoom, y: origin.y + unitVectorX.y * zoom },
                 'green', labelIX);
        drawArrow(origin,
                 { x: origin.x + unitVectorY.x * zoom, y: origin.y + unitVectorY.y * zoom },
                 'green', labelJY);

        drawPoints();
        if (vectorsMoved) drawTransformedVector();
    }

    function isOnVector(point, vector) {
        const vectorPoint = { x: origin.x + vector.x * zoom, y: origin.y + vector.y * zoom };
        const dx0 = point.x - vectorPoint.x;
        const dy0 = point.y - vectorPoint.y;
        const distance = Math.sqrt(dx0 * dx0 + dy0 * dy0);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const vl = baseVectorLength * zoom;
        const baseTouchArea = isMobile ? vl / 2 : vl / 5;

        const isNearOrigin = Math.abs(vector.x) < 1 && Math.abs(vector.y) < 1;
        const effectiveTouchArea = isNearOrigin ? baseTouchArea * 3 : baseTouchArea;
        const nearLine = isNearVectorLine(point, origin, vectorPoint, isNearOrigin);

        if (isNearOrigin && (distance < effectiveTouchArea || nearLine)) {
            ctx.beginPath();
            ctx.arc(vectorPoint.x, vectorPoint.y, effectiveTouchArea, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fill();
        }

        return distance < effectiveTouchArea || nearLine;
    }

    function isNearVectorLine(point, start, end, isNearOrigin) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const baseTolerance = isMobile ? 20 : 10;
        const tolerance = isNearOrigin ? baseTolerance * 2 : baseTolerance;

        const a = point.x - start.x;
        const b = point.y - start.y;
        const c = end.x - start.x;
        const d = end.y - start.y;

        const dot = a * c + b * d;
        const len_sq = c * c + d * d;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;

        let xx, yy;
        if (param < 0)      { xx = start.x; yy = start.y; }
        else if (param > 1) { xx = end.x;   yy = end.y;   }
        else                { xx = start.x + param * c; yy = start.y + param * d; }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy) < tolerance;
    }

    // ── Zoom ──────────────────────────────────────────────────────────────────

    function zoomAt(cx, cy, factor) {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        if (newZoom === zoom) return;
        origin.x = cx - (cx - origin.x) * newZoom / zoom;
        origin.y = cy - (cy - origin.y) * newZoom / zoom;
        zoom = newZoom;
        updateZoomDisplay();
        draw();
    }

    function updateZoomDisplay() {
        const pct = Math.round(zoom * 100) + '%';
        document.querySelectorAll('.zoom-level-display').forEach(el => { el.textContent = pct; });
    }

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const point = getScaledPoint(e, rect);
        zoomAt(point.x, point.y, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    // ── Pointer handling ──────────────────────────────────────────────────────

    function handlePointerMove(event) {
        event.preventDefault();

        // Two-finger pinch zoom + pan
        if (event.touches && event.touches.length === 2) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = width / canvas.clientWidth;
            const scaleY = height / canvas.clientHeight;
            const t0 = event.touches[0], t1 = event.touches[1];
            const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
            const newCx = ((t0.clientX + t1.clientX) / 2 - rect.left) * scaleX;
            const newCy = ((t0.clientY + t1.clientY) / 2 - rect.top) * scaleY;

            if (lastPinchDist !== null) {
                const factor = newDist / lastPinchDist;
                const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
                const actualScale = newZoom / zoom;
                // Zoom around previous center, translate to new center (handles simultaneous pan)
                origin.x = newCx - (lastPinchCenter.x - origin.x) * actualScale;
                origin.y = newCy - (lastPinchCenter.y - origin.y) * actualScale;
                zoom = newZoom;
                updateZoomDisplay();
                draw();
            }

            lastPinchDist = newDist;
            lastPinchCenter = { x: newCx, y: newCy };
            return;
        }

        const rect = canvas.getBoundingClientRect();

        // Raw (unclamped) canvas point — used for panning
        let rawPoint;
        if (event.type && event.type.includes('touch')) {
            if (!event.touches || event.touches.length === 0) return;
            rawPoint = getScaledPoint(event, rect);
        } else {
            rawPoint = getScaledPoint(event, rect);
        }

        // Pan: shift origin by pointer delta
        if (panning && !dragging) {
            if (panStart) {
                origin.x += rawPoint.x - panStart.x;
                origin.y += rawPoint.y - panStart.y;
                draw();
            }
            panStart = rawPoint;
            return;
        }

        // Vector drag (clamped to canvas bounds)
        if (dragging && !isPaused && !isAnimating && !(gameWon && !isShowingSolution)) {
            let point;
            if (event.type && event.type.includes('touch')) {
                const touch = event.touches[0];
                const x = Math.max(rect.left, Math.min(touch.clientX, rect.right));
                const y = Math.max(rect.top, Math.min(touch.clientY, rect.bottom));
                point = getScaledPoint({ type: 'touch', touches: [{ clientX: x, clientY: y }] }, rect);
            } else {
                const x = Math.max(rect.left, Math.min(event.clientX, rect.right));
                const y = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
                point = getScaledPoint({ type: 'mouse', clientX: x, clientY: y }, rect);
            }

            const gridPoint = canvasToGrid(point);
            const snappedX = Math.round(gridPoint.x) * baseVectorLength;
            const snappedY = Math.round(gridPoint.y) * -baseVectorLength;

            if (dragging === 'unitVectorX') { unitVectorX = { x: snappedX, y: snappedY }; hasMovedVector = true; }
            else if (dragging === 'unitVectorY') { unitVectorY = { x: snappedX, y: snappedY }; hasMovedVector = true; }
            draw();
        }
    }

    function handlePointerStart(event) {
        event.preventDefault();

        // Two-finger: start pinch
        if (event.touches && event.touches.length === 2) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = width / canvas.clientWidth;
            const scaleY = height / canvas.clientHeight;
            const t0 = event.touches[0], t1 = event.touches[1];
            lastPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
            lastPinchCenter = {
                x: ((t0.clientX + t1.clientX) / 2 - rect.left) * scaleX,
                y: ((t0.clientY + t1.clientY) / 2 - rect.top) * scaleY
            };
            dragging = null;
            panning = false;
            panStart = null;
            canvas.style.cursor = '';
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const point = getScaledPoint(event, rect);

        dragging = null;

        // Try to grab a vector (only in interactive game states)
        if (!isPaused && !isAnimating && !(gameWon && !isShowingSolution)) {
            const isXAtOrigin = Math.abs(unitVectorX.x) < 1 && Math.abs(unitVectorX.y) < 1;
            const isYAtOrigin = Math.abs(unitVectorY.x) < 1 && Math.abs(unitVectorY.y) < 1;

            if (isXAtOrigin !== isYAtOrigin) {
                const vectorAtOrigin    = isXAtOrigin ? 'unitVectorX' : 'unitVectorY';
                const vectorNotAtOrigin = isXAtOrigin ? 'unitVectorY' : 'unitVectorX';
                const dox = point.x - origin.x, doy = point.y - origin.y;
                const distanceToOrigin = Math.sqrt(dox * dox + doy * doy);
                if (distanceToOrigin < baseVectorLength * zoom) {
                    dragging = vectorAtOrigin; hasMovedVector = true;
                } else if (isOnVector(point, isXAtOrigin ? unitVectorY : unitVectorX)) {
                    dragging = vectorNotAtOrigin; hasMovedVector = true;
                }
            } else if (isXAtOrigin && isYAtOrigin) {
                if (isOnVector(point, unitVectorX) && isOnVector(point, unitVectorY)) {
                    const distToX = Math.sqrt(
                        (point.x - (origin.x + unitVectorX.x * zoom)) ** 2 +
                        (point.y - (origin.y + unitVectorX.y * zoom)) ** 2);
                    const distToY = Math.sqrt(
                        (point.x - (origin.x + unitVectorY.x * zoom)) ** 2 +
                        (point.y - (origin.y + unitVectorY.y * zoom)) ** 2);
                    if (Math.abs(distToX - distToY) > baseVectorLength * zoom / 4)
                        dragging = distToX < distToY ? 'unitVectorX' : 'unitVectorY';
                    else
                        dragging = lastDragged === 'unitVectorX' ? 'unitVectorY' : 'unitVectorX';
                    hasMovedVector = true;
                }
            } else {
                if (isOnVector(point, unitVectorX))      { dragging = 'unitVectorX'; hasMovedVector = true; }
                else if (isOnVector(point, unitVectorY)) { dragging = 'unitVectorY'; hasMovedVector = true; }
            }
        }

        if (dragging) {
            lastDragged = dragging;
            panning = false;
            panStart = null;
        } else {
            // No vector grabbed — pan the view
            panning = true;
            panStart = point;
            canvas.style.cursor = 'grabbing';
        }
    }

    function handlePointerEnd(event) {
        event.preventDefault();
        lastPinchDist = null;
        lastPinchCenter = null;
        dragJustEnded = dragging !== null;
        dragging = null;
        panning = false;
        panStart = null;
        canvas.style.cursor = 'grab';
        draw();
        dragJustEnded = false;
    }

    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerEnd);
    document.addEventListener('mouseleave', handlePointerEnd);

    canvas.addEventListener('mousedown', handlePointerStart);
    canvas.addEventListener('touchstart', handlePointerStart, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('touchend', handlePointerEnd, { passive: false });
    canvas.addEventListener('touchcancel', handlePointerEnd, { passive: false });

    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; }, { passive: false });

    // ── Win condition ─────────────────────────────────────────────────────────

    function checkWinCondition(transformedPoint) {
        if (isAnimating) return;
        const rx = Math.round(transformedPoint.x);
        const ry = Math.round(transformedPoint.y);
        if (rx !== redPoint.x || ry !== redPoint.y) return;

        const a = Math.round(unitVectorX.x / baseVectorLength);
        const b = Math.round(unitVectorY.x / baseVectorLength);
        const c = Math.round(-unitVectorX.y / baseVectorLength);
        const d = Math.round(-unitVectorY.y / baseVectorLength);

        const wasAlreadyWon = gameWon;
        gameWon = true;

        // Only skip if the animation itself just landed here (dragJustEnded=false).
        // If the user dragged to this solution, always play the animation.
        if (!dragJustEnded &&
            a === lastShownSolution.a && b === lastShownSolution.b &&
            c === lastShownSolution.c && d === lastShownSolution.d) return;

        if (!wasAlreadyWon) {
            stopTimer();
            document.getElementById('winMessage').innerText =
                'Congratulations! You won in ' + elapsedTime + ' seconds! ';
            clearTimeout(winTimeoutId);
            winTimeoutId = setTimeout(toggleSolution, 800);
        } else if (dragJustEnded) {
            clearTimeout(winTimeoutId);
            winTimeoutId = setTimeout(toggleSolution, 0);
        }
    }

    // ── Timer ─────────────────────────────────────────────────────────────────

    function startTimer() {
        if (!timer) {
            timer = setInterval(() => {
                if (!isPaused) {
                    elapsedTime += 1;
                    document.getElementById('timer').innerText = `Timer: ${elapsedTime} seconds`;
                }
            }, 1000);
        }
    }

    function stopTimer() { clearInterval(timer); timer = null; }

    // ── UI toggles ────────────────────────────────────────────────────────────

    function toggleInstructions() {
        isShowingInstructions = !isShowingInstructions;
        document.getElementById('instructionsOverlay').style.display = isShowingInstructions ? 'block' : 'none';
        if (isShowingInstructions) {
            isPaused = true;
            setSolutionOverlayVisible(false);
        } else {
            isPaused = false;
            if (isShowingSolution || gameWon) setSolutionOverlayVisible(true);
            draw();
        }
    }

    function setSolutionOverlayVisible(visible) {
        const overlay = document.getElementById('solutionOverlay');
        if (visible) overlay.classList.add('has-solution');
        else         overlay.classList.remove('has-solution');
    }

    function showSolutionText(a, b, c, d) {
        document.getElementById('equation').innerHTML = `
            \\[
            {\\color{green}\\begin{bmatrix} i_x & j_x \\\\ i_y & j_y \\end{bmatrix}}
            {\\color{blue}\\begin{bmatrix} ${bluePoint.x} \\\\ ${bluePoint.y} \\end{bmatrix}}
            =
            {\\color{red}\\begin{bmatrix} ${redPoint.x} \\\\ ${redPoint.y} \\end{bmatrix}}
            \\]`;

        document.getElementById('equationText').innerHTML = `
            \\[
            \\begin{aligned}
            {\\color{green}i_x}({\\color{blue}${bluePoint.x}}) + {\\color{green}j_x}({\\color{blue}${bluePoint.y}}) &= {\\color{red}${redPoint.x}} \\\\
            {\\color{green}i_y}({\\color{blue}${bluePoint.x}}) + {\\color{green}j_y}({\\color{blue}${bluePoint.y}}) &= {\\color{red}${redPoint.y}}
            \\end{aligned}
            \\]`;

        document.getElementById('solutionText').innerHTML = `
            \\[
            \\begin{alignedat}{2}
            {\\color{green}i_x} &= {\\color{green}${a}}, &\\quad {\\color{green}j_x} &= {\\color{green}${b}} \\\\
            {\\color{green}i_y} &= {\\color{green}${c}}, &\\quad {\\color{green}j_y} &= {\\color{green}${d}}
            \\end{alignedat}
            \\]`;

        document.getElementById('vectorMapping').innerHTML = `
            \\[
            i' = ({\\color{green}${a}}, {\\color{green}${c}}), \\; j' = ({\\color{green}${b}}, {\\color{green}${d}})
            \\]`;

        setSolutionOverlayVisible(true);
        MathJax.typeset();
    }

    function toggleSolution() {
        clearTimeout(winTimeoutId);
        winTimeoutId = null;
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }

        const userAlreadyWon = gameWon;
        const userVecX = { ...unitVectorX };
        const userVecY = { ...unitVectorY };

        if (!userAlreadyWon) {
            stopTimer();
            document.getElementById('timer').style.display = 'none';
        }

        isShowingSolution = true;
        isAnimating = true;
        hasMovedVector = true;
        gameWon = false;

        unitVectorX = { ...initialUnitVectorX };
        unitVectorY = { ...initialUnitVectorY };

        let a, b, c, d, targetX, targetY;
        if (userAlreadyWon) {
            a = Math.round(userVecX.x / baseVectorLength);
            b = Math.round(userVecY.x / baseVectorLength);
            c = Math.round(-userVecX.y / baseVectorLength);
            d = Math.round(-userVecY.y / baseVectorLength);
            targetX = userVecX;
            targetY = userVecY;
        } else {
            a = solution.a; b = solution.b; c = solution.c; d = solution.d;
            targetX = { x: solution.a * baseVectorLength, y: -solution.c * baseVectorLength };
            targetY = { x: solution.b * baseVectorLength, y: -solution.d * baseVectorLength };
        }

        showSolutionText(a, b, c, d);
        lastShownSolution = { a, b, c, d };

        const startX = { ...unitVectorX };
        const startY = { ...unitVectorY };
        const duration = 1500;
        const startTime = performance.now();

        function frame(currentTime) {
            const t = Math.min((currentTime - startTime) / duration, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            unitVectorX = { x: startX.x + (targetX.x - startX.x) * ease, y: startX.y + (targetX.y - startX.y) * ease };
            unitVectorY = { x: startY.x + (targetY.x - startY.x) * ease, y: startY.y + (targetY.y - startY.y) * ease };
            draw();

            if (t < 1) {
                animationId = requestAnimationFrame(frame);
            } else {
                animationId = null;
                isAnimating = false;
                unitVectorX = targetX;
                unitVectorY = targetY;
                draw();
            }
        }

        animationId = requestAnimationFrame(frame);
    }

    function togglePause() {
        isPaused = !isPaused;
        document.getElementById('pauseButton').innerText = isPaused ? 'Resume' : 'Pause';
        if (isPaused) {
            stopTimer();
            ctx.clearRect(0, 0, width, height);
            drawGrid();
            drawAxes();
        } else {
            if (!gameWon) startTimer();
            draw();
        }
    }

    // ── Button wiring ─────────────────────────────────────────────────────────

    // Single helper: touchstart fires the action and suppresses the synthetic
    // click so the handler never runs twice on touch devices.
    function bindButton(id, fn) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
        el.addEventListener('touchend',   (e) => e.preventDefault(), { passive: false });
        el.addEventListener('click', fn);
    }

    function handleReset() {
        isFirstGame = false;
        clearTimeout(winTimeoutId);
        winTimeoutId = null;
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        isAnimating = false;
        dragging = null;
        panning = false;
        panStart = null;
        lastPinchDist = null;
        lastPinchCenter = null;

        const points = generateValidPoints();
        bluePoint = points.bluePoint;
        redPoint = points.redPoint;
        solution = points.solution;

        unitVectorX = { ...initialUnitVectorX };
        unitVectorY = { ...initialUnitVectorY };

        zoom = 1.0;
        origin = { x: width / 2, y: height / 2 };
        updateZoomDisplay();

        gameWon = false;
        elapsedTime = 0;
        isPaused = false;
        isShowingInstructions = false;
        isShowingSolution = false;
        hasMovedVector = false;
        lastShownSolution = { a: null, b: null, c: null, d: null };

        document.querySelector('.game-info').style.display = '';
        document.getElementById('winMessage').innerText = '';
        document.getElementById('timer').style.display = '';
        document.getElementById('timer').innerText = `Timer: ${elapsedTime} seconds`;
        document.getElementById('instructionsOverlay').style.display = 'none';
        setSolutionOverlayVisible(false);
        document.getElementById('pauseButton').innerText = 'Pause';
        canvas.style.cursor = 'grab';

        draw();
        stopTimer();
        startTimer();
    }

    bindButton('howToPlayButton', toggleInstructions);
    bindButton('backToGameButton', toggleInstructions);
    bindButton('resetButton', handleReset);
    bindButton('pauseButton', togglePause);
    bindButton('solveButton', toggleSolution);
    bindButton('zoomInButton',  () => zoomAt(width / 2, height / 2, 1.25));
    bindButton('zoomOutButton', () => zoomAt(width / 2, height / 2, 1 / 1.25));

    document.addEventListener('touchstart', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove',  (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

    function handleResize() {
        const displayWidth = Math.min(width, window.innerWidth - 40);
        const scale = displayWidth / width;
        canvas.style.width  = `${displayWidth}px`;
        canvas.style.height = `${height * scale}px`;
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    draw();
    startTimer();
    updateZoomDisplay();
});
