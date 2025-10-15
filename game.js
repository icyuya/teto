//定義
const GAME_CONFIG = {
    TILE_SIZE: 30,
    FIELD_ROWS: 20,
    FIELD_COLS: 10,
    NEXT_QUEUE_SIZE: 5,

    // タイミング設定 (ms)
    LOCK_DELAY: 500,
    MAX_LOCK_DELAY_RESETS: 15,
    DAS_DELAY: 133,         // 横移動の受付開始までの遅延
    ARR_INTERVAL: 1,          // 横移動の繰り返し間隔
    SOFT_DROP_ARR_INTERVAL: 30, // ソフトドロップの繰り返し間隔

    // テトリミノの初期位置
    SPAWN_POS: { x: 3, y: -1 },

    // テトリミノの定義
    TETROMINOS: {
        T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: 'purple' },
        S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: 'green' },
        Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: 'red' },
        L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: 'orange' },
        J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: 'blue' },
        O: { shape: [[0, 1, 1], [0, 1, 1], [0, 0, 0]], color: 'yellow' },
        I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: 'cyan' }
    },

    // ウォールキックのデータ
    KICK_DATA: {
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
};

//テトリスクラス
class Tetris {
    constructor(elements) {
        // DOM要素の取得
        this.canvas = elements.gameCanvas;
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = elements.nextCanvas;
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCanvas = elements.holdCanvas;
        this.holdCtx = this.holdCanvas.getContext('2d');
        this.scoreElement = elements.scoreDisplay;
        this.levelElement = elements.levelDisplay;

        this._setupEventListeners();
        this.initGame();
    }

    // --- ゲームの初期化 ---
    initGame() {
        this.field = Array.from({ length: GAME_CONFIG.FIELD_ROWS }, () => new Array(GAME_CONFIG.FIELD_COLS).fill(0));

        this.state = {
            score: 0,
            level: 1,
            linesCleared: 0,
            holdTetromino: null,
            canHold: true,
            lastTime: 0,
            lockDelayTimer: 0,
            lockDelayResets: 0,
            comboCounter: 0,
            isBackToBack: false,
            lastMovingRotation: false,
            gameState: 'playing'
        };

        this.bag = [];
        this.nextQueue = [];
        this.currentTetromino = null;

        this.inputBuffer = [];
        this.autoShiftState = { direction: null, dasStartTime: 0, arrIntervalTime: 0, isRepeating: false };
        this.softDropState = { isActive: false, arrIntervalTime: 0 };

        this._refillNextQueue();
        this._spawnNewTetromino();
        this.updateUI();
    }

    // --- イベントリスナー ---
    _setupEventListeners() {
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    _handleKeyDown(event) {
        if (this.state.gameState !== 'playing' || event.repeat) return;

        if (event.key === 'Control') {
            event.preventDefault();
            this.initGame();
            return;
        }

        const { key } = event;
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const direction = (key === 'ArrowLeft') ? 'left' : 'right';
            if (this.autoShiftState.direction !== direction) {
                this._moveHorizontally(direction);
                this.autoShiftState = {
                    direction,
                    dasStartTime: performance.now(),
                    isRepeating: false,
                    arrIntervalTime: performance.now()
                };
            }
        } else if (key === 'ArrowDown') {
            if (!this.softDropState.isActive) {
                this.softDropState.isActive = true;
                this.softDropState.arrIntervalTime = performance.now();
                this._moveDown();
            }
        } else {
            this.inputBuffer.push(key);
        }
    }

    _handleKeyUp(event) {
        const { key } = event;
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const direction = (key === 'ArrowLeft') ? 'left' : 'right';
            if (this.autoShiftState.direction === direction) {
                this.autoShiftState.direction = null;
                this.autoShiftState.isRepeating = false;
            }
        } else if (key === 'ArrowDown') {
            this.softDropState.isActive = false;
        }
    }

    // --- ゲームロジック (コア) ---

    _generateBag() {
        let types = Object.keys(GAME_CONFIG.TETROMINOS);
        for (let i = types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [types[i], types[j]] = [types[j], types[i]];
        }
        this.bag = types;
    }

    _cloneTetromino(tetromino) {
        return tetromino ? JSON.parse(JSON.stringify(tetromino)) : null;
    }

    _refillNextQueue() {
        while (this.nextQueue.length < GAME_CONFIG.NEXT_QUEUE_SIZE) {
            if (this.bag.length === 0) {
                this._generateBag();
            }
            const type = this.bag.pop();
            this.nextQueue.push({ ...GAME_CONFIG.TETROMINOS[type], type: type });
        }
    }

    _spawnNewTetromino() {
        this.currentTetromino = this._cloneTetromino(this.nextQueue.shift());
        this._refillNextQueue();

        if (this.currentTetromino) {
            this.currentTetromino.x = GAME_CONFIG.SPAWN_POS.x;
            this.currentTetromino.y = GAME_CONFIG.SPAWN_POS.y;
            this.currentTetromino.rotationState = 0;
            this.state.lastMovingRotation = false;
        }

        if (this.currentTetromino && !this._isValidMove(this.currentTetromino.shape, this.currentTetromino.x, this.currentTetromino.y)) {
            this.state.gameState = 'gameover';
            alert('GAME OVER');
            this.initGame();
        }
    }

    _isValidMove(shape, newX, newY) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const fieldX = newX + x;
                    const fieldY = newY + y;
                    if (fieldX < 0 || fieldX >= GAME_CONFIG.FIELD_COLS || fieldY >= GAME_CONFIG.FIELD_ROWS) {
                        return false;
                    }
                    if (fieldY >= 0 && this.field[fieldY][fieldX]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    _lockTetromino() {
        if (!this.currentTetromino) return;

        const tSpinType = this._checkTSpin();
        const { shape, color, x, y } = this.currentTetromino;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const fieldX = x + col;
                    const fieldY = y + row;
                    if (fieldY >= 0) {
                        this.field[fieldY][fieldX] = color;
                    }
                }
            }
        }

        this.state.canHold = true;
        const clearedCount = this._clearLines(tSpinType);

        if (clearedCount === 0) {
            this.state.comboCounter = 0;
            if (tSpinType === 't-spin') {
                this.state.score += 400 * this.state.level;
                this.state.isBackToBack = true;
            } else if (tSpinType === 't-spin-mini') {
                this.state.score += 100 * this.state.level;
                this.state.isBackToBack = true;
            }
        }
        this.updateUI();
    }

    _clearLines(tSpinType = 'none') {
        let clearedCount = 0;
        let y = GAME_CONFIG.FIELD_ROWS - 1;
        while (y >= 0) {
            if (this.field[y].every(cell => cell !== 0)) {
                clearedCount++;
                this.field.splice(y, 1);
                this.field.unshift(new Array(GAME_CONFIG.FIELD_COLS).fill(0));
            } else {
                y--;
            }
        }

        if (clearedCount > 0) {
            let baseScore = 0;
            let isDifficultClear = false;
            const isTSpin = tSpinType.startsWith('t-spin');

            if (isTSpin) {
                isDifficultClear = true;
                if (tSpinType === 't-spin') {
                    baseScore = [0, 800, 1200, 1600][clearedCount];
                } else { // T-Spin Mini
                    baseScore = [0, 200, 400][clearedCount];
                }
            } else {
                baseScore = [0, 100, 300, 500, 800][clearedCount];
                if (clearedCount === 4) isDifficultClear = true;
            }

            if (isDifficultClear && this.state.isBackToBack) {
                baseScore = Math.floor(baseScore * 1.5);
            }

            const comboBonus = 50 * this.state.comboCounter * this.state.level;

            this.state.score += (baseScore * this.state.level) + comboBonus;
            this.state.isBackToBack = isDifficultClear;
            this.state.comboCounter++;
            this.state.linesCleared += clearedCount;
            this.state.level = Math.floor(this.state.linesCleared / 10) + 1;

            if (this.field.every(row => row.every(cell => cell === 0))) {
                const perfectClearBonus = [0, 800, 1200, 1800, 2000][clearedCount];
                this.state.score += perfectClearBonus;
            }
        }
        return clearedCount;
    }


    // --- ゲームロジック (操作) ---
    _handleKeyPress(key) {
        if (!this.currentTetromino) return;

        switch (key) {
            case 'ArrowUp':
            case 'x':
                this._handleRotation('clockwise');
                break;
            case 'z':
                this._handleRotation('counter-clockwise');
                break;
            case 'c':
                this._hold();
                break;
            case ' ': // Space
                this._hardDrop();
                break;
        }
    }

    _moveHorizontally(direction) {
        if (!this.currentTetromino) return;
        const dir = (direction === 'left') ? -1 : 1;
        if (this._isValidMove(this.currentTetromino.shape, this.currentTetromino.x + dir, this.currentTetromino.y)) {
            this.currentTetromino.x += dir;
            this.state.lastMovingRotation = false;
            this._resetLockDelayIfGrounded();
        }
    }

    _moveDown() {
        if (!this.currentTetromino) return false;
        if (this._isValidMove(this.currentTetromino.shape, this.currentTetromino.x, this.currentTetromino.y + 1)) {
            this.currentTetromino.y++;
            this.state.lastMovingRotation = false;
            this.state.lockDelayResets = 0;
            this.state.score++;
            this.updateUI();
            return true;
        }
        return false;
    }

    _hardDrop() {
        let dropDistance = 0;
        while (this._isValidMove(this.currentTetromino.shape, this.currentTetromino.x, this.currentTetromino.y + 1)) {
            this.currentTetromino.y++;
            dropDistance++;
        }
        if (dropDistance > 0) {
            this.state.score += dropDistance * 2;
        }
        this._lockTetromino();
        this._spawnNewTetromino();
    }

    _hold() {
        if (!this.state.canHold) return;

        const typeToHold = this.currentTetromino.type;
        if (this.state.holdTetromino) {
            const heldType = this.state.holdTetromino.type;
            this.currentTetromino = { ...this._cloneTetromino(GAME_CONFIG.TETROMINOS[heldType]), type: heldType };
            this.state.holdTetromino = { ...this._cloneTetromino(GAME_CONFIG.TETROMINOS[typeToHold]), type: typeToHold };

            this.currentTetromino.x = GAME_CONFIG.SPAWN_POS.x;
            this.currentTetromino.y = GAME_CONFIG.SPAWN_POS.y;
            this.currentTetromino.rotationState = 0;
        } else {
            this.state.holdTetromino = { ...this._cloneTetromino(GAME_CONFIG.TETROMINOS[typeToHold]), type: typeToHold };
            this._spawnNewTetromino();
        }
        this.state.canHold = false;
    }

    _rotateMatrix(matrix, direction) {
        const N = matrix.length;
        const result = Array.from({ length: N }, () => new Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                if (direction === 'clockwise') {
                    result[x][N - 1 - y] = matrix[y][x];
                } else { // counter-clockwise
                    result[N - 1 - x][y] = matrix[y][x];
                }
            }
        }
        return result;
    }

    _handleRotation(direction) {
        const oldLowestY = this._getLowestY(this.currentTetromino);
        const rotated = this._rotateMatrix(this.currentTetromino.shape, direction);
        const from = this.currentTetromino.rotationState;
        const to = (direction === 'clockwise') ? (from + 1) % 4 : (from + 3) % 4;

        const kickTable = (this.currentTetromino.type === 'I') ? GAME_CONFIG.KICK_DATA.I : GAME_CONFIG.KICK_DATA.JLSTZ;
        const kickPatterns = (direction === 'clockwise') ? kickTable[from * 2] : kickTable[to * 2 + 1];

        for (const [kickX, kickY] of kickPatterns) {
            const newX = this.currentTetromino.x + kickX;
            const newY = this.currentTetromino.y - kickY; // Kick data Y is inverted
            if (this._isValidMove(rotated, newX, newY)) {
                this.currentTetromino.shape = rotated;
                this.currentTetromino.x = newX;
                this.currentTetromino.y = newY;
                this.currentTetromino.rotationState = to;
                this.state.lastMovingRotation = true;

                if (!this._isValidMove(rotated, newX, newY + 1)) {
                    this._resetLockDelayIfGrounded();
                    // T-spin specific lock delay reset logic
                    const newLowest = this._getLowestY(this.currentTetromino);
                    if (newLowest > oldLowestY) this.state.lockDelayResets = 0;
                }
                return;
            }
        }
    }

    _resetLockDelayIfGrounded() {
        if (!this._isValidMove(this.currentTetromino.shape, this.currentTetromino.x, this.currentTetromino.y + 1)) {
            this.state.lockDelayTimer = performance.now();
            this.state.lockDelayResets++;
        }
    }

    _checkTSpin() {
        if (this.currentTetromino.type !== 'T' || !this.state.lastMovingRotation) return 'none';

        const { x, y, rotationState } = this.currentTetromino;
        const corners = [
            { r: y, c: x }, { r: y, c: x + 2 },
            { r: y + 2, c: x }, { r: y + 2, c: x + 2 }
        ];

        const frontCorners = [[corners[0], corners[1]], [corners[1], corners[3]], [corners[3], corners[2]], [corners[0], corners[2]]][rotationState];

        let filledCorners = 0;
        corners.forEach(corner => {
            if (corner.c < 0 || corner.c >= GAME_CONFIG.FIELD_COLS || corner.r >= GAME_CONFIG.FIELD_ROWS || (corner.r >= 0 && this.field[corner.r][corner.c])) {
                filledCorners++;
            }
        });

        if (filledCorners < 3) return 'none';

        let filledFrontCorners = 0;
        frontCorners.forEach(corner => {
            if (corner.c < 0 || corner.c >= GAME_CONFIG.FIELD_COLS || corner.r >= GAME_CONFIG.FIELD_ROWS || (corner.r >= 0 && this.field[corner.r][corner.c])) {
                filledFrontCorners++;
            }
        });

        return filledFrontCorners === 2 ? 't-spin' : 't-spin-mini';
    }

    _getLowestY(tetromino) {
        if (!tetromino) return -1;
        let lowest = -1;
        tetromino.shape.forEach((row, y) => {
            if (row.includes(1)) {
                lowest = tetromino.y + y;
            }
        });
        return lowest;
    }


    // --- 描画関連 ---
    updateUI() {
        this.scoreElement.textContent = this.state.score;
        this.levelElement.textContent = this.state.level;
    }

    _drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= GAME_CONFIG.FIELD_COLS; x++) {
            const px = x * GAME_CONFIG.TILE_SIZE;
            this.ctx.beginPath();
            this.ctx.moveTo(px, 0);
            this.ctx.lineTo(px, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= GAME_CONFIG.FIELD_ROWS; y++) {
            const py = y * GAME_CONFIG.TILE_SIZE;
            this.ctx.beginPath();
            this.ctx.moveTo(0, py);
            this.ctx.lineTo(this.canvas.height, py);
            this.ctx.stroke();
        }
    }
    _drawBlock(x, y, color) {
        const px = x * GAME_CONFIG.TILE_SIZE;
        const py = y * GAME_CONFIG.TILE_SIZE;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px, py, GAME_CONFIG.TILE_SIZE, GAME_CONFIG.TILE_SIZE);
        this.ctx.strokeStyle = '#222';
        this.ctx.strokeRect(px, py, GAME_CONFIG.TILE_SIZE, GAME_CONFIG.TILE_SIZE);
    }

    _drawGhostPiece() {
        if (!this.currentTetromino) return;
        const ghost = this._cloneTetromino(this.currentTetromino);
        while (this._isValidMove(ghost.shape, ghost.x, ghost.y + 1)) {
            ghost.y++;
        }

        const { shape, x, y } = ghost;
        shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value) {
                    const px = (x + c) * GAME_CONFIG.TILE_SIZE;
                    const py = (y + r) * GAME_CONFIG.TILE_SIZE;
                    this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    this.ctx.fillRect(px, py, GAME_CONFIG.TILE_SIZE, GAME_CONFIG.TILE_SIZE);
                }
            });
        });
    }

    _drawNextQueue() {
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

        this.nextQueue.forEach((tetromino, index) => {
            if (index >= 5) return; // 表示は5つまでなど
            const { shape, color } = tetromino;
            const tileSize = GAME_CONFIG.TILE_SIZE;
            const yOffset = index * 90; // ミノ同士の間隔
            const offsetX = (this.nextCanvas.width - shape[0].length * tileSize) / 2;
            const offsetY = yOffset + (90 - shape.length * tileSize) / 2;

            shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        this.nextCtx.fillStyle = color;
                        this.nextCtx.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                        this.nextCtx.strokeStyle = '#222';
                        this.nextCtx.strokeRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                    }
                });
            });
        });
    }

    _drawHoldPiece() {
        this.holdCtx.fillStyle = '#000';
        this.holdCtx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        if (!this.state.holdTetromino) return;

        const { shape, color } = this.state.holdTetromino;
        const tileSize = GAME_CONFIG.TILE_SIZE;
        const offsetX = (this.holdCanvas.width - shape[0].length * tileSize) / 2;
        const offsetY = (this.holdCanvas.height - shape.length * tileSize) / 2;

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    this.holdCtx.fillStyle = color;
                    this.holdCtx.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                    this.holdCtx.strokeStyle = '#222';
                    this.holdCtx.strokeRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                }
            });
        });
    }

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this._drawGrid();
        
        // 固定されたブロックの描画
        for (let y = 0; y < GAME_CONFIG.FIELD_ROWS; y++) {
            for (let x = 0; x < GAME_CONFIG.FIELD_COLS; x++) {
                if (this.field[y][x]) {
                    this._drawBlock(x, y, this.field[y][x]);
                }
            }
        }

        this._drawGhostPiece();

        // 操作中のテトリミノの描画
        if (this.currentTetromino) {
            const { shape, color, x, y } = this.currentTetromino;
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        this._drawBlock(x + col, y + row, color);
                    }
                }
            }
        }

        this._drawNextQueue();
        this._drawHoldPiece();
    }

    // --- ゲームループ ---
    update(time = 0) {
        if (this.state.gameState !== 'playing') {
            return;
        }

        while (this.inputBuffer.length > 0) {
            this._handleKeyPress(this.inputBuffer.shift());
        }

        if (!this.state.lastTime) this.state.lastTime = time;
        const deltaTime = time - this.state.lastTime;

        // 自動落下
        const dropInterval = Math.max(100, 1000 - (this.state.level - 1) * 50);
        if (deltaTime > dropInterval) {
            this._moveDown();
            this.state.lastTime = time;
        }

        // ソフトドロップ
        if (this.softDropState.isActive) {
            while (time - this.softDropState.arrIntervalTime > GAME_CONFIG.SOFT_DROP_ARR_INTERVAL) {
                this._moveDown();
                this.softDropState.arrIntervalTime += GAME_CONFIG.SOFT_DROP_ARR_INTERVAL;
            }
        }

        // 横移動
        if (this.autoShiftState.direction) {
            if (!this.autoShiftState.isRepeating && time - this.autoShiftState.dasStartTime > GAME_CONFIG.DAS_DELAY) {
                this.autoShiftState.isRepeating = true;
                this.autoShiftState.arrIntervalTime = time;
            }
            if (this.autoShiftState.isRepeating) {
                while (time - this.autoShiftState.arrIntervalTime > GAME_CONFIG.ARR_INTERVAL) {
                    this._moveHorizontally(this.autoShiftState.direction);
                    this.autoShiftState.arrIntervalTime += GAME_CONFIG.ARR_INTERVAL;
                }
            }
        }

        // 接地とロック
        if (this.currentTetromino) {
            const isGrounded = !this._isValidMove(this.currentTetromino.shape, this.currentTetromino.x, this.currentTetromino.y + 1);
            if (isGrounded) {
                if (this.state.lockDelayTimer === 0) {
                    this.state.lockDelayTimer = time;
                }
                const timeSinceGrounded = time - this.state.lockDelayTimer;
                if (timeSinceGrounded > GAME_CONFIG.LOCK_DELAY || this.state.lockDelayResets >= GAME_CONFIG.MAX_LOCK_DELAY_RESETS) {
                    this._lockTetromino();
                    this._spawnNewTetromino();
                    this.state.lockDelayTimer = 0;
                    this.state.lockDelayResets = 0;
                }
            } else {
                this.state.lockDelayTimer = 0;
                this.state.lockDelayResets = 0;
            }
        }

        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }

    start() {
        requestAnimationFrame(this.update.bind(this));
    }
}

//ゲームのインスタンス
window.onload = () => {
    const elements = {
        gameCanvas: document.getElementById('game-canvas'),
        nextCanvas: document.getElementById('next-canvas'),
        holdCanvas: document.getElementById('hold-canvas'),
        scoreDisplay: document.getElementById('score-display'),
        levelDisplay: document.getElementById('level-display')
    };

    // キャンバスのサイズを設定
    elements.gameCanvas.width = GAME_CONFIG.FIELD_COLS * GAME_CONFIG.TILE_SIZE;
    elements.gameCanvas.height = GAME_CONFIG.FIELD_ROWS * GAME_CONFIG.TILE_SIZE;

    const game = new Tetris(elements);
    game.start();
};