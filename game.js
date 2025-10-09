const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score-display');
const levelElement = document.getElementById('level-display');
const nextcanvas = document.getElementById('next-canvas');
const nextCtx = nextcanvas.getContext('2d');
const holdcanvas = document.getElementById('hold-canvas');
const holdCtx = holdcanvas.getContext('2d');
//マスサイズ
const TILE_SIZE = 30;
//フィールドサイズ
const FIELD_ROWS = 20;
const FIELD_COLS = 10;
//現在のミノ
let currentTetromino;
//次のミノ
let nextQueue = [];
const NEXT_QUEUE_SIZE = 5;

let holdTetromino;
let canHold = true;
//最後に描画した時間
let lastTime = 0;
//ミノが落下する間隔
const DROP_INTERVAL = 1000;
const field = Array.from({ length: FIELD_ROWS }, () => new Array(FIELD_COLS).fill(0));
let score = 0;
let level = 1;
let linesCleared = 0;
let bag = [];
let lockDelayTimer = 0;
const LOOK_DELAY = 500;


// テトリミノの形を定義
const TETROMINOS = {
    T: {
        shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        color: 'purple'
    },
    S: {
        shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
        color: 'green'
    },
    Z: {
        shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
        color: 'red'
    },
    L: {
        shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
        color: 'orange'
    },
    J: {
        shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
        color: 'blue'
    },
    O: {
        shape: [[0, 1, 1], [0, 1, 1], [0, 0, 0]],
        color: 'yellow'
    },
    I: {
        shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        color: 'cyan'
    }
}

function generateBag() {
    let types = ['T', 'S', 'Z', 'L', 'J', 'O', 'I'];

    for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
    }
    bag = types;
}

function cloneTetromino(tetromino) {
    return {
        ...tetromino,
        shape: tetromino.shape.map(row => [...row])
    };
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
    }
    //ゲームオーバー判定
    if (currentTetromino && !isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y)) {
        alert('GAME OVER');
        field.forEach(row => row.fill(0));
        score = 0;
        level = 1;;
        linesCleared = 0;
        holdTetromino = null;
        canHold = true;
        nextQueue = [];
        bag = [];
        refillNextQueue();
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



//キー操作
document.addEventListener('keydown', (event) => {
    if (!currentTetromino) return;

    switch (event.key) {
        case 'ArrowLeft':
            //左
            if (isValidMove(currentTetromino.shape, currentTetromino.x - 1, currentTetromino.y)) {
                currentTetromino.x--;
                if (lockDelayTimer > 0) {
                    lockDelayTimer = performance.now();
                }
            }
            break;
        case 'ArrowRight':
            //右
            if (isValidMove(currentTetromino.shape, currentTetromino.x + 1, currentTetromino.y)) {
                currentTetromino.x++;
                if (lockDelayTimer > 0) {
                    lockDelayTimer = performance.now();
                }
            }
            break;
        case 'ArrowDown':
            //下
            if (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
                currentTetromino.y++;
                if (lockDelayTimer > 0) {
                    lockDelayTimer = performance.now();
                }
            }
            break;
        case 'ArrowUp':
            //右回転
            {
                const rotated = rotateClockwise(currentTetromino.shape);
                const kickPatterns = [[0, 0], [-1, 0], [1, 0], [0, -1]];

                for (const [kickX, kickY] of kickPatterns) {
                    const newX = currentTetromino.x + kickX;
                    const newY = currentTetromino.y + kickY;
                    if (isValidMove(rotated, newX, newY)) {
                        currentTetromino.shape = rotated;
                        currentTetromino.x = newX;
                        currentTetromino.y = newY;
                        if (lockDelayTimer > 0) {
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
                const rotated = rotateCounterClockwise(currentTetromino.shape);
                const kickPatterns = [[0, 0], [1, 0], [-1, 0], [0, -1]];

                for (const [kickX, kickY] of kickPatterns) {
                    const newX = currentTetromino.x + kickX;
                    const newY = currentTetromino.y + kickY;
                    if (isValidMove(rotated, newX, newY)) {
                        currentTetromino.shape = rotated;
                        currentTetromino.x = newX;
                        currentTetromino.y = newY;
                        if (lockDelayTimer > 0) {
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
            while (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
                currentTetromino.y++;
            }
            lockTetromino();
            spawnNewTetromino();
            draw();
            return;
    }
    draw();
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
    //経過時間
    const deltaTime = time - lastTime;
    const dropInterval = Math.max(100, 1000 - (level - 1) * 50);
    if (deltaTime > dropInterval) {
        if (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
            lockDelayTimer = 0;
            currentTetromino.y++;
        }
        else {
            if (lockDelayTimer === 0) {
                lockDelayTimer = time;
            }
            if (time - lockDelayTimer > LOOK_DELAY) {
                lockTetromino();
                spawnNewTetromino();
                lockDelayTimer = 0;
            }

        }
        lastTime = time;//時間更新
    }
    draw();
    requestAnimationFrame(update);//次のフレームを要求
}

//ミノ設置
function lockTetromino() {
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
    clearLines();
}
//ライン消去
function clearLines() {
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
        const baseScore = [0, 100, 300, 500, 800];
        score += baseScore[clearedCount] * level;

        linesCleared += clearedCount;

        level = Math.floor(linesCleared / 10) + 1;
    }
}
//最初のcurrentとnextの生成
bag = [];
nextQueue = [];
refillNextQueue();
spawnNewTetromino();
update();