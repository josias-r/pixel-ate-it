use crate::models::{PlayerState, RelativePlayer, ServerUpdate};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{mpsc, Mutex};

pub type ClientSender = mpsc::UnboundedSender<Vec<u8>>;

pub struct AppState {
    pub players: HashMap<String, PlayerState>,
    pub clients: HashMap<String, ClientSender>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
            clients: HashMap::new(),
        }
    }
}

pub type SharedState = Arc<Mutex<AppState>>;

pub async fn broadcast_update(state: &SharedState) {
    let st = state.lock().await;
    let player_list: Vec<PlayerState> = st.players.values().cloned().collect();

    for (id, sender) in &st.clients {
        if let Some(my_state) = st.players.get(id) {
            let mut others = Vec::new();
            for p in &player_list {
                if p.id != *id {
                    others.push(RelativePlayer {
                        id: p.id.clone(),
                        x: p.x - my_state.x,
                        y: p.y - my_state.y,
                    });
                }
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

pub async fn broadcast_update_except(state: &SharedState, exclude_id: &str) {
    let st = state.lock().await;
    let player_list: Vec<PlayerState> = st.players.values().cloned().collect();

    for (id, sender) in &st.clients {
        if id == exclude_id {
            continue;
        }
        if let Some(my_state) = st.players.get(id) {
            let mut others = Vec::new();
            for p in &player_list {
                if p.id != *id {
                    others.push(RelativePlayer {
                        id: p.id.clone(),
                        x: p.x - my_state.x,
                        y: p.y - my_state.y,
                    });
                }
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
