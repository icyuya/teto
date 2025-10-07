const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d');
//マスサイズ
const TILE_SIZE = 30;
//フィールドサイズ
const FIELD_ROWS = 20;
const FIELD_COLS = 10;

const field = Array.from({length: FIELD_ROWS},() => new Array(FIELD_COLS).fill(0));

// field[19][0] = 1;
// field[18][0] = 1;
// field[17][0] = 1;

// テトリミノの形を定義
const TETROMINOS = {
    T: [
        [0,1,0],
        [1,1,1],
        [0,0,0]
    ],
    S: [
        [0,1,1],
        [1,1,0],
        [0,0,0]
    ],
    Z: [
        [1,1,0],
        [0,1,1],
        [0,0,0]
    ],
    L: [
        [0,0,1],
        [1,1,1],
        [0,0,0]
    ],
    J: [
        [1,0,0],
        [1,1,1],
        [0,0,0]
    ],
    O: [
        [0,1,1],
        [0,1,1],
        [0,0,0]
    ],
    I: [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]
    ]
}

//現在のミノ
let currentTetromino = {
    x: 3, 
    y: -1,
    shape: TETROMINOS.I
};

//最後に描画した時間
let lastTime = 0;
//ミノが落下する間隔
const DROP_INTERVAL = 1000;

function drawBlock(x,y){
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    ctx.fillStyle = 'limegreen';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    ctx.strokeStyle = '#222';
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
}

function isValidMove(shape, newX, newY){
    for(let y=0;y<shape.length;y++){
        for(let x=0;x<shape[y].length;x++){
            //ミノがある部分のみ
            if(shape[y][x]){
                const fieldX = newX + x;
                const fieldY = newY + y;
                //壁の外にでてないか
                if(fieldX < 0 || fieldX >= FIELD_COLS || fieldY >= FIELD_ROWS){
                    return false;
                }
                //他のブロックが存在しているか
                if(fieldY >= 0 && field[fieldY][fieldX]){
                    return false;
                }
            }
        }
    }
    return true;
}

//画面描画
function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);

    for(let y=0;y<FIELD_ROWS;y++){
        for(let x=0;x<FIELD_COLS;x++){
            if(field[y][x]){
                drawBlock(x,y);
            }
        }
    }
    //ミノを描画
    const shape = currentTetromino.shape;
    for(let y=0;y<shape.length;y++){
        for(let x=0;x<shape[y].length;x++){
            if(shape[y][x]){
                drawBlock(currentTetromino.x + x,currentTetromino.y + y);
            }
        }
    }
}


document.addEventListener('keydown',(event) =>{
    switch(event.key){
        case 'ArrowLeft':
            //左
            if(isValidMove(currentTetromino.shape,currentTetromino.x - 1,currentTetromino.y)){
                currentTetromino.x--;
            }
            break;
        case 'ArrowRight':
            //右
            if(isValidMove(currentTetromino.shape,currentTetromino.x + 1,currentTetromino.y)){
                currentTetromino.x++;
            }
            break;
        case 'ArrowDown':
            //下
            if(isValidMove(currentTetromino.shape,currentTetromino.x,currentTetromino.y + 1)){
                currentTetromino.y++;
            }
            break;
        case 'ArrowUp':
            //右回転
            const rotated = rotate(currentTetromino.shape);
            if(isValidMove(rotated,currentTetromino.x,currentTetromino.y)){
                currentTetromino.shape = rotated;
            }
            break;
    } 
    //再描画
    draw();
});

function rotate(matrix){
    const N = matrix.length;
    const result = Array.from({length: N}, () => new Array(N).fill(0));

    for(let y=0;y<N;y++){
        for(let x=0;x<N;x++){
            result[x][N - 1 - y] = matrix[y][x];
       }
    }
    return result;
}


//ゲームの状態を更新
function update(time = 0){
    //経過時間
    const deltaTime = time - lastTime;

    if(deltaTime > DROP_INTERVAL){
        if(isValidMove(currentTetromino.shape,currentTetromino.x,currentTetromino.y + 1)){
            currentTetromino.y++;
        }
        else{
            lockTetromino();
            currentTetromino = {
                x: 3,
                y: 0,
                shape: TETROMINOS.I
            }
        }
        lastTime = time;//時間更新
    }
    draw();
    requestAnimationFrame(update);//次のフレームを要求
} 

function lockTetromino(){
    const shape = currentTetromino.shape;
    for(let y=0;y<shape.length;y++){
        for(let x=0;x<shape[y].length;x++){
            if(shape[y][x]){
                const fieldX = currentTetromino.x + x;
                const fieldY = currentTetromino.y + y;

                if(fieldY >= 0){
                    field[fieldY][fieldX] = 1;
                }
            }
        }
    }
}

update();