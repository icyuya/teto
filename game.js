const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score-display');
const levelElement = document.getElementById('level-display');
//マスサイズ
const TILE_SIZE = 30;
//フィールドサイズ
const FIELD_ROWS = 20;
const FIELD_COLS = 10;
//現在のミノ
let currentTetromino;
//最後に描画した時間
let lastTime = 0;
//ミノが落下する間隔
const DROP_INTERVAL = 1000;
const field = Array.from({ length: FIELD_ROWS }, () => new Array(FIELD_COLS).fill(0));
let score = 0;
let level = 1;
let linesCleared = 0;

// テトリミノの形を定義
const TETROMINOS = {
    T: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    S: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],
    Z: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ],
    L: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ],
    J: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    O: [
        [0, 1, 1],
        [0, 1, 1],
        [0, 0, 0]
    ],
    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ]
}
//ミノランダム生成
function spawnNewTetromino() {
    const tetrominoTypes = 'TSZLJOI';
    const randomType = tetrominoTypes[Math.floor(Math.random() * tetrominoTypes.length)];
    const newTetromino = TETROMINOS[randomType];

    //現在のミノ
    currentTetromino = {
        x: 3,
        y: -1,
        shape: newTetromino
    };

    if (!isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y)) {
        alert('GAME OVER');
        field.forEach(row => row.fill(0));
    }
}


//ミノ描画
function drawBlock(x, y) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    ctx.fillStyle = 'limegreen';
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
function updateUI(){
    scoreElement.textContent = score;
    levelElement.textContent = level;
}


//画面描画
function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    for (let y = 0; y < FIELD_ROWS; y++) {
        for (let x = 0; x < FIELD_COLS; x++) {
            if (field[y][x]) {
                drawBlock(x, y);
            }
        }
    }
    //ミノを描画
    const shape = currentTetromino.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                drawBlock(currentTetromino.x + x, currentTetromino.y + y);
            }
        }
    }
    updateUI();
}

//キー操作
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowLeft':
            //左
            if (isValidMove(currentTetromino.shape, currentTetromino.x - 1, currentTetromino.y)) {
                currentTetromino.x--;
            }
            break;
        case 'ArrowRight':
            //右
            if (isValidMove(currentTetromino.shape, currentTetromino.x + 1, currentTetromino.y)) {
                currentTetromino.x++;
            }
            break;
        case 'ArrowDown':
            //下
            if (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
                currentTetromino.y++;
            }
            break;
        case 'ArrowUp':
            //右回転
            const rotated = rotate(currentTetromino.shape);
            if (isValidMove(rotated, currentTetromino.x, currentTetromino.y)) {
                currentTetromino.shape = rotated;
            }
            break;
    }
    //再描画
    draw();
});

//回転
function rotate(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            result[x][N - 1 - y] = matrix[y][x];
        }
    }
    return result;
}

//ゲームの状態を更新
function update(time = 0) {
    //経過時間
    const deltaTime = time - lastTime;
    const dropInterval = Math.max(100,1000-(level-1)*50);
    if (deltaTime > dropInterval) {
        if (isValidMove(currentTetromino.shape, currentTetromino.x, currentTetromino.y + 1)) {
            currentTetromino.y++;
        }
        else {
            lockTetromino();
            spawnNewTetromino();
        }
        lastTime = time;//時間更新
    }
    draw();
    requestAnimationFrame(update);//次のフレームを要求
}

//ミノ設置
function lockTetromino() {
    const shape = currentTetromino.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const fieldX = currentTetromino.x + x;
                const fieldY = currentTetromino.y + y;

                if (fieldY >= 0) {
                    field[fieldY][fieldX] = 1;
                }
            }
        }
    }
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
    if(clearedCount > 0){
        const baseScore = [0, 100, 300, 500, 800];
        score += baseScore[clearedCount] * level;

        linesCleared += clearedCount;

        level = Math.floor(linesCleared / 10) + 1;
    }
}
//最初のミノ生成
spawnNewTetromino();

update();