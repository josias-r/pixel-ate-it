use crate::models::{PlayerState, RelativePlayer, ServerUpdate};
use std::{collections::{HashMap, HashSet}, sync::Arc};
use tokio::sync::{mpsc, Mutex};

pub const CHUNK_SIZE: i32 = 100;

pub type ClientSender = mpsc::UnboundedSender<Vec<u8>>;

pub struct AppState {
    pub players: HashMap<String, PlayerState>,
    pub clients: HashMap<String, ClientSender>,
    pub grid: HashMap<(i32, i32), HashSet<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
            clients: HashMap::new(),
            grid: HashMap::new(),
        }
    }

    pub fn get_chunk(x: i32, y: i32) -> (i32, i32) {
        (x.div_euclid(CHUNK_SIZE), y.div_euclid(CHUNK_SIZE))
    }

    pub fn insert_to_grid(&mut self, player_id: String, x: i32, y: i32) {
        let chunk = Self::get_chunk(x, y);
        self.grid.entry(chunk).or_default().insert(player_id);
    }

    pub fn remove_from_grid(&mut self, player_id: &str, x: i32, y: i32) {
        let chunk = Self::get_chunk(x, y);
        if let Some(players) = self.grid.get_mut(&chunk) {
            players.remove(player_id);
            if players.is_empty() {
                self.grid.remove(&chunk);
            }
        }
    }

    pub fn get_nearby_players(&self, center_x: i32, center_y: i32, exclude_id: &str) -> Vec<PlayerState> {
        let (cx, cy) = Self::get_chunk(center_x, center_y);
        let mut nearby = Vec::new();
        for dx in -1..=1 {
            for dy in -1..=1 {
                if let Some(chunk_players) = self.grid.get(&(cx + dx, cy + dy)) {
                    for pid in chunk_players {
                        if pid != exclude_id {
                            if let Some(p) = self.players.get(pid) {
                                nearby.push(p.clone());
                            }
                        }
                    }
                }
            }
        }
        log::trace!("get_nearby_players for {} at ({}, {}) found {} players", exclude_id, center_x, center_y, nearby.len());
        nearby
    }
}

pub type SharedState = Arc<Mutex<AppState>>;

pub async fn send_update_to_client(state: &SharedState, client_id: &str) {
    let st = state.lock().await;
    if let Some(sender) = st.clients.get(client_id) {
        if let Some(my_state) = st.players.get(client_id) {
            let nearby_players = st.get_nearby_players(my_state.x, my_state.y, client_id);
            log::debug!("send_update_to_client: sending {} nearby players to {}", nearby_players.len(), client_id);
            let mut others = Vec::new();
            for p in nearby_players {
                others.push(RelativePlayer {
                    id: p.id.clone(),
                    x: p.x - my_state.x,
                    y: p.y - my_state.y,
                });
            }
            let msg = ServerUpdate {
                msg_type: "update".to_string(),
                ack: my_state.last_seq,
                others,
            };
            if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                let _ = sender.send(json_bytes);
            }
        }
    }
}

pub async fn broadcast_update_nearby(state: &SharedState, center_x: i32, center_y: i32, old_pos: Option<(i32, i32)>, exclude_id: &str) {
    let st = state.lock().await;
    
    let mut chunks_to_check = HashSet::new();
    
    let (cx, cy) = AppState::get_chunk(center_x, center_y);
    chunks_to_check.insert((cx, cy));
    
    if let Some((ox, oy)) = old_pos {
        let (ocx, ocy) = AppState::get_chunk(ox, oy);
        chunks_to_check.insert((ocx, ocy));
    }
    
    let mut nearby_client_ids = HashSet::new();
    
    for (chunk_x, chunk_y) in chunks_to_check {
        for dx in -1..=1 {
            for dy in -1..=1 {
                if let Some(chunk_players) = st.grid.get(&(chunk_x + dx, chunk_y + dy)) {
                    for pid in chunk_players {
                        if pid != exclude_id {
                            nearby_client_ids.insert(pid.clone());
                        }
                    }
                }
            }
        }
    }

    log::debug!("broadcast_update_nearby: center ({}, {}) old_pos {:?} sending to {} nearby clients", center_x, center_y, old_pos, nearby_client_ids.len());

    for id in nearby_client_ids {
        if let Some(sender) = st.clients.get(&id) {
            if let Some(my_state) = st.players.get(&id) {
                let nearby_players = st.get_nearby_players(my_state.x, my_state.y, &id);
                
                let mut others = Vec::new();
                for p in nearby_players {
                    others.push(RelativePlayer {
                        id: p.id.clone(),
                        x: p.x - my_state.x,
                        y: p.y - my_state.y,
                    });
                }
                
                let msg = ServerUpdate {
                    msg_type: "update".to_string(),
                    ack: my_state.last_seq,
                    others,
                };
                if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                    let _ = sender.send(json_bytes);
                }
            }
        }
    }
}
