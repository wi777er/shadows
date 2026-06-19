from pydantic import BaseModel
from typing import Optional


class Player(BaseModel):
    id: str
    name: str
    x: float = 0
    y: float = 0
    hp: int = 100
    max_hp: int = 100
    level: int = 1
    exp: int = 0
    exp_to_next: int = 100
    damage: int = 10
    speed: int = 200
    kills: int = 0
    alive: bool = True


class Bot(BaseModel):
    id: str
    name: str
    x: float
    y: float
    hp: int = 50
    max_hp: int = 50
    level: int = 1
    damage: int = 5
    speed: int = 100
    alive: bool = True


class EnergyFragment(BaseModel):
    id: str
    x: float
    y: float
    exp_value: int = 10
    collected: bool = False


class GameState(BaseModel):
    players: dict[str, Player] = {}
    bots: dict[str, Bot] = {}
    energy_fragments: dict[str, EnergyFragment] = {}
