# ♠️ Fodinha Card Game

A modern, real-time web implementation of the traditional Brazilian card game **Fodinha** (also known as *Oh Hell!* or *Truco Paulista*), built with Next.js, React, and Socket.IO.

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
- **Manilha Suit Ranking** (when comparing manilha cards): ♣ Clubs (highest), ♥ Hearts, ♠ Spades, ♦ Diamonds (lowest)
- **Final Round Tie-Breaking**: Special cancellation logic based on pair completion order, with suit hierarchy for remaining cards

#### 🪙 Starting Conditions
- Each player starts with **3, 5, or 7 lives** (configurable)
- Game can start from **1 card** (índio) or **maximum cards** per player
- Cards per hand follow a wave pattern: increase to maximum, then decrease back to 1
- A random card determines the **manilha** (trump suit) each round
- **Cryptographically secure randomization** ensures fair card dealing

#### 🔮 Betting Phase
- Before playing, players bet how many tricks they expect to win
- Bets are made one player at a time in turn order
- **The last player to bet cannot make total bets equal the number of cards** (to prevent balanced bets)
- Real-time bet validation with immediate feedback

#### ♠️ Playing Cards
- Players take turns playing one card per trick in dealer rotation
- The **highest card** wins the trick (manilha beats all)
- **Card Cancellation**: Cards of equal strength cancel in pairs as played
- **Final Round Logic**: Special tie-breaking using pair completion order
- If all cards cancel, the trick multiplier increases for the next round
- **Crown indicator** (👑) shows the current winning card

#### 🎯 Scoring & Lives
- After all tricks are played, compare actual wins to predicted bets
- **Exact match**: Keep all lives
- **Wrong prediction**: Lose 1 life per wrong prediction.
- Players with **0 lives are eliminated**
- In games with 2-4 players the game ends when 1 player is eliminated. With 5-8 players it ends with 2 players eliminated. 9-10 player games end when 3 players are eliminated.

---

## 🚀 Deployment Options

### ✅ Option 1: Deploy to Render (Recommended)

1. Fork or clone this repository to your GitHub account
2. Sign up at [https://render.com](https://render.com)
3. Connect your GitHub account to Render
4. Create a new Web Service from your repository
5. Use the included `render.yaml` configuration or manual setup:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
   - **Environment**: Node.js
6. Click **Deploy**

✅ **Production Benefits**: 
- **Persistent SQLite database** with Drizzle ORM (no data loss on restarts)
- Reliable hosting with consistent performance
- Full Node.js environment with real-time Socket.IO support
- Automatic SSL certificates and custom domains
- Built-in database backups and health monitoring

### 🖥️ Option 2: Run Locally

#### Requirements
- Node.js 18+ installed on your machine
  
#### Steps

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/fodinha-card-game.git
cd fodinha-card-game

# Install dependencies
npm install

# Initialize database
npm run db:generate
npm run db:push

# Run the development server
npm run dev

# Build for production
npm run build

# Run production server
npm run start
```

---

## ✨ Game Features

### 🎮 Core Gameplay
- **Real-time multiplayer** with Socket.IO for instant updates
- **Bilingual support** (English/Portuguese) with mid-game language switching
- **Responsive design** optimized for mobile and desktop
- **Visual feedback** with card animations and status indicators
- **Crown highlighting** for winning cards in each trick
- **Card cancellation animations** with visual overlays

### 🎯 Game Mechanics
- **Cryptographically secure** card shuffling and dealer selection
- **Dynamic card distribution** with middle card workaround for edge cases
- **Advanced final round logic** with pair completion tie-breaking
- **Multiplier system** for tied rounds
- **Dealer rotation** with visual indicators (🎲 for English, 🦶 for Portuguese)
- **Turn-based gameplay** with clear visual cues

### 👥 Player Experience
- **Lobby system** with room codes for easy joining
- **Player status tracking** (active, inactive, eliminated)
- **Real-time notifications** with color-coded status updates
- **Betting validation** with helpful error messages
- **Game state preservation** during temporary disconnections
- **Post-game return to lobby** functionality

### 🔧 Technical Features
- **Conservative cleanup logic** prevents accidental player removal
- **Socket connection resilience** with automatic reconnection
- **Rate limiting** with intelligent backoff strategies
- **Database integrity** with automatic health checks
- **Error reporting system** with GitHub webhook integration
- **Comprehensive logging** for debugging and monitoring

---

## 🛠️ Technical Architecture

### Backend Infrastructure
- **Next.js API Routes** for game logic and state management
- **Socket.IO** for real-time communication and event broadcasting
- **SQLite + Drizzle ORM** for persistent data storage
- **In-memory caching** for active game state with database fallback
- **Middleware authentication** for secure API access

### Frontend Architecture
- **React with TypeScript** for type-safe component development
- **Context API** for global state management (Language, Socket, Theme)
- **Modular component structure** with Game/, contexts/, and pages/ organization
- **CSS Modules** for scoped styling and responsive design
- **Custom hooks** for game state management and socket synchronization

### Performance Optimizations
- **Debounced actions** to prevent duplicate requests
- **Optimistic UI updates** for immediate visual feedback
- **Smart polling fallbacks** when socket connections are unreliable
- **Efficient state synchronization** with version tracking
- **Background cleanup processes** for inactive lobbies and players

### Database Management
- **Automatic schema migrations** with Drizzle
- **Connection pooling** and transaction management
- **Lobby purging system** for cleaning up old games
- **Health monitoring** with endpoint status checks
- **Data validation** with Zod schemas

#### Available Scripts
```bash
# Database operations
npm run db:generate    # Generate migration files
npm run db:push       # Apply schema changes
npm run db:studio     # Open database GUI

# Maintenance
npm run purge-lobbies      # Clean up old lobbies
npm run purge-lobbies:dry  # Preview cleanup without changes

# Development
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint checks
```

---

## 🌐 Internationalization

The game supports **English** and **Portuguese** with:
- **Dynamic language switching** during gameplay
- **Localized game terms** and notifications
- **Cultural adaptations** (dealer indicators, card terminology)
- **Real-time translation updates** for all UI elements
- **Persistent language preferences** saved locally

---

## 🚨 Error Handling & Monitoring

### Built-in Systems
- **Automatic error reporting** to GitHub via webhooks
- **Connection recovery mechanisms** for network issues
- **Game state validation** with automatic correction
- **Player reconnection handling** with state restoration
- **Comprehensive logging** for debugging and analytics

### Health Monitoring
- **API health endpoints** for uptime monitoring
- **Database connection checks** with automatic reconnection
- **Socket connection quality indicators** 
- **Performance metrics** tracking for optimization

---

## ⚙️ Tech Stack

### Core Technologies
- **Next.js 14** – Full-stack React framework with API routes
- **React 18** – UI library with hooks and context
- **TypeScript** – Type safety and developer experience
- **Socket.IO** – Real-time bidirectional communication

### Database & Storage
- **SQLite** – Lightweight, persistent database
- **Drizzle ORM** – Type-safe database operations
- **File-based storage** for development and production

### Development Tools
- **ESLint** – Code linting and formatting
- **Drizzle Kit** – Database migrations and introspection
- **CSS Modules** – Scoped styling system

---

## 🎯 Game Configurations

### Lobby Settings
- **Player Lives**: 3, 5, or 7 lives per player
- **Starting Mode**: Begin with 1 card (índio) or maximum cards
- **Player Limit**: 2-10 players per game
- **Room Codes**: 4-character alphanumeric codes for easy joining

### Game Variants
- **Wave Pattern**: Cards increase to max, then decrease (traditional)
- **Elimination Mode**: Players eliminated at 0 lives
- **Multiplier Rounds**: Tied rounds increase next round value
- **Final Round Tiebreakers**: Advanced logic for complex scenarios

---

## 🧪 Known Limitations & Future Improvements

### Current Limitations
- **Mobile keyboard handling** could be improved for betting input
- **Spectator mode** not yet implemented
- **Game replay system** not available
- **Tournament bracket system** planned for future releases

### Planned Features
- **AI players** for single-player practice
- **Statistics tracking** for player performance
- **Custom game rules** and variations
- **Enhanced mobile experience** with native app features

---

## 🤝 Contributing

We welcome contributions! Here are ways to help:

1. **Bug Reports**: Use the in-game bug report system or GitHub issues
2. **Feature Requests**: Suggest improvements via GitHub discussions
3. **Code Contributions**: Fork, develop, and submit pull requests
4. **Translations**: Help add support for additional languages
5. **Testing**: Play games and report issues or edge cases

### Development Setup
```bash
git clone https://github.com/YOUR_USERNAME/fodinha-card-game.git
cd fodinha-card-game
npm install
npm run db:generate && npm run db:push
npm run dev
```

---

## 📄 License

MIT License. Feel free to fork, remix, and improve the game.

---

## 🎉 Acknowledgments

Made with ❤️ for fans of Brazilian card games and strategic multiplayer experiences.

**Special thanks to the community** for testing, feedback, and contributions that made this game robust and enjoyable.

---

