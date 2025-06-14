# backend/app.py
import uuid
import os # Added for environment variable access
from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from game_logic import FodinhaGame

app = Flask(__name__)
app.config["SECRET_KEY"] = "dev_secret_key_ πολυ-secure!" # Changed for a bit more entropy
socketio = SocketIO(app, cors_allowed_origins="*")

# ── Lobby & Game Management ───────────────────────────────────────────────────
# games will store: { room_id: {"players": [player_id_1, player_id_2, ...], "game": FodinhaGame_instance} }
games = {}
MAX_PLAYERS_PER_LOBBY = 10

def generate_room_id():
    """Generates a short, unique room ID."""
    # Simple 6-char ID for now, you might want something more robust for production
    return uuid.uuid4().hex[:6].upper()

# ── Health-check route ─────────────────────────────────────────────────────────
@app.route("/")
def status():
    return {"status": "Fodinha backend alive"}

# ── Socket handlers ────────────────────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    # Let the client know they're connected.
    # We don't assign them to a room here yet, they need to create or join.
    emit("connected", {"msg": "✨ Connected to Fodinha backend. Create or join a lobby!"})

@socketio.on("create_lobby")
def on_create_lobby(data):
    """
    Host creates a new lobby.
    data = {"player_id": "P1"}
    """
    player_id = data.get("player_id")
    if not player_id:
        emit("error", {"msg": "Player ID is required to create a lobby."}, room=request.sid)
        return

    room_id = generate_room_id()
    while room_id in games: # Ensure unique room_id
        room_id = generate_room_id()

    join_room(room_id)
    games[room_id] = {
        "players": [player_id],
        "game": None # Game instance created when game starts
    }
    
    print(f"Lobby {room_id} created by {player_id}. Current lobbies: {list(games.keys())}")
    emit("lobby_created", {"room_id": room_id, "players": games[room_id]["players"]}, room=request.sid) # Only to host
    # Also emit lobby_state to the room (which currently only has the host)
    socketio.emit("lobby_state", {"room_id": room_id, "players": games[room_id]["players"]}, room=room_id)


@socketio.on("join_lobby")
def on_join_lobby(data):
    """
    Player joins an existing lobby.
    data = {"room_id": "XYZ123", "player_id": "P2"}
    """
    room_id = data.get("room_id")
    player_id = data.get("player_id")

    if not room_id or not player_id:
        emit("error", {"msg": "Room ID and Player ID are required to join."}, room=request.sid)
        return

    if room_id not in games:
        emit("error", {"msg": f"Lobby {room_id} not found."}, room=request.sid)
        return

    if games[room_id]["game"] is not None:
        emit("error", {"msg": f"Game in lobby {room_id} has already started."}, room=request.sid)
        return

    if len(games[room_id]["players"]) >= MAX_PLAYERS_PER_LOBBY:
        emit("error", {"msg": f"Lobby {room_id} is full."}, room=request.sid)
        return

    if player_id in games[room_id]["players"]:
        # Player is already in the lobby, perhaps rejoining.
        # Just ensure they are in the socket.io room and update them.
        join_room(room_id)
        emit("lobby_state", {"room_id": room_id, "players": games[room_id]["players"]}, room=request.sid)
        print(f"Player {player_id} re-joined lobby {room_id}.")
        return

    join_room(room_id)
    games[room_id]["players"].append(player_id)
    print(f"Player {player_id} joined lobby {room_id}. Players: {games[room_id]['players']}")
    socketio.emit("lobby_state", {"room_id": room_id, "players": games[room_id]["players"]}, room=room_id)


@socketio.on("start_game")
def on_start_game(data):
    """
    Host starts the game in their lobby.
    data = {"room_id": "XYZ123"} (player_id who is starting can be inferred from request.sid if needed,
                                   but good practice to ensure they are the host or in the lobby)
    """
    room_id = data.get("room_id")
    requesting_player_sid = request.sid # SID of the player who sent "start_game"

    if not room_id:
        emit("error", {"msg": "Room ID is required to start the game."}, room=requesting_player_sid)
        return

    if room_id not in games:
        emit("error", {"msg": f"Lobby {room_id} not found."}, room=requesting_player_sid)
        return
    
    lobby_data = games[room_id]
    if not lobby_data["players"]: # Should not happen if lobby exists
        emit("error", {"msg": "No players in the lobby."}, room=requesting_player_sid)
        return

    # Optional: Check if the requesting player is the host (the first player who joined)
    # This requires storing/knowing the host's player_id or SID.
    # For simplicity now, any player in the lobby can trigger start if game not started.

    if lobby_data["game"] is not None:
        emit("error", {"msg": "Game already running in this lobby."}, room=requesting_player_sid)
        return

    current_players_in_lobby = lobby_data["players"]
    if len(current_players_in_lobby) < 2: # Min players for Fodinha
        emit("error", {"msg": "Need at least 2 players to start."}, room=requesting_player_sid)
        # Also emit to room so everyone knows
        socketio.emit("lobby_message", {"msg": "Need at least 2 players to start."}, room=room_id)
        return

    # Create and store the game instance for this room
    lobby_data["game"] = FodinhaGame(player_ids=current_players_in_lobby)
    print(f"Game started in lobby {room_id} with players: {current_players_in_lobby}")
    
    # Broadcast identical starting state to ALL sockets in the room
    socketio.emit("game_started", lobby_data["game"].get_game_state(), room=room_id)


@socketio.on("next_round")
def on_next_round(data):
    """
    Data should include room_id to identify which game's round to advance.
    data = {"room_id": "XYZ123"}
    """
    room_id = data.get("room_id")
    requesting_player_sid = request.sid

    if not room_id:
        emit("error", {"msg": "Room ID is required for next round."}, room=requesting_player_sid)
        return
        
    if room_id not in games or games[room_id]["game"] is None:
        emit("error", {"msg": "Game not started or lobby not found."}, room=requesting_player_sid)
        return

    current_game = games[room_id]["game"]
    keep_playing = current_game.next_round()

    socketio.emit("round_update", current_game.get_game_state(), room=room_id)

    if not keep_playing:
        socketio.emit("game_over", current_game.get_game_state(), room=room_id)
        print(f"Game over in lobby {room_id}. Players: {games[room_id]['players']}")
        # Clean up the game for this room, players remain for a new game or leave
        games[room_id]["game"] = None 
        # Optionally, you could clear players or remove the lobby if no one wants to play again
        # For now, players stay, lobby_state remains as is until they leave or start new game.

@socketio.on("disconnect")
def on_disconnect():
    disconnected_sid = request.sid
    print(f"Player with SID {disconnected_sid} disconnected.")
    
    # Find which room (if any) the disconnected player was in
    room_to_update = None
    player_id_that_left = None

    for r_id, data in list(games.items()): # Iterate over a copy for safe modification
        # This is tricky because we only have SID, not player_id directly mapped to SID here.
        # A robust solution would be to map SID to player_id upon join.
        # For now, let's assume we need to find player by SID in SocketIO rooms and then update our 'games' dict.

        # A simpler, but less direct approach for now:
        # If a game is active, we'd need to notify it. FodinhaGame doesn't support player removal mid-game easily.
        # Let's focus on lobby player list cleanup.

        # Find the player_id associated with this SID (this is a missing piece of state)
        # To simplify, we'll just remove the room if it becomes empty.
        # A proper implementation needs to map sids to player_ids upon join.

        # Let's try to find if this SID was in any of our game rooms
        sio_rooms = socketio.server.rooms(sid=disconnected_sid)
        
        found_player_id = None # We need a way to get the player_id from the SID

        for r_id_candidate in sio_rooms:
            if r_id_candidate in games: # If the SID was in one of our managed game rooms
                # Attempt to find and remove the player. This part is IMPROVISED as we don't store player_id by SID
                # This is a placeholder for a more robust player removal logic.
                # You'd ideally get player_id during "join_lobby" and store {sid: player_id} mapping.
                
                # For this iteration, if a player disconnects from a room,
                # we'll just print a message. Proper removal requires SID-to-PlayerID mapping.
                print(f"SID {disconnected_sid} was in room {r_id_candidate}. Manual cleanup of player list might be needed if game not robust to it.")
                
                # A very basic cleanup: if a room has no one left in Socket.IO's view, try to remove it.
                # This is not perfect as player might still be in games[r_id_candidate]['players']
                # if we don't have their player_id to remove them.
                # A better disconnect handling is needed for robustness.

    # Simplified cleanup: remove empty lobbies
    for r_id, data in list(games.items()):
        # Get clients in a specific room
        clients_in_room = socketio.server.manager.get_participants(namespace='/', room=r_id)
        if not clients_in_room:
            print(f"Lobby {r_id} is empty, removing.")
            del games[r_id]
        else:
            # If someone disconnected, the remaining players should get an updated lobby_state.
            # This requires knowing which player_id left to remove them from games[r_id]['players'].
            # This part is deferred due to lack of SID-to-player_id mapping.
            pass


# ── Launch locally or on Render ────────────────────────────────────────────────
if __name__ == "__main__":
    print("Starting Fodinha backend with dynamic lobbies...")
    # Use Replit's PORT environment variable if available, otherwise default to 5050
    port = int(os.environ.get("PORT", 5050))
    # For Replit, host should be '0.0.0.0' to be accessible
    socketio.run(app, host="0.0.0.0", port=port, debug=True, use_reloader=False)

