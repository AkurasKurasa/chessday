import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";

// Click-to-move and drag-to-move on top of react-chessboard.
// `game` is a chess.js instance; `onMove({from,to,promotion})` returns true if the move was made.
export default function Board({ game, fen, orientation = "white", interactive = true, lastMove, onMove, highlight }) {
  const [selected, setSelected] = useState(null);

  const targets = useMemo(() => {
    if (!selected) return [];
    try { return game.moves({ square: selected, verbose: true }).map((m) => m.to); } catch { return []; }
  }, [selected, game, fen]);

  const squareStyles = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { background: "rgba(255, 210, 63, 0.55)" };
    squareStyles[lastMove.to] = { background: "rgba(255, 210, 63, 0.7)" };
  }
  if (highlight) for (const [sq, style] of Object.entries(highlight)) squareStyles[sq] = style;
  if (game.inCheck()) {
    const king = game.board().flat().find((p) => p && p.type === "k" && p.color === game.turn());
    if (king) squareStyles[king.square] = { background: "radial-gradient(circle, #ff5a5f 0%, rgba(255,90,95,0.35) 55%, transparent 75%)" };
  }
  if (selected) squareStyles[selected] = { background: "rgba(255, 111, 181, 0.65)" };
  for (const t of targets)
    squareStyles[t] = game.get(t)
      ? { background: "radial-gradient(circle, transparent 58%, rgba(22,17,58,0.45) 60%)" }
      : { background: "radial-gradient(circle, rgba(22,17,58,0.45) 22%, transparent 24%)" };

  function tryMove(from, to) {
    const piece = game.get(from);
    const promotion = piece?.type === "p" && (to[1] === "8" || to[1] === "1") ? "q" : undefined;
    setSelected(null);
    return onMove({ from, to, promotion });
  }

  function onSquareClick({ square }) {
    if (!interactive) return;
    if (selected && targets.includes(square)) return void tryMove(selected, square);
    const p = game.get(square);
    setSelected(p && p.color === game.turn() ? square : null);
  }

  return (
    <div className="board-frame">
      <Chessboard
        options={{
          id: "chessday-board",
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          allowDrawingArrows: true,
          animationDurationInMs: 180,
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          darkSquareNotationStyle: { color: "var(--board-light)", fontWeight: 800 },
          lightSquareNotationStyle: { color: "var(--board-dark)", fontWeight: 800 },
          squareStyles,
          canDragPiece: ({ piece }) => interactive && piece.pieceType[0] === game.turn(),
          onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? tryMove(sourceSquare, targetSquare) : false),
          onSquareClick,
        }}
      />
    </div>
  );
}
