const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};
let currentPlayer = "w"; // The first player will be white

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

// Socket connection handling
io.on("connection", function (uniquesocket) {
    console.log("connected");

    // Assign players
    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerrole", "w");
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit("playerrole", "b");
    } else {
        uniquesocket.emit("spectator");
    }

    // Player disconnection
    uniquesocket.on("disconnect", function () {
        if (uniquesocket.id === players.white) {
            delete players.white;
        } else if (uniquesocket.id === players.black) {
            delete players.black;
        }
    });

    // Send current board state when requested
    uniquesocket.on("requestboardstate", function() {
        uniquesocket.emit("boardstate", chess.fen());
    });

    // Handle move events
    uniquesocket.on("move", (move) => {
        console.log("Received move on backend:", move);
        console.log("Current turn:", chess.turn());
        console.log("Player making move:", uniquesocket.id);
        console.log("White player:", players.white);
        console.log("Black player:", players.black);
    
        try {
            // Check if it's the player's turn
            if (chess.turn() === 'w' && uniquesocket.id !== players.white) {
                console.log("Not white player's turn");
                uniquesocket.emit("invalidmove", move);
                return;
            }
            if (chess.turn() === 'b' && uniquesocket.id !== players.black) {
                console.log("Not black player's turn");
                uniquesocket.emit("invalidmove", move);
                return;
            }
    
            console.log("Attempting move:", move);
            
            // Attempt to make the move
            const result = chess.move({
                from: move.from,
                to: move.to,
                promotion: move.promotion || 'q' // Default promotion to Queen
            });
    
            if (result) {
                console.log("Move successful:", result);
                currentPlayer = chess.turn();  // Update current player
                
                // Send updated information to all clients
                io.emit("move", move); // Notify all clients about the move
                io.emit("boardstate", chess.fen()); // Send updated board state (FEN)
                
                // Check for game over conditions
                if (chess.isGameOver()) {
                    if (chess.isCheckmate()) {
                        io.emit("gameover", { winner: chess.turn() === 'w' ? 'b' : 'w', reason: "checkmate" });
                    } else if (chess.isDraw()) {
                        io.emit("gameover", { reason: "draw" });
                    }
                }
            } else {
                console.log("Invalid move:", move);
                uniquesocket.emit("invalidmove", move);
                // Send current board state to resync
                uniquesocket.emit("boardstate", chess.fen());
            }
        } catch (err) {
            console.log("Error with move:", err);
            uniquesocket.emit("invalidmove", move);
            // Send current board state to resync
            uniquesocket.emit("boardstate", chess.fen());
        }
    });
});

// Server listen on port 3000
server.listen(3000, function () {
    console.log("Server is running on port 3000");
});