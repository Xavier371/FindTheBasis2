document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Set fixed canvas size
    canvas.width = 600;
    canvas.height = 600;
    const width = canvas.width;
    const height = canvas.height;
    const baseVectorLength = 50;
    let origin = { x: width / 2, y: height / 2 };

    // Initialize vectors
    const initialUnitVectorX = { x: baseVectorLength, y: 0 };
    const initialUnitVectorY = { x: 0, y: -baseVectorLength };
    let unitVectorX = { ...initialUnitVectorX };
    let unitVectorY = { ...initialUnitVectorY };

    // Game state variables
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
    
    function getScaledPoint(event, rect) {
        let x, y;
        const scaleX = canvas.width / canvas.clientWidth;
        const scaleY = canvas.height / canvas.clientHeight;
        
        if (event.type.includes('touch')) {
            const touch = event.touches[0];
            x = (touch.clientX - rect.left) * scaleX;
            y = (touch.clientY - rect.top) * scaleY;
        } else {
            x = (event.clientX - rect.left) * scaleX;
            y = (event.clientY - rect.top) * scaleY;
        }
        
        return { x, y };
    }

    // Point generation functions
    function getRandomPoint() {
        if (isFirstGame) {
            const startingPoints = [
                { x: 1, y: 1 },
                { x: 1, y: -1 },
                { x: -1, y: 1 },
                { x: -1, y: -1 }
            ];
            const randomIndex = Math.floor(Math.random() * startingPoints.length);
            isFirstGame = false;
            return startingPoints[randomIndex];
        }

        const min = -5;
        const max = 5;
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
                            if (sum < minSum) {
                                minSum = sum;
                                bestSolution = { a, b, c, d };
                            }
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

    // Coordinate conversion functions
    function gridToCanvas(point) {
        return {
            x: origin.x + point.x * baseVectorLength,
            y: origin.y - point.y * baseVectorLength
        };
    }

    function canvasToGrid(point) {
        return {
            x: Math.round((point.x - origin.x) / baseVectorLength),
            y: Math.round((origin.y - point.y) / baseVectorLength)
        };
    }

    // Drawing functions
    function drawGrid() {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'lightgray';
        
        for (let i = -Math.ceil(width / (2 * baseVectorLength)); i <= Math.ceil(width / (2 * baseVectorLength)); i++) {
            ctx.beginPath();
            ctx.moveTo(origin.x + i * baseVectorLength, 0);
            ctx.lineTo(origin.x + i * baseVectorLength, height);
            ctx.stroke();
        }

        for (let j = -Math.ceil(height / (2 * baseVectorLength)); j <= Math.ceil(height / (2 * baseVectorLength)); j++) {
            ctx.beginPath();
            ctx.moveTo(0, origin.y + j * baseVectorLength);
            ctx.lineTo(width, origin.y + j * baseVectorLength);
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
        const headLength = baseVectorLength / 5;
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
        ctx.lineTo(
            end.x - headLength * Math.cos(angle - Math.PI / 6),
            end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            end.x - headLength * Math.cos(angle + Math.PI / 6),
            end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
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
        const redCanvasPoint = gridToCanvas(redPoint);
        ctx.beginPath();
        ctx.arc(redCanvasPoint.x, redCanvasPoint.y, baseVectorLength/10, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();

        const blueCanvasPoint = gridToCanvas(bluePoint);
        ctx.beginPath();
        ctx.arc(blueCanvasPoint.x, blueCanvasPoint.y, baseVectorLength/10, 0, Math.PI * 2);
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
        ctx.beginPath();
        ctx.arc(transformedBlueCanvasPoint.x, transformedBlueCanvasPoint.y, baseVectorLength/10, 0, Math.PI * 2);
        ctx.fillStyle = 'lightblue';
        ctx.fill();

        drawArrow(origin, transformedBlueCanvasPoint, 'lightblue');
        checkWinCondition(transformedBluePoint);
    }

    function draw() {
        if (isShowingInstructions || isShowingSolution) return;
        
        drawGrid();
        drawAxes();
        
        drawArrow(origin, 
                 { x: origin.x + initialUnitVectorX.x, y: origin.y + initialUnitVectorX.y }, 
                 'black', 'i');
        drawArrow(origin, 
                 { x: origin.x + initialUnitVectorY.x, y: origin.y + initialUnitVectorY.y }, 
                 'black', 'j');

        const labelIX = (unitVectorX.x !== initialUnitVectorX.x || 
                        unitVectorX.y !== initialUnitVectorX.y) ? "i'" : '';
        const labelJY = (unitVectorY.x !== initialUnitVectorY.x || 
                        unitVectorY.y !== initialUnitVectorY.y) ? "j'" : '';
        
        drawArrow(origin, 
                 { x: origin.x + unitVectorX.x, y: origin.y + unitVectorX.y }, 
                 'green', labelIX);
        drawArrow(origin, 
                 { x: origin.x + unitVectorY.x, y: origin.y + unitVectorY.y }, 
                 'green', labelJY);
        
        drawPoints();

        // Check if either vector has moved from its initial position
        if (unitVectorX.x !== initialUnitVectorX.x || 
            unitVectorX.y !== initialUnitVectorX.y ||
            unitVectorY.x !== initialUnitVectorY.x || 
            unitVectorY.y !== initialUnitVectorY.y) {
            drawTransformedVector();
        }
    }

    function isOnVector(point, vector) {
        const vectorPoint = { x: origin.x + vector.x, y: origin.y + vector.y };
        const distance = Math.sqrt(
            (point.x - vectorPoint.x) ** 2 + 
            (point.y - vectorPoint.y) ** 2
        );
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const baseTouchArea = isMobile ? baseVectorLength/2 : baseVectorLength/5;
        
        // Significantly increase detection area near origin
        const isNearOrigin = Math.abs(vector.x) < 1 && Math.abs(vector.y) < 1;
        const effectiveTouchArea = isNearOrigin ? baseTouchArea * 3 : baseTouchArea;
        
        const nearLine = isNearVectorLine(point, origin, vectorPoint, isNearOrigin);
        
        // Add visual feedback when hovering near a vector at origin
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
        // Double the tolerance near origin
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

        if (param < 0) {
            xx = start.x;
            yy = start.y;
        } else if (param > 1) {
            xx = end.x;
            yy = end.y;
        } else {
            xx = start.x + param * c;
            yy = start.y + param * d;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < tolerance;
    }

    function handlePointerMove(event) {
        event.preventDefault();
        if (dragging && !isPaused && !gameWon) {
            const rect = canvas.getBoundingClientRect();
            let point;
            
            if (event.type.includes('touch')) {
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

            if (dragging === 'unitVectorX') {
                unitVectorX = { x: snappedX, y: snappedY };
                hasMovedVector = true;
            } else if (dragging === 'unitVectorY') {
                unitVectorY = { x: snappedX, y: snappedY };
                hasMovedVector = true;
            }
            draw();
        }
    }

    function handlePointerStart(event) {
        event.preventDefault();
        if (gameWon || isPaused) return;

        const rect = canvas.getBoundingClientRect();
        const point = getScaledPoint(event, rect);

        // Check if exactly one vector is at origin
        const isXAtOrigin = Math.abs(unitVectorX.x) < 1 && Math.abs(unitVectorX.y) < 1;
        const isYAtOrigin = Math.abs(unitVectorY.x) < 1 && Math.abs(unitVectorY.y) < 1;
        
        if (isXAtOrigin !== isYAtOrigin) { // Exactly one vector is at origin
            const vectorAtOrigin = isXAtOrigin ? 'unitVectorX' : 'unitVectorY';
            const vectorNotAtOrigin = isXAtOrigin ? 'unitVectorY' : 'unitVectorX';
            
            // If clicking near origin, always grab the vector at origin
            const distanceToOrigin = Math.sqrt(
                (point.x - origin.x) ** 2 + 
                (point.y - origin.y) ** 2
            );
            
            if (distanceToOrigin < baseVectorLength) {
                dragging = vectorAtOrigin;
                hasMovedVector = true;
            } else if (isOnVector(point, eval(vectorNotAtOrigin))) {
                dragging = vectorNotAtOrigin;
                hasMovedVector = true;
            }
        } else if (isXAtOrigin && isYAtOrigin) {
            // Both vectors at origin - use existing logic
            if (isOnVector(point, unitVectorX) && isOnVector(point, unitVectorY)) {
                const distToX = Math.sqrt(
                    (point.x - (origin.x + unitVectorX.x)) ** 2 + 
                    (point.y - (origin.y + unitVectorX.y)) ** 2
                );
                const distToY = Math.sqrt(
                    (point.x - (origin.x + unitVectorY.x)) ** 2 + 
                    (point.y - (origin.y + unitVectorY.y)) ** 2
                );
                
                if (Math.abs(distToX - distToY) > baseVectorLength/4) {
                    dragging = distToX < distToY ? 'unitVectorX' : 'unitVectorY';
                } else {
                    dragging = lastDragged === 'unitVectorX' ? 'unitVectorY' : 'unitVectorX';
                }
                hasMovedVector = true;
            }
        } else {
            // Neither vector at origin - use normal selection
            if (isOnVector(point, unitVectorX)) {
                dragging = 'unitVectorX';
                hasMovedVector = true;
            } else if (isOnVector(point, unitVectorY)) {
                dragging = 'unitVectorY';
                hasMovedVector = true;
            }
        }

        if (dragging) {
            lastDragged = dragging;
        }
    }

    function handlePointerEnd(event) {
        event.preventDefault();
        if (!gameWon) {
            dragging = null;
            draw();
        }
    }

    // Add global mouse move and up handlers to handle dragging outside canvas
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerEnd);
    document.addEventListener('mouseleave', handlePointerEnd);

    // Canvas-specific event handlers
    canvas.addEventListener('mousedown', handlePointerStart);
    canvas.addEventListener('touchstart', handlePointerStart, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('touchend', handlePointerEnd, { passive: false });
    canvas.addEventListener('touchcancel', handlePointerEnd, { passive: false });
    
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    }, { passive: false });

    function checkWinCondition(transformedPoint) {
        if (Math.round(transformedPoint.x) === redPoint.x && 
            Math.round(transformedPoint.y) === redPoint.y) {
            gameWon = true;
            stopTimer();
            document.getElementById('winMessage').innerText = 
                `Congratulations! You won in ${elapsedTime} seconds! `;
        }
    }

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

    function stopTimer() {
        clearInterval(timer);
        timer = null;
    }

    function toggleInstructions() {
        isShowingInstructions = !isShowingInstructions;
        const overlay = document.getElementById('instructionsOverlay');
        overlay.style.display = isShowingInstructions ? 'block' : 'none';
        
        if (isShowingInstructions) {
            isPaused = true;
        } else {
            isPaused = false;
            draw();
        }
    }

    function toggleSolution() {
        isShowingSolution = !isShowingSolution;
        const overlay = document.getElementById('solutionOverlay');
        
        if (isShowingSolution) {
            isPaused = true;
            const equationText = `
                \\[
                \\begin{bmatrix}
                ${solution.a} & ${solution.b} \\\\
                ${solution.c} & ${solution.d} \\\\
                \\end{bmatrix}
                \\begin{bmatrix}
                ${bluePoint.x} \\\\
                ${bluePoint.y} \\\\
                \\end{bmatrix}
                =
                \\begin{bmatrix}
                ${redPoint.x} \\\\
                ${redPoint.y} \\\\
                \\end{bmatrix}
                \\]
            `;

            const systemText = `
                \\[
                \\begin{aligned}
                ${solution.a}(${bluePoint.x}) + ${solution.b}(${bluePoint.y}) &= ${redPoint.x} \\\\
                ${solution.c}(${bluePoint.x}) + ${solution.d}(${bluePoint.y}) &= ${redPoint.y}
                \\end{aligned}
                \\]
            `;

            const vectorText = `
                \\[
                \\text{} i' = (${solution.a}, ${solution.c}), \\; j' = (${solution.b}, ${solution.d})
                \\]
            `;

            document.getElementById('equation').innerHTML = equationText;
            document.getElementById('equationText').innerHTML = systemText;
            document.getElementById('vectorMapping').innerHTML = vectorText;
            
            MathJax.typeset();
        }
        
        overlay.style.display = isShowingSolution ? 'block' : 'none';
        
        if (!isShowingSolution) {
            isPaused = false;
            draw();
        }
    }

    function togglePause() {
        isPaused = !isPaused;
        document.getElementById('pauseButton').innerText = isPaused ? 'Resume' : 'Pause';
        
        if (isPaused) {
            stopTimer();
            // Only draw grid and axes when paused
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            drawAxes();
        } else {
            if (!gameWon) {
                startTimer();
            }
            // Restore all vectors and points
            draw();
        }
    }

    document.getElementById('howToPlayButton').addEventListener('click', toggleInstructions);
    document.getElementById('backToGameButton').addEventListener('click', toggleInstructions);
    document.getElementById('solveButton').addEventListener('click', toggleSolution);
    document.getElementById('backFromSolutionButton').addEventListener('click', toggleSolution);

    document.getElementById('resetButton').addEventListener('click', () => {
        isFirstGame = false;
        
        // Stop any ongoing dragging
        dragging = null;
        
        const points = generateValidPoints();
        bluePoint = points.bluePoint;
        redPoint = points.redPoint;
        solution = points.solution;
        
        unitVectorX = { ...initialUnitVectorX };
        unitVectorY = { ...initialUnitVectorY };
        
        gameWon = false;
        elapsedTime = 0;
        isPaused = false;
        isShowingInstructions = false;
        isShowingSolution = false;
        hasMovedVector = false;
        
        document.getElementById('winMessage').innerText = '';
        document.getElementById('timer').innerText = `Timer: ${elapsedTime} seconds`;
        document.getElementById('instructionsOverlay').style.display = 'none';
        document.getElementById('solutionOverlay').style.display = 'none';
        document.getElementById('pauseButton').innerText = 'Pause';
        
        // Force pointer end to clean up any lingering drag states
        handlePointerEnd({ preventDefault: () => {} });
        
        draw();
        stopTimer();
        startTimer();
    });
    
    document.getElementById('pauseButton').addEventListener('click', togglePause);
    
    document.addEventListener('touchstart', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
        }
    }, { passive: false });
    
    function handleResize() {
        const displayWidth = Math.min(600, window.innerWidth - 40);
        const scale = displayWidth / canvas.width;
        
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${canvas.height * scale}px`;
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    draw();
    startTimer();

    // Add touch event listeners for the buttons
    document.getElementById('solveButton').addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleSolution();
    });

    document.getElementById('pauseButton').addEventListener('touchend', (e) => {
        e.preventDefault();
        togglePause();
    });

    // Remove old touch event listeners and add new ones with better mobile handling
    const pauseButton = document.getElementById('pauseButton');
    const solveButton = document.getElementById('solveButton');

    // Function to handle both click and touch
    function handleButtonPress(e) {
        e.preventDefault();  // Prevent any default behavior
        e.stopPropagation(); // Stop event from bubbling
        if (e.target.id === 'pauseButton') {
            togglePause();
        } else if (e.target.id === 'solveButton') {
            toggleSolution();
        }
    }

    // Remove any existing listeners
    pauseButton.replaceWith(pauseButton.cloneNode(true));
    solveButton.replaceWith(solveButton.cloneNode(true));

    // Get fresh references after replacing
    const newPauseButton = document.getElementById('pauseButton');
    const newSolveButton = document.getElementById('solveButton');

    // Add all event listeners
    ['click', 'touchstart'].forEach(eventType => {
        newPauseButton.addEventListener(eventType, handleButtonPress, { passive: false });
        newSolveButton.addEventListener(eventType, handleButtonPress, { passive: false });
    });

    // Prevent double-firing on mobile
    newPauseButton.addEventListener('touchend', e => e.preventDefault());
    newSolveButton.addEventListener('touchend', e => e.preventDefault());
}); 
