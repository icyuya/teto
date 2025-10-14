const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score-display');
const levelElement = document.getElementById('level-display');
const nextcanvas = document.getElementById('next-canvas');
const nextCtx = nextcanvas.getContext('2d');
const holdcanvas = document.getElementById('hold-canvas');
const holdCtx = holdcanvas.getContext('2d');

// === 定数定義 ===
const TILE_SIZE = 30;
const FIELD_ROWS = 20;
const FIELD_COLS = 10;
const NEXT_QUEUE_SIZE = 5;
const LOCK_DELAY = 500;
const MAX_LOCK_DELAY_RESETS = 15;
// const DAS_DELAY = 160;
// const ARR_INTERVAL = 50;
const DAS_DELAY = 133;
const ARR_INTERVAL = 1;
const SOFT_DROP_ARR_INTERVAL = 30;

// === ゲームの状態管理変数 ===
let field, currentTetromino, nextQueue, holdTetromino, bag, inputBuffer;
let score, level, linesCleared, canHold, lastTime, lockDelayTimer, lockDelayResets, comboCounter, isBackToBack, lastMovingRotation;
let gameState = 'playing';
let autoShiftState = { direction: null, dasStartTime: 0, arrIntervalTime: 0, isRepeating: false };
let softDropState = { isActive: false, arrIntervalTime: 0 };

// テトリミノの形を定義
const TETROMINOS = {
    T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: 'purple' },
    S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: 'green' },
    Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: 'red' },
    L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: 'orange' },
    J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: 'blue' },
    O: { shape: [[0, 1, 1], [0, 1, 1], [0, 0, 0]], color: 'yellow' },
    I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: 'cyan' }
}

const KICK_DATA = {
    JLSTZ: [
        [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],//0=>1
        [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],//1=>0
        [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],//1=>2
        [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],//2=>1
        [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],//2=>3
        [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],//3=>2
        [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],//3=>0
        [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],//0=>3
    ],
    I: [
        [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],//0=>1
        [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],//1=>0
        [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],//1=>2
        [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],//2=>1
        [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],//2=>3
        [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],//3=>2
        [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],//3=>0
        [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],//0=>3
    ]
}

function initGame() {
    field = Array.from({ length: FIELD_ROWS }, () => new Array(FIELD_COLS).fill(0));

    score = 0;
    level = 1;
    linesCleared = 0;
    holdTetromino = null;
    canHold = true;
    lastTime = 0;
    lockDelayTimer = 0;
    lockDelayResets = 0;
    bag = [];
    nextQueue = [];
    refillNextQueue();
    spawnNewTetromino();
    autoShiftState = { direction: null, dasStartTime: 0, arrIntervalTime: 0, isRepeating: false }
    softDropState = { isActive: false, arrIntervalTime: 0 };
    inputBuffer = [];
    comboCounter = 0;
    isBackToBack = false;
    lastMovingRotation = false;
}

function generateBag() {
    let types = ['T', 'S', 'Z', 'L', 'J', 'O', 'I'];

    for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
    }
    bag = types;
    console.log('New Bag Generated:', bag.join(','));
}

function cloneTetromino(tetromino) {
    if (!tetromino) return null;
    return JSON.parse(JSON.stringify(tetromino));
}


function refillNextQueue() {
    while (nextQueue.length < NEXT_QUEUE_SIZE) {
        if (bag.length === 0) {
            generateBag();
        }

        const type = bag.pop();
        const newTetrominoData = TETROMINOS[type];

        nextQueue.push({
            ...newTetrominoData,
            type: type
        });
    }
}

//ミノランダム生成
function spawnNewTetromino() {
    currentTetromino = cloneTetromino(nextQueue.shift());

    refillNextQueue();

    //現在のミノ
    if (currentTetromino) {
        currentTetromino.x = 3;
        currentTetromino.y = -1;
        currentTetromino.rotationState = 0;
        lastMovingRotation = false;
    }


    //ゲームオーバー判定
    if (currentTetromino && !isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y)) {
        alert('GAME OVER');
        initGame();
        return;
    }
}

//ネクストミノ描画
function drawNextQueue() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextcanvas.clientWidth, nextcanvas.clientHeight);

    nextQueue.forEach((tetromino, index) => {
        const shape = tetromino.shape;
        const color = tetromino.color;

        const yoffset = index * 100;
        const offsetX = (nextcanvas.width - shape[0].length * TILE_SIZE) / 2;
        const offsetY = yoffset + (100 - shape.length * TILE_SIZE) / 2;

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const px = offsetX + x * TILE_SIZE;
                    const py = offsetY + y * TILE_SIZE;
                    nextCtx.fillStyle = color;
                    nextCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    nextCtx.strokeStyle = '#222';
                    nextCtx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
                }
            });
        });
    });
}
//ホールドミノ表示
function drawHoldPiece() {
    holdCtx.fillStyle = '#000';
    holdCtx.fillRect(0, 0, holdcanvas.clientWidth, holdcanvas.clientHeight);

    if (!holdTetromino) return;

    const shape = holdTetromino.shape;
    const color = holdTetromino.color;

    const offsetX = (holdcanvas.clientWidth - shape[0].length * TILE_SIZE) / 2;
    const offsetY = (holdcanvas.clientHeight - shape.length * TILE_SIZE) / 2;

    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const px = offsetX + x * TILE_SIZE;
                const py = offsetY + y * TILE_SIZE;

                holdCtx.fillStyle = color;
                holdCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                holdCtx.strokeStyle = '#222';
                holdCtx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

//ミノ描画
function drawBlock(x, y, color) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    ctx.strokeStyle = '#222';
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
}
//ミノが置けるか
function isValidMove(shape, newX, newY) {
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            //ミノがある部分のみ
            if (shape[y][x]) {
                const fieldX = newX + x;
                const fieldY = newY + y;
                //壁の外にでてないか
                if (fieldX < 0 || fieldX >= FIELD_COLS || fieldY >= FIELD_ROWS) {
                    return false;
                }
                //他のブロックが存在しているか
                if (fieldY >= 0 && field[fieldY][fieldX]) {
                    return false;
                }
            }
        }
    }
    return true;
}

//スコア、レベル更新
function updateUI() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
}
//ゴーストミノ描画
function drawGhostPiece() {
    if (!currentTetromino) return;

    const ghostColor = 'rgba(255,255,255,0.2)';
    let ghostY = currentTetromino.y;

    while (isValidMove(currentTetromino.shape, currentTetromino.x, ghostY + 1)) {
        ghostY++;
    }

    const shape = currentTetromino.shape;
    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const px = (currentTetromino.x + x) * TILE_SIZE;
                const py = (ghostY + y) * TILE_SIZE;
                ctx.fillStyle = ghostColor;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            }
        });
    });
}

//画面描画
function draw() {
    ctx.fillStyle = '#000'; //背景
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    ctx.strokeStyle = '#333';//グリッド線の色
    ctx.lineWidth = 1;//線の太さ
    //縦線の描画
    for (let x = 0; x <= FIELD_COLS; x++) {
        const px = x * TILE_SIZE + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.clientHeight);
        ctx.stroke();
    }
    //横線の描画
    for (let y = 0; y <= FIELD_ROWS; y++) {
        const py = y * TILE_SIZE + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.clientWidth, py);
        ctx.stroke();
    }

    drawGhostPiece();

    for (let y = 0; y < FIELD_ROWS; y++) {
        for (let x = 0; x < FIELD_COLS; x++) {
            if (field[y][x]) {
                drawBlock(x, y, field[y][x]);
            }
        }
    }
    //ミノを描画
    const shape = currentTetromino.shape;
    const color = currentTetromino.color;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                drawBlock(currentTetromino.x + x, currentTetromino.y + y, color);
            }
        }
    }
    updateUI();
    drawNextQueue();
    drawHoldPiece();
}
//ミノの最も低いY座標を取得する
function getLowestY(tetromino) {
    if (!tetromino) return -1;
    let lowest = -1;
    tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockY = tetromino.y + y;
                if (blockY > lowest) {
                    lowest = blockY;
                }
            }
        });
    });
    return lowest;
}

function handleHorizontalMovement(time) {
    if (!currentTetromino || !autoShiftState.direction) return;

    if (!autoShiftState.isRepeating) {
        if (time - autoShiftState.dasStartTime > DAS_DELAY) {
            autoShiftState.isRepeating = true;
            autoShiftState.arrIntervalTime = time;
            moveHorizontally(autoShiftState.direction);
        }
    }
    else {
        while (time - autoShiftState.arrIntervalTime > ARR_INTERVAL) {
            moveHorizontally(autoShiftState.direction);
            autoShiftState.arrIntervalTime += ARR_INTERVAL;
        }
    }
}

function moveHorizontally(direction) {
    const dir = (direction === 'left') ? -1 : 1;
    if (isValidMove(currentTetromino.shape, currentTetromino.x + dir, currentTetromino.y)) {
        currentTetromino.x += dir;
        lastMovingRotation = false;
        if (!isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
            lockDelayTimer = performance.now();
            lockDelayResets++;
        }
    }
}

function moveDown() {
    if (!currentTetromino) return;

    if (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
        currentTetromino.y++;
        lastMovingRotation = false;
        lockDelayResets = 0;
        score++;
        updateUI();
        return true;
    }
    return false;
}

function handleSoftDrop(time) {
    if (!currentTetromino || !softDropState.isActive) return;

    while (time - softDropState.arrIntervalTime > SOFT_DROP_ARR_INTERVAL) {
        moveDown();
        softDropState.arrIntervalTime += SOFT_DROP_ARR_INTERVAL;
    }
}

function handleKeyPress(key) {
    if (!currentTetromino) return;

    const isGrounded = !isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1);

    switch (key) {
        case 'ArrowUp':
            //右回転
            {
                const oldLowestY = getLowestY(currentTetromino);
                const rotated = rotateClockwise(currentTetromino.shape);
                const from = currentTetromino.rotationState;
                const to = (from + 1) % 4;
                const kickTable = (currentTetromino.type === 'I') ? KICK_DATA.I : KICK_DATA.JLSTZ;
                const kickPatterns = kickTable[from * 2];
                for (const [kickX, kickY] of kickPatterns) {
                    const newX = currentTetromino.x + kickX;
                    const newY = currentTetromino.y - kickY;
                    if (isValidMove(rotated, newX, newY)) {
                        currentTetromino.shape = rotated;
                        currentTetromino.x = newX;
                        currentTetromino.y = newY;
                        currentTetromino.rotationState = to;
                        lastMovingRotation = true;
                        if (isGrounded) {
                            const newLowest = getLowestY(currentTetromino);
                            if (newLowest > oldLowestY) {
                                lockDelayResets = 0;
                            } else {
                                lockDelayResets++;
                            }
                            lockDelayTimer = performance.now();
                        }
                        break;
                    }
                }
            }
            break;
        case 'z':
            //左回転
            {
                const oldLowestY = getLowestY(currentTetromino);
                const rotated = rotateCounterClockwise(currentTetromino.shape);
                const from = currentTetromino.rotationState;
                const to = (from + 3) % 4;
                const kickTable = (currentTetromino.type === 'I') ? KICK_DATA.I : KICK_DATA.JLSTZ;
                const kickPatterns = kickTable[to * 2 + 1];

                for (const [kickX, kickY] of kickPatterns) {
                    const newX = currentTetromino.x + kickX;
                    const newY = currentTetromino.y - kickY;
                    if (isValidMove(rotated, newX, newY)) {
                        currentTetromino.shape = rotated;
                        currentTetromino.x = newX;
                        currentTetromino.y = newY;
                        currentTetromino.rotationState = to;
                        lastMovingRotation = true;
                        if (isGrounded) {
                            const newLowest = getLowestY(currentTetromino);
                            if (newLowest > oldLowestY) {
                                lockDelayResets = 0;
                            } else {
                                lockDelayResets++;
                            }
                            lockDelayTimer = performance.now();
                        }
                        break;
                    }
                }
            }
            break;
        case 'c':
            //ホールド
            if (canHold) {
                const typeToHold = currentTetromino.type;
                if (holdTetromino) {
                    const heldType = holdTetromino.type;
                    currentTetromino = cloneTetromino(TETROMINOS[heldType]);
                    currentTetromino.type = heldType;

                    holdTetromino = cloneTetromino(TETROMINOS[typeToHold]);
                    holdTetromino.type = typeToHold;

                    currentTetromino.x = 3;
                    currentTetromino.y = -1;
                    currentTetromino.rotationState = 0;
                }
                else {
                    holdTetromino = cloneTetromino(TETROMINOS[typeToHold]);
                    holdTetromino.type = typeToHold;
                    spawnNewTetromino();
                }
                canHold = false;
                draw();
                return;
            }
            return;
        case ' '://スペース
            //ハードドロップ
            let dropDistance = 0;
            while (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
                currentTetromino.y++;
                dropDistance++;
            }
            if (dropDistance > 0) {
                score += dropDistance * 2;
                updateUI();
            }
            lockTetromino();
            spawnNewTetromino();
            draw();
            return;
    }
}

//キー操作
document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'Control') {
        event.preventDefault();
        initGame();
        return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const direction = (event.key === 'ArrowLeft') ? 'left' : 'right';
        if (autoShiftState.direction !== direction) {
            moveHorizontally(direction);
            autoShiftState.direction = direction;
            autoShiftState.dasStartTime = performance.now();
            autoShiftState.isRepeating = false;
        }
    } else if (event.key === 'ArrowDown') {
        if (!softDropState.isActive) {
            softDropState.isActive = true;
            softDropState.arrIntervalTime = performance.now();
            moveDown();
        }
    } else {
        inputBuffer.push(event.key);
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key == 'ArrowLeft' || event.key == 'ArrowRight') {
        const direction = (event.key === 'ArrowLeft') ? 'left' : 'right';
        if (autoShiftState.direction === direction) {
            autoShiftState.direction = null;
            autoShiftState.isRepeating = false;
        }
    } else if (event.key === 'ArrowDown') {
        softDropState.isActive = false;
    }
});

//右回転
function rotateClockwise(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            result[x][N - 1 - y] = matrix[y][x];
        }
    }
    return result;
}
//左回転
function rotateCounterClockwise(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            result[N - 1 - x][y] = matrix[y][x];
        }
    }
    return result;
}

//ゲームの状態を更新
function update(time = 0) {
    if (inputBuffer.length > 0) {
        const key = inputBuffer.shift();
        handleKeyPress(key);
    }
    if (!lastTime) lastTime = time;
    //経過時間
    const deltaTime = time - lastTime;
    const dropInterval = Math.max(100, 1000 - (level - 1) * 50);
    handleSoftDrop(time);
    handleHorizontalMovement(time);
    if (deltaTime > dropInterval) {
        if (currentTetromino && isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
            currentTetromino.y++;
            lastMovingRotation = false;
            lockDelayResets = 0;
        }
        lastTime = time;//時間更新
    }

    if (currentTetromino) {
        const isGrounded = !isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1);

        if (isGrounded) {
            if (lockDelayTimer === 0) {
                lockDelayTimer = time;
            }

            const timeSinceGrounded = time - lockDelayTimer;
            if (timeSinceGrounded > LOCK_DELAY || lockDelayResets >= MAX_LOCK_DELAY_RESETS) {
                lockTetromino();
                spawnNewTetromino();
                lockDelayTimer = 0;
                lockDelayResets = 0;
            }
        } else {
            lockDelayTimer = 0;
            lockDelayResets = 0;
        }
    }
    draw();
    requestAnimationFrame(update);//次のフレームを要求
}

function checkTSpin() {
    if (currentTetromino.type !== 'T' || !lastMovingRotation) {
        return 'none';
    }

    const x = currentTetromino.x;
    const y = currentTetromino.y;
    const rotation = currentTetromino.rotationState;

    const corners = [
        { r: y, c: x },
        { r: y, c: x + 2 },
        { r: y + 2, c: x },
        { r: y + 2, c: x + 2 }
    ];

    let backCorners;
    switch (rotation) {
        case 0:
            backCorners = [corners[0], corners[1]]; break;
        case 1:
            backCorners = [corners[1], corners[3]]; break;
        case 2:
            backCorners = [corners[2], corners[3]]; break;
        case 3:
            backCorners = [corners[0], corners[2]]; break;
    }
    let filledCorners = 0;
    for (const corner of corners) {
        if (corner.c < 0 || corner.c >= FIELD_COLS || corner.r >= FIELD_ROWS || (corner.r >= 0 && field[corner.r][corner.c])) {
            filledCorners++;
        }
    }
    let filledBackCorners = 0;
    for (const corner of backCorners) {
        if (corner.c < 0 || corner.c >= FIELD_COLS || corner.r >= FIELD_ROWS || (corner.r >= 0 && field[corner.r][corner.c])) {
            filledBackCorners++;
        }
    }
    if (filledCorners >= 3) {
        if (filledBackCorners >= 2) {
            return 't-spin';
        }
        return 't-spin-mini';
    }
    return 'none';
}

//ミノ設置
function lockTetromino() {
    if (!currentTetromino) return;
    const tSpinType = checkTSpin();
    const shape = currentTetromino.shape;
    const color = currentTetromino.color;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const fieldX = currentTetromino.x + x;
                const fieldY = currentTetromino.y + y;

                if (fieldY >= 0) {
                    field[fieldY][fieldX] = color;
                }
            }
        }
    }
    canHold = true;
    const clearedCount = clearLines(tSpinType);
    if (clearedCount === 0) {
        comboCounter = 0;
        if (tSpinType === 't-spin') {
            score += 400 * level;
            isBackToBack = true;
            console.log("T-Spin");
        } else if (tSpinType === 't-spin-mini') {
            score += 100 * level;
            isBackToBack = true;
            console.log("T-Spin Mini!");
        }
    }
}
//ライン消去
function clearLines(tSpinType = 'none') {
    let clearedCount = 0;
    let y = FIELD_ROWS - 1;
    while (y >= 0) {
        const isLineFull = field[y].every(cell => cell !== 0);
        if (isLineFull) {
            clearedCount++;
            field.splice(y, 1);
            field.unshift(new Array(FIELD_COLS).fill(0));
        }
        else {
            y--;
        }
    }
    //スコア機能
    if (clearedCount > 0) {
        let baseScore = 0;
        let isDifficultClear = false;
        const isTSpin = tSpinType.startsWith('t-spin');
        if (isTSpin) {
            isDifficultClear = true;
            if (tSpinType === 't-spin') {
                console.log("T-Spin Clear!");
                switch (clearedCount) {
                    case 1: baseScore = 800; break;
                    case 2: baseScore = 1200; break;
                    case 3: baseScore = 1600; break;
                }
            } else {
                console.log("T-Spin Mini Clear");
                switch (clearedCount) {
                    case 1: baseScore = 200; break;
                    case 2: baseScore = 400; break;
                }
            }
        } else {
            switch (clearedCount) {
                case 1: baseScore = 100; break;
                case 2: baseScore = 300; break;
                case 3: baseScore = 500; break;
                case 4:
                    baseScore = 800;
                    isDifficultClear = true;
                    break;
            }
        }

        if (isDifficultClear && isBackToBack) {
            baseScore = Math.floor(baseScore * 1.5);
            console.log("Back-to-Back");
        }

        const comboBonus = 50 * comboCounter * level;
        score += comboBonus;
        if (comboCounter > 0) {
            console.log('Combo ${comboCounter}!: +${comboBonus}');
        }

        score += baseScore * level;

        if (isDifficultClear) {
            isBackToBack = true;
        } else {
            isBackToBack = false;
        }
        comboCounter++;
        linesCleared += clearedCount;
        level = Math.floor(linesCleared / 10) + 1;

        const isPerfectClear = field.every(row => row.every(cell => cell === 0));
        if (isPerfectClear) {
            console.log("Perfect Clear!");
            let perfectClearBonus = 0;
            switch (clearedCount) {
                case 1: perfectClearBonus = 800; break;
                case 2: perfectClearBonus = 1200; break;
                case 3: perfectClearBonus = 1800; break;
                case 4: perfectClearBonus = 2000; break;
            }
            score += perfectClearBonus;
        }
    }
    return clearedCount;
}
initGame();
update();