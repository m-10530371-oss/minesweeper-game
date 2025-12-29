// --- 游戏配置 ---
const MODES = {
    easy: { gridSizeX: 10, gridSizeY: 10, bombCount: 10, cellSize: 30, nameZh: "简单", nameEn: "Easy" }, // 10x10, 10 雷
    normal: { gridSizeX: 14, gridSizeY: 20, bombCount: 40, cellSize: 25, nameZh: "普通", nameEn: "Normal" }, // 14x20, 40 雷
    hard: { gridSizeX: 14, gridSizeY: 32, bombCount: 99, cellSize: 20, nameZh: "困难", nameEn: "Hard" }   // 14x32, 99 雷
};

let currentMode = MODES.easy; // 默认模式
let GRID_SIZE_X; // X轴（列）的尺寸
let GRID_SIZE_Y; // Y轴（行）的尺寸
let BOOM_COUNT;
let CELL_SIZE; // 单元格大小

// --- 游戏状态变量 ---
let board = [];
let gameStarted = false;
let gameOver = false;
let revealedCells = 0; // 已经揭示的非雷单元格数量
let flagsPlaced = 0;   // 已放置的旗帜数量
let correctFlags = 0;  // 正确标记的雷数量
let flagMode = false; // 新增：旗帜模式开关

// --- 计时器相关 ---
let timerInterval;
let startTime;

// --- DOM 元素获取 ---
const startPage = document.getElementById('start-page');
const gamePage = document.getElementById('game-page');
const modeButtons = document.querySelectorAll('.mode-button');
const gameContainer = document.getElementById('game-container');
const messageDisplay = document.getElementById('message');
const resetButton = document.getElementById('reset-button');
const backToMenuButton = document.getElementById('back-to-menu');
const timerDisplay = document.getElementById('timer');
const flagCountDisplay = document.getElementById('flag-count');

// 新增：旗帜模式按钮
const toggleFlagModeButton = document.createElement('button');
toggleFlagModeButton.id = 'toggle-flag-mode';
toggleFlagModeButton.textContent = '🚩 模式';
toggleFlagModeButton.classList.add('mode-button'); // 复用样式
toggleFlagModeButton.style.marginTop = '10px';
// 在 game-page 中找到一个合适的位置插入按钮，例如在 game-info 下面
const gameInfo = document.getElementById('game-info');
if (gameInfo) { // 确保 game-info 存在
    gamePage.insertBefore(toggleFlagModeButton, gameInfo.nextSibling); // 插入到 game-info 后面
} else {
    gamePage.insertBefore(toggleFlagModeButton, gameContainer); // 如果没有 game-info，则在 gameContainer 前
}


// --- 事件监听器 ---
modeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const modeName = e.target.dataset.mode;
        startGame(modeName);
    });
});
resetButton.addEventListener('click', () => startGame(currentMode.name)); // 重新开始当前模式
backToMenuButton.addEventListener('click', showStartPage);
toggleFlagModeButton.addEventListener('click', toggleFlagMode); // 监听旗帜模式按钮

// --- 页面切换函数 ---
function showStartPage() {
    startPage.style.display = 'flex';
    gamePage.style.display = 'none';
    stopTimer(); // 确保计时器停止
    flagMode = false; // 返回菜单时重置旗帜模式
    updateFlagModeButton(); // 更新按钮样式
}

function showGamePage() {
    startPage.style.display = 'none';
    gamePage.style.display = 'flex';
}

// --- 游戏初始化和开始 ---
function startGame(modeName) {
    currentMode = MODES[modeName];
    currentMode.name = modeName; // 保存模式名称，用于重新开始

    // 根据模式设置网格尺寸
    GRID_SIZE_X = currentMode.gridSizeX;
    GRID_SIZE_Y = currentMode.gridSizeY;
    
    BOOM_COUNT = currentMode.bombCount;
    CELL_SIZE = currentMode.cellSize;

    initGame();
    showGamePage();
    flagMode = false; // 每次新游戏开始时，默认不是旗帜模式
    updateFlagModeButton(); // 更新按钮样式
}

function initGame() {
    board = [];
    gameContainer.innerHTML = '';
    messageDisplay.textContent = '';
    gameStarted = false;
    gameOver = false;
    revealedCells = 0;
    flagsPlaced = 0;
    correctFlags = 0;

    // 重置计时器和旗帜显示
    stopTimer();
    timerDisplay.textContent = '⏱ 00:00';
    updateFlagCount();

    // 根据模式调整单元格大小和网格布局
    gameContainer.style.gridTemplateColumns = `repeat(${GRID_SIZE_X}, ${CELL_SIZE}px)`;
    gameContainer.style.width = `${GRID_SIZE_X * CELL_SIZE}px`; // 确保容器宽度正确
    gameContainer.style.height = `${GRID_SIZE_Y * CELL_SIZE}px`; // 确保容器高度正确


    // 创建空的网格
    for (let i = 0; i < GRID_SIZE_Y; i++) { // 行数由GRID_SIZE_Y决定
        board[i] = [];
        for (let j = 0; j < GRID_SIZE_X; j++) { // 列数由GRID_SIZE_X决定
            board[i][j] = {
                isBomb: false,
                isRevealed: false,
                isFlagged: false,
                neighborBombs: 0
            };
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.row = i;
            cellElement.dataset.col = j;
            cellElement.style.width = `${CELL_SIZE}px`;
            cellElement.style.height = `${CELL_SIZE}px`;
            cellElement.addEventListener('click', handleCellClickEvent); // 使用命名函数
            cellElement.addEventListener('contextmenu', handleCellRightClickEvent); // 使用命名函数
            gameContainer.appendChild(cellElement);
        }
    }

    // 随机放置雷
    placeBombs();

    // 计算每个单元格周围的雷数
    calculateNeighborBombs();
}

// 放置雷
function placeBombs() {
    let bombsPlaced = 0;
    while (bombsPlaced < BOOM_COUNT) {
        const row = Math.floor(Math.random() * GRID_SIZE_Y); // 注意这里是GRID_SIZE_Y
        const col = Math.floor(Math.random() * GRID_SIZE_X); // 注意这里是GRID_SIZE_X

        if (!board[row][col].isBomb) {
            board[row][col].isBomb = true;
            bombsPlaced++;
        }
    }
}

// 计算周围雷数
function calculateNeighborBombs() {
    for (let i = 0; i < GRID_SIZE_Y; i++) { // 行
        for (let j = 0; j < GRID_SIZE_X; j++) { // 列
            if (!board[i][j].isBomb) {
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;

                        const newRow = i + dr;
                        const newCol = j + dc;

                        if (newRow >= 0 && newRow < GRID_SIZE_Y && newCol >= 0 && newCol < GRID_SIZE_X) { // 检查边界
                            if (board[newRow][newCol].isBomb) {
                                count++;
                            }
                        }
                    }
                }
                board[i][j].neighborBombs = count;
            }
        }
    }
}

// --- 计时器功能 ---
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
    const seconds = String(elapsedTime % 60).padStart(2, '0');
    timerDisplay.textContent = `⏱ ${minutes}:${seconds}`;
}

function stopTimer() {
    clearInterval(timerInterval);
}

// --- 旗帜计数更新 ---
function updateFlagCount() {
    flagCountDisplay.textContent = `🚩 ${flagsPlaced} / ${BOOM_COUNT}`;
}

// --- 新增：切换旗帜模式 ---
function toggleFlagMode() {
    flagMode = !flagMode;
    updateFlagModeButton();
}

// 新增：更新旗帜模式按钮的显示
function updateFlagModeButton() {
    if (flagMode) {
        toggleFlagModeButton.textContent = '✅ 旗帜模式 (点击取消)';
        toggleFlagModeButton.style.backgroundColor = '#28a745'; // 绿色表示激活
    } else {
        toggleFlagModeButton.textContent = '🚩 模式';
        toggleFlagModeButton.style.backgroundColor = '#007bff'; // 蓝色表示非激活
    }
}

// 统一处理单元格点击事件 - 使用命名函数
function handleCellClickEvent(e) {
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    handleCellInteraction(row, col);
}

// 保留右键点击，仅PC端使用 - 使用命名函数
function handleCellRightClickEvent(e) {
    e.preventDefault(); // 阻止默认右键菜单
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    handleCellRightClick(row, col);
}


// 新增：统一处理单元格点击事件
function handleCellInteraction(row, col) {
    if (gameOver || board[row][col].isRevealed) {
        return;
    }

    if (!gameStarted) {
        gameStarted = true;
        startTimer(); // 第一次点击才开始计时
    }

    if (flagMode) {
        toggleFlag(row, col);
    } else {
        revealCell(row, col);
    }
}

// 保留右键点击，仅PC端使用
function handleCellRightClick(row, col) {
    if (gameOver || board[row][col].isRevealed) {
        return;
    }

    if (!gameStarted) {
        gameStarted = true;
        startTimer(); // 第一次右键点击也开始计时
    }

    toggleFlag(row, col);
}


// 揭示单元格
function revealCell(row, col) {
    // 再次检查，防止递归揭示时重复处理
    if (gameOver || board[row][col].isRevealed || board[row][col].isFlagged) {
        return;
    }

    const cell = board[row][col];
    // 根据row和col计算一维数组的索引
    const cellIndex = row * GRID_SIZE_X + col;
    const cellElement = gameContainer.children[cellIndex]; 

    cell.isRevealed = true;
    cellElement.classList.add('revealed');
    // 揭示后移除事件监听器，避免再次点击 (使用命名函数)
    cellElement.removeEventListener('click', handleCellClickEvent);
    cellElement.removeEventListener('contextmenu', handleCellRightClickEvent);


    if (cell.isBomb) {
        cellElement.textContent = '💣';
        cellElement.classList.add('bomb');
        endGame(false); // 踩到雷，游戏结束
        return;
    }

    revealedCells++;
    
    if (cell.neighborBombs > 0) {
        cellElement.textContent = cell.neighborBombs;
        cellElement.classList.add(`number-${cell.neighborBombs}`);
    } else {
        // 如果是空白单元格，则自动揭示周围的单元格
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;

                const newRow = row + dr;
                const newCol = col + dc;

                if (newRow >= 0 && newRow < GRID_SIZE_Y && newCol >= 0 && newCol < GRID_SIZE_X) { // 检查边界
                    revealCell(newRow, newCol); // 递归揭示
                }
            }
        }
    }
    checkWinCondition(); // 检查是否胜利，放到这里更合理
}

// 标记/取消标记单元格
function toggleFlag(row, col) {
    if (gameOver || board[row][col].isRevealed) {
        return;
    }

    const cell = board[row][col];
    const cellIndex = row * GRID_SIZE_X + col; // 索引计算
    const cellElement = gameContainer.children[cellIndex];

    cell.isFlagged = !cell.isFlagged;

    if (cell.isFlagged) {
        if (flagsPlaced < BOOM_COUNT) { // 只有在旗帜数量未达到雷数时才能放置新旗帜
            cellElement.textContent = '🚩';
            cellElement.classList.add('flag');
            flagsPlaced++;
            if (cell.isBomb) {
                correctFlags++;
            }
        } else {
            // 如果已经达到雷数，不允许放置更多旗帜，并恢复状态
            cell.isFlagged = false; // 取消本次标记操作
        }
    } else {
        cellElement.textContent = '';
        cellElement.classList.remove('flag');
        flagsPlaced--;
        if (cell.isBomb) {
            correctFlags--;
        }
    }
    updateFlagCount();
    checkWinCondition(); // 标记/取消标记后也检查胜利条件
}

// 检查胜利条件
function checkWinCondition() {
    // 胜利条件1：所有非雷单元格都被揭示
    const totalSafeCells = (GRID_SIZE_X * GRID_SIZE_Y) - BOOM_COUNT; // 修正总单元格数计算
    const allSafeCellsRevealed = (revealedCells === totalSafeCells);

    if (allSafeCellsRevealed) {
        endGame(true); // 成功揭示所有非雷单元格
    }
}

// 游戏结束
function endGame(win) {
    gameOver = true;
    stopTimer(); // 停止计时
    const finalTime = timerDisplay.textContent.replace('⏱ ', ''); // 获取最终时间

    if (win) {
        messageDisplay.textContent = `恭喜完成了游戏！用时：${finalTime}。您正确标记了 ${correctFlags} 个雷！`;
    } else {
        messageDisplay.textContent = `可惜再接再厉！用时：${finalTime}。您正确标记了 ${correctFlags} 个雷。`;
        revealAllBombs(); // 显示所有雷
    }

    // 移除所有单元格的点击事件，防止继续操作
    const allCells = gameContainer.querySelectorAll('.cell');
    allCells.forEach(cell => {
        // 使用命名函数来正确移除事件监听器
        cell.removeEventListener('click', handleCellClickEvent);
        cell.removeEventListener('contextmenu', handleCellRightClickEvent);
    });
}

// 揭示所有雷
function revealAllBombs() {
    for (let i = 0; i < GRID_SIZE_Y; i++) { // 行
        for (let j = 0; j < GRID_SIZE_X; j++) { // 列
            const cell = board[i][j];
            const cellIndex = i * GRID_SIZE_X + j; // 索引计算
            const cellElement = gameContainer.children[cellIndex];

            if (cell.isBomb && !cell.isFlagged && !cell.isRevealed) { // 是雷，但未被标记且未被揭示
                cellElement.textContent = '💣';
                cellElement.classList.add('bomb', 'revealed');
            } else if (!cell.isBomb && cell.isFlagged) { // 不是雷，但被错误标记了
                cellElement.textContent = '❌'; // 显示叉号
                cellElement.classList.remove('flag'); // 移除旗帜样式
                cellElement.classList.add('revealed', 'incorrect-flag'); // 添加错误标记样式
            }
            // 如果是正确标记的雷 (cell.isBomb && cell.isFlagged)，则保持旗帜显示
            // 如果是已揭示的安全单元格，保持其数字或空白
        }
    }
}

// 首次加载页面时，显示开始页面
showStartPage();
