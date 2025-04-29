const socket = io();  // Connect to backend
const chess = new Chess();
const boardElement = document.getElementById("chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let isFlipped = false;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    
    // Update status display
    const statusDisplay = document.getElementById("status-display");
    if (statusDisplay) {
        if (playerRole === "w") {
            statusDisplay.textContent = "You are playing as White";
        } else if (playerRole === "b") {
            statusDisplay.textContent = "You are playing as Black";
        } else {
            statusDisplay.textContent = "You are spectating";
        }
        
        // Add whose turn it is
        if (chess.turn() === "w") {
            statusDisplay.textContent += " - White's turn";
        } else {
            statusDisplay.textContent += " - Black's turn";
        }
    }

    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
        for (let colIndex = 0; colIndex < 8; colIndex++) {
            let square = board[rowIndex][colIndex];
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowIndex + colIndex) % 2 === 0 ? "light" : "dark");
            
            // Store the actual chess coordinates
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = colIndex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);

                if (square.color === playerRole && chess.turn() === playerRole) {
                    pieceElement.draggable = true;

                    pieceElement.addEventListener("dragstart", (e) => {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        e.dataTransfer.setData("text/plain", "");
                        e.stopPropagation();
                    });

                    pieceElement.addEventListener("dragend", (e) => {
                        draggedPiece = null;
                        sourceSquare = null;
                        e.stopPropagation();
                    });
                }

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (!draggedPiece) return;

                const targetSquare = {
                    row: parseInt(squareElement.dataset.row),
                    col: parseInt(squareElement.dataset.col)
                };

                handleMove(sourceSquare, targetSquare);
            });

            boardElement.appendChild(squareElement);
        }
    }
};

const handleMove = (source, target) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    // For black player (board is flipped), we need to adjust coordinates
    let fromCol = source.col;
    let fromRow = source.row;
    let toCol = target.col;
    let toRow = target.row;
    
    // Convert from our coordinate system to chess notation
    // In chess notation: files go from a-h (left to right), ranks go from 1-8 (bottom to top)
    const from = files[fromCol] + (8 - fromRow);
    const to = files[toCol] + (8 - toRow);

    const move = { from, to, promotion: 'q' }; // Auto-promote to queen
    console.log("Sending move to backend:", move);
    
    // Don't try to make the move locally - let the server validate
    socket.emit('move', move);
};

const getPieceUnicode = (square) => {
    const unicodePieces = {
        p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
        P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
    };
    const key = square.color === 'w' ? square.type.toUpperCase() : square.type.toLowerCase();
    return unicodePieces[key] || "";
};

// Socket handlers
socket.on("playerrole", (role) => {
    playerRole = role;
    console.log("Assigned role:", role);
    
    // Update UI based on role
    if (playerRole === 'b') {
        isFlipped = true;
        boardElement.classList.add("flipped");
    }
    
    // Request the current board state after receiving role
    socket.emit("requestboardstate");
    renderBoard(); // Re-render the board after setting the role
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

socket.on("boardstate", (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on("invalidmove", (move) => {
    console.log("Invalid move:", move);
    // Reset the local board state to match the server
    socket.emit("requestboardstate");
});

socket.on("spectator", () => {
    alert("You are a spectator. You can only watch the game.");
});

// Request initial board state when connecting
socket.emit("requestboardstate");

renderBoard();  // Initial render