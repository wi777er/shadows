import os
import math
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db, save_player
from backend.game import Game, ARENA_WIDTH, ARENA_HEIGHT
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Shadow Survivor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
os.makedirs(os.path.join(FRONTEND_DIR, "assets"), exist_ok=True)

maps: dict[str, Game] = {
    "map_1": Game("map_1"),
    "map_2": Game("map_2"),
    "map_3": Game("map_3"),
}


def get_most_populated_map(exclude: str | None = None) -> str:
    options = [(mid, len(g.state.players)) for mid, g in maps.items() if mid != exclude]
    if not options:
        return list(maps.keys())[0]
    return max(options, key=lambda o: o[1])[0]


@app.on_event("startup")
async def startup():
    init_db()
    for mid in maps:
        asyncio.create_task(state_pusher(mid))
async def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok", "maps": {mid: len(g.state.players) for mid, g in maps.items()}}


@app.get("/config")
async def config():
    return {"arena_width": ARENA_WIDTH, "arena_height": ARENA_HEIGHT, "maps": list(maps.keys())}


@app.get("/{filename:path}")
async def static_files(filename: str):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, pid: str, ws: WebSocket):
        await ws.accept()
        self.active[pid] = ws

    def disconnect(self, pid: str):
        self.active.pop(pid, None)

    async def send(self, pid: str, data: dict):
        ws = self.active.get(pid)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(pid)

    async def broadcast_to_map(self, map_id: str, data: dict, exclude: set | None = None):
        game = maps.get(map_id)
        if not game:
            return
        dead = []
        for pid, ws in self.active.items():
            if exclude and pid in exclude:
                continue
            if pid not in game.state.players:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(pid)
        for pid in dead:
            self.disconnect(pid)


manager = ConnectionManager()


async def state_pusher(map_id: str):
    """Push game state to all players on this map every 50ms."""
    while True:
        await asyncio.sleep(0.05)
        game = maps.get(map_id)
        if not game or not game.state.players:
            continue
        state = game.get_public_state()
        await manager.broadcast_to_map(map_id, {"type": "state", **state})


@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await manager.connect(player_id, websocket)
    name = f"Player_{player_id[:6]}"
    current_map = "map_1"
    game = maps[current_map]
    game.add_player(player_id, name)
    save_player(player_id, name)

    await manager.broadcast_to_map(current_map, {
        "type": "player_joined", "player_id": player_id, "name": name,
    }, exclude={player_id})

    await manager.send(player_id, {"type": "state", "map_id": current_map, **game.get_public_state()})

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "move":
                x = data.get("x")
                y = data.get("y")
                angle = data.get("angle", 0)
                if x is not None and y is not None:
                    game.move_player(player_id, x, y, angle)

            elif action == "attack":
                target_id = data.get("target_id")
                if target_id:
                    # Track attacker position for knockback direction
                    p = game.state.players.get(player_id)
                    if p:
                        p.x = data.get("x", p.x)
                        p.y = data.get("y", p.y)
                    result = game.attack_player(player_id, target_id)
                    if result:
                        await manager.broadcast_to_map(current_map, {
                            "type": "damage", **result, "map_id": current_map,
                        })

            elif action == "change_map":
                old_map = current_map
                game.remove_player(player_id)
                await manager.broadcast_to_map(old_map, {
                    "type": "player_left", "player_id": player_id,
                })
                current_map = get_most_populated_map(exclude=old_map)
                game = maps[current_map]
                game.add_player(player_id, name)
                await manager.send(player_id, {
                    "type": "state_change", "map_id": current_map,
                    **game.get_public_state(),
                })
                await manager.broadcast_to_map(current_map, {
                    "type": "player_joined", "player_id": player_id, "name": name,
                }, exclude={player_id})

            elif action == "respawn":
                game.respawn_player(player_id)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(player_id)
        game.remove_player(player_id)
        await manager.broadcast_to_map(current_map, {
            "type": "player_left", "player_id": player_id,
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
