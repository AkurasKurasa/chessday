// Small opening classifier used when the source doesn't name the opening.
// Longest matching move prefix wins, so order specific lines before general ones.
const OPENINGS = [
  ["e4 e5 Nf3 Nc6 Bb5", "Ruy Lopez"], ["e4 e5 Nf3 Nc6 Bc4 Nf6", "Two Knights Defense"], ["e4 e5 Nf3 Nc6 Bc4", "Italian Game"],
  ["e4 e5 Nf3 Nc6 d4", "Scotch Game"], ["e4 e5 Nf3 Nc6 Nc3 Nf6", "Four Knights Game"], ["e4 e5 Nf3 Nc6 Nc3", "Three Knights Opening"],
  ["e4 e5 Nf3 Nc6", "King's Knight Opening"], ["e4 e5 Nf3 Nf6", "Petrov's Defense"], ["e4 e5 Nf3 d6", "Philidor Defense"],
  ["e4 e5 Nf3", "King's Knight Opening"], ["e4 e5 f4", "King's Gambit"], ["e4 e5 Nc3", "Vienna Game"], ["e4 e5 Bc4", "Bishop's Opening"],
  ["e4 e5 Qh5", "Wayward Queen Attack"], ["e4 e5 d4", "Center Game"], ["e4 e5", "King's Pawn Game"],
  ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "Sicilian Defense: Najdorf"], ["e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6", "Sicilian Defense: Dragon"],
  ["e4 c5 c3", "Sicilian Defense: Alapin"], ["e4 c5 Nc3", "Sicilian Defense: Closed"], ["e4 c5 d4", "Sicilian Defense: Smith-Morra"],
  ["e4 c5", "Sicilian Defense"], ["e4 e6", "French Defense"], ["e4 c6", "Caro-Kann Defense"], ["e4 d5", "Scandinavian Defense"],
  ["e4 Nf6", "Alekhine Defense"], ["e4 d6", "Pirc Defense"], ["e4 g6", "Modern Defense"], ["e4 Nc6", "Nimzowitsch Defense"],
  ["e4 b6", "Owen Defense"], ["e4", "King's Pawn Opening"],
  ["d4 d5 c4 e6", "Queen's Gambit Declined"], ["d4 d5 c4 dxc4", "Queen's Gambit Accepted"], ["d4 d5 c4 c6", "Slav Defense"],
  ["d4 d5 c4", "Queen's Gambit"], ["d4 Nf6 c4 g6 Nc3 d5", "Grünfeld Defense"], ["d4 Nf6 c4 g6", "King's Indian Defense"],
  ["d4 Nf6 c4 e6 Nc3 Bb4", "Nimzo-Indian Defense"], ["d4 Nf6 c4 e6 Nf3 b6", "Queen's Indian Defense"], ["d4 Nf6 c4 c5", "Benoni Defense"],
  ["d4 Nf6 c4 e6", "Indian Defense"], ["d4 f5", "Dutch Defense"], ["d4 d5", "Queen's Pawn Game"], ["d4 Nf6", "Indian Defense"],
  ["d4", "Queen's Pawn Opening"], ["c4", "English Opening"], ["Nf3", "Zukertort Opening"], ["f4", "Bird Opening"],
  ["g3", "Hungarian Opening"], ["b3", "Nimzo-Larsen Attack"], ["b4", "Polish Opening"], ["e3", "Van't Kruijs Opening"],
];

export function classify(moves) {
  if (moves[0] === "d4" && [moves[2], moves[4]].includes("Bf4")) return "London System";
  const line = moves.slice(0, 10).join(" ");
  for (const [prefix, name] of OPENINGS) if (line === prefix || line.startsWith(prefix + " ")) return name;
  return "Uncommon opening";
}

// "Sicilian Defense: Najdorf Variation, English Attack" -> "Sicilian Defense"
export const family = (name) => (name || "Uncommon opening").split(":")[0].split(",")[0].trim();

export const openingUrl = (name) =>
  `https://lichess.org/opening/${encodeURIComponent(name.replace(/'/g, "").replace(/ /g, "_"))}`;
