import random
import math
from backend.models import GameState, Player

ARENA_WIDTH = 3000
ARENA_HEIGHT = 3000
PLAYER_ATTACK_RANGE = 60
PLAYER_ATTACK_ANGLE = math.radians(120)
BASE_PLAYER = {"hp": 100, "max_hp": 100, "level": 1, "exp": 0, "exp_to_next": 100, "damage": 10, "speed": 200, "kills": 0}


class Game:
    def __init__(self, map_id: str):
        self.map_id = map_id
        self.state = GameState()

    def add_player(self, player_id: str, name: str) -> Player:
        p = self.state.players.get(player_id)
        if p:
            p.alive = True
            p.hp = p.max_hp
            return p
        player = Player(
            id=player_id, name=name,
            x=random.uniform(100, ARENA_WIDTH - 100),
            y=random.uniform(100, ARENA_HEIGHT - 100),
        )
        self.state.players[player_id] = player
        return player

    def remove_player(self, player_id: str):
        self.state.players.pop(player_id, None)

    def move_player(self, player_id: str, x: float, y: float, angle: float):
        p = self.state.players.get(player_id)
        if p and p.alive:
            p.x = max(0, min(ARENA_WIDTH, x))
            p.y = max(0, min(ARENA_HEIGHT, y))
            p.angle = angle

    def attack_player(self, attacker_id: str, target_id: str) -> dict | None:
        attacker = self.state.players.get(attacker_id)
        target = self.state.players.get(target_id)
        if not attacker or not target or not attacker.alive or not target.alive:
            return None
        dx = target.x - attacker.x
        dy = target.y - attacker.y
        dist = math.sqrt(dx * dx + dy * dy)
        if dist > PLAYER_ATTACK_RANGE:
            return None
        angle = math.atan2(dy, dx)
        diff = angle - getattr(attacker, 'angle', 0)
        while diff > math.pi: diff -= math.pi * 2
        while diff < -math.pi: diff += math.pi * 2
        if abs(diff) > PLAYER_ATTACK_ANGLE / 2:
            return None
        dmg = attacker.damage
        target.hp -= dmg
        result = {"attacker_id": attacker_id, "target_id": target_id, "damage": dmg,
                  "target_hp": target.hp, "attacker_x": attacker.x, "attacker_y": attacker.y}
        if target.hp <= 0:
            target.alive = False
            target.hp = 0
            attacker.kills += 1
            result["killed"] = True
            result["killer_id"] = attacker_id
        return result

    def respawn_player(self, player_id: str):
        p = self.state.players.get(player_id)
        if p:
            p.alive = True
            p.hp = p.max_hp
            p.x = random.uniform(100, ARENA_WIDTH - 100)
            p.y = random.uniform(100, ARENA_HEIGHT - 100)

    def reset_player(self, player_id: str):
        p = self.state.players.get(player_id)
        if p:
            for k, v in BASE_PLAYER.items():
                setattr(p, k, v)
            p.alive = False
            p.hp = 0

    def get_public_state(self):
        players_data = {}
        for pid, p in self.state.players.items():
            players_data[pid] = {
                "x": p.x, "y": p.y, "hp": p.hp, "max_hp": p.max_hp,
                "level": p.level, "kills": p.kills, "alive": p.alive,
                "name": p.name, "damage": p.damage,
            }
        return {"map_id": self.map_id, "players": players_data}
