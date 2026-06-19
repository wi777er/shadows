import random
import math
from backend.models import Player, Bot, EnergyFragment, GameState


class Game:
    def __init__(self):
        self.state = GameState()
        self.arena_width = 3000
        self.arena_height = 3000
        self._init_energy_fragments()

    def _init_energy_fragments(self, count: int = 100):
        for i in range(count):
            fragment = EnergyFragment(
                id=f"energy_{i}",
                x=random.uniform(0, self.arena_width),
                y=random.uniform(0, self.arena_height),
                exp_value=random.randint(5, 20),
            )
            self.state.energy_fragments[fragment.id] = fragment

    def add_player(self, player_id: str, name: str) -> Player:
        player = Player(
            id=player_id,
            name=name,
            x=random.uniform(100, self.arena_width - 100),
            y=random.uniform(100, self.arena_height - 100),
        )
        self.state.players[player_id] = player
        return player

    def remove_player(self, player_id: str):
        self.state.players.pop(player_id, None)

    def get_state_snapshot(self):
        return {
            "players": {
                pid: p.model_dump()
                for pid, p in self.state.players.items()
            },
            "energy_fragments": {
                eid: e.model_dump()
                for eid, e in self.state.energy_fragments.items()
                if not e.collected
            },
        }

    def distance(self, x1, y1, x2, y2):
        return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
