# ♠️ Fodinha Card Game

A modern web implementation of the traditional Brazilian card game **Fodinha** (also known as *Oh Hell!* or *Truco Paulista*), built with Next.js and React.

---

## 🎮 How to Play Fodinha

Fodinha is a **round-based trick-taking card game** with betting mechanics and elimination by lives. It's strategic, social, and gets more intense as the rounds progress.

### 🧠 Objective
Predict the number of **tricks** (round wins) you'll win each round. Get it wrong, and you lose lives.

---

### 🃏 Game Rules

#### ♣️♦️♥️♠️ Card Suits and Order
- The game uses a **40-card deck** with the following suits: ♣ Clubs, ♥ Hearts, ♠ Spades, ♦ Diamonds
- **Card Value Order** (lowest to highest): 4, 5, 6, 7, Q, J, K, A, 2, 3
- **Manilha Cards**: When a card is drawn to determine the manilha, the manilha value is the next card in the sequence (e.g., if 7 is drawn, Q is the manilha value)
- **Manilha Suit Ranking** (when comparing manilha cards): Clubs (highest), Hearts, Spades, Diamonds (lowest)
- **Tie-Breaking Suit Ranking** (used only to break ties in final rounds): Clubs (highest), Hearts, Spades, Diamonds (lowest)

#### 🪙 Starting Conditions
- Each player starts with **3 lives**
- In round 1, each player receives **1 card**
- The number of cards **increases each round**, then decreases again (like a bell curve)
- A random card determines the **manilha** (trump suit) each round

#### 🔮 Betting Phase
- Before playing, players bet how many tricks they expect to win
- Bets are made one player at a time
- **The last player to bet cannot guess the exact number needed to equal all tricks combined** (to prevent balanced bets)

#### ♠️ Playing Cards
- Players take turns playing one card per trick
- The **highest card** wins the trick
- Manilha (trump) cards **beat all other cards**, regardless of suit
- If two cards tie in value, **both are cancelled**
- If a trick is cancelled and nobody wins it, the **next trick is worth double**

#### 🎯 Scoring & Lives
- After all tricks are played, compare the number of tricks each player won to their bet
- For each trick you miss your bet by, **you lose that many lives**
- A player with **0 lives is eliminated**
- The last remaining player wins

#### 👁️ Special First-Round Rule
- In round 1, **you cannot see your own card**
- However, you **can see all other players' cards**

---

## 🚀 Deployment Options

### ✅ Option 1: Deploy to Render (Recommended)

1. Fork or clone this repository to your GitHub account
2. Sign up at [https://render.com](https://render.com)
3. Connect your GitHub account to Render
4. Create a new Web Service from your repository
5. Set the build command to `npm run build` and start command to `npm run start`
6. Click **Deploy**

✅ **Production Benefits**: 
- Uses persistent file-based storage (no data loss on restarts)
- Reliable hosting with consistent performance
- No serverless limitations - full Node.js environment
- Automatic SSL certificates and custom domains

### 🖥️ Option 2: Run Locally

#### Requirements
- Node.js installed on your machine
  
#### Steps

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/fodinha-card-game.git
cd fodinha-card-game

# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build

# Run production server
npm run start
```

---

## ✨ Game Features
- Gold shine highlight for winning cards
- Visual card selection feedback
- Color-coded status notifications
- Player HUDs with:
  - Player names
  - Current bets
  - Lives remaining
  - Round wins
- Real-time round progress tracking
- Manilha (trump card) system
- Trick winner resolution
- Card tie logic & double trick rule
- Hidden self-card in round 1
- Room-based matchmaking system
- Optimized for mobile and desktop

---

## 🛠️ Technical Improvements

### Performance Optimizations
- Dynamic debounce timing based on hand size
- Preemptive visual feedback for responsive gameplay
- Robust error handling with automatic retries
- Smart socket reconnection logic
- Optimized state updates to prevent flickering
- Rate limiting with backoff strategy
- Efficient API polling

### Database Management
- Automatic database file integrity checking
- Built-in lobby purging functionality
- Timestamp tracking for all game lobbies
- Database permissions handling

#### Lobby Purging
The system includes automatic purging of old, inactive lobbies:
- Run automatically when starting the server with `npm run start`
- Configurable age threshold (default: 7 days)
- Manual purging available via `npm run purge-lobbies`
- Dry-run option to preview what would be purged: `npm run purge-lobbies:dry`

See [LOBBY-PURGE.md](LOBBY-PURGE.md) for more details.

---

## ⚙️ Tech Stack
- Next.js – Framework for React and fullstack logic
- React – UI library
- TypeScript – Type safety
- Socket.IO – Real-time communication
- lowdb – Lightweight file-based JSON database for storage

---

## 🧪 Known Limitations
- In-memory storage in production may cause games to reset if instances restart
- Best experience with 2-6 players
- Slight lag may occur in hands with 4-5 cards

---

## 📄 License

MIT License. Feel free to fork, remix, and improve the game.

Made with ❤️ for fans of Brazilian card games and good old-fashioned mind games.
