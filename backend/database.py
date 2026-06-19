import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "game.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            telegram_id TEXT,
            level INTEGER DEFAULT 1,
            exp INTEGER DEFAULT 0,
            kills INTEGER DEFAULT 0,
            deaths INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS game_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            player_id TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def save_player(player_id: str, name: str, telegram_id: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    if telegram_id:
        cursor.execute(
            "INSERT OR REPLACE INTO players (id, name, telegram_id) VALUES (?, ?, ?)",
            (player_id, name, telegram_id),
        )
    else:
        cursor.execute(
            "INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
            (player_id, name),
        )
    conn.commit()
    conn.close()


def get_player(player_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM players WHERE id = ?", (player_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
