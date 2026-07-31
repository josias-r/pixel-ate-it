use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct PlayerState {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub color: String,
    pub last_seq: u32,
    pub score: u32,
}

#[derive(Debug, Deserialize)]
pub struct MoveItem {
    #[serde(rename = "move")]
    pub direction: String, // "up", "down", "left", "right"
    pub seq: u32,
}

#[derive(Debug, Deserialize)]
pub struct ClientMove {
    pub moves: Vec<MoveItem>,
}

#[derive(Debug, Serialize)]
pub struct ServerUpdate {
    #[serde(rename = "type")]
    pub msg_type: String, // "update"
    pub ack: u32,
    pub others: Vec<RelativePlayer>,
}

#[derive(Debug, Serialize)]
pub struct RelativePlayer {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub color: String,
}

#[derive(Debug, Serialize)]
pub struct EatenMessage {
    #[serde(rename = "type")]
    pub msg_type: String, // "eaten"
    pub by_id: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LeaderboardEntry {
    pub id: String,
    pub color: String,
    pub score: u32,
}

#[derive(Debug, Serialize)]
pub struct LeaderboardUpdate {
    #[serde(rename = "type")]
    pub msg_type: String, // "leaderboard"
    pub top_players: Vec<LeaderboardEntry>,
}
