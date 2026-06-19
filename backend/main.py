import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db, save_player
from backend.game import Game
from dotenv import load_dotenv

load_dotenv()

ADMIN_TG_ID = os.getenv("ADMIN_TG_ID", "7153815329")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

app = FastAPI(title="Shadow Survivor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

game = Game()

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

os.makedirs(os.path.join(FRONTEND_DIR, "assets"), exist_ok=True)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok", "players": len(game.state.players)}


@app.get("/config")
async def config():
    return {
        "arena_width": game.arena_width,
        "arena_height": game.arena_height,
        "bot_count": 30,
        "max_players": 15,
    }


@app.get("/{filename:path}")
async def static_files(filename: str):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, player_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[player_id] = websocket

    def disconnect(self, player_id: str):
        self.active_connections.pop(player_id, None)

    async def send_to(self, player_id: str, data: dict):
        ws = self.active_connections.get(player_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(player_id)

    async def broadcast(self, data: dict):
        disconnected = []
        for pid, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(pid)
        for pid in disconnected:
            self.disconnect(pid)


manager = ConnectionManager()


@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await manager.connect(player_id, websocket)
    player_name = f"Player_{player_id[:6]}"

    player = game.add_player(player_id, player_name)
    save_player(player_id, player_name)

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "move":
                px = data.get("x", player.x)
                py = data.get("y", player.y)
                player.x = max(0, min(game.arena_width, px))
                player.y = max(0, min(game.arena_height, py))

            elif action == "attack":
                pass

            snapshot = game.get_state_snapshot()
            await manager.send_to(player_id, snapshot)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(player_id)
        game.remove_player(player_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
