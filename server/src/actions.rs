use crate::models::{ClientMove, EatenMessage};
use crate::state::SharedState;

pub async fn handle_player_move(state: &SharedState, client_id: &str, client_move: ClientMove) -> Option<(i32, i32)> {
    let mut state_lock = state.lock().await;
    
    // Extract the player to modify it without holding a mutable reference to `players`
    let mut player = if let Some(p) = state_lock.players.remove(client_id) {
        p
    } else {
        return None;
    };

    let old_x = player.x;
    let old_y = player.y;
    let mut any_moved = false;
    let mut eaten_ids = Vec::new();

    for m in client_move.moves {
        if m.seq > player.last_seq {
            match m.direction.as_str() {
                "up" => player.y -= 1,
                "down" => player.y += 1,
                "left" => player.x -= 1,
                "right" => player.x += 1,
                _ => {}
            }
            player.last_seq = m.seq;
            any_moved = true;
        }
    }

    if any_moved {
        let (old_chunk_x, old_chunk_y) = crate::state::AppState::get_chunk(old_x, old_y);
        let (new_chunk_x, new_chunk_y) = crate::state::AppState::get_chunk(player.x, player.y);

        if old_chunk_x != new_chunk_x || old_chunk_y != new_chunk_y {
            // Remove from old chunk
            if let Some(players) = state_lock.grid.get_mut(&(old_chunk_x, old_chunk_y)) {
                players.remove(client_id);
                if players.is_empty() {
                    state_lock.grid.remove(&(old_chunk_x, old_chunk_y));
                }
            }

            // Add to new chunk
            state_lock.grid.entry((new_chunk_x, new_chunk_y)).or_default().insert(client_id.to_string());
        }

        // Eat mechanics
        if let Some(chunk_players) = state_lock.grid.get(&(new_chunk_x, new_chunk_y)) {
            for pid in chunk_players {
                if pid != client_id {
                    if let Some(other) = state_lock.players.get(pid) {
                        if other.x == player.x && other.y == player.y {
                            eaten_ids.push(pid.clone());
                        }
                    }
                }
            }
        }
        
        for pid in &eaten_ids {
            log::info!("Player {} was eaten by {}", pid, client_id);
            // Send 'eaten' message
            if let Some(sender) = state_lock.clients.get(pid) {
                let msg = EatenMessage {
                    msg_type: "eaten".to_string(),
                    by_id: client_id.to_string(),
                };
                if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                    let _ = sender.send(json_bytes);
                }
            }
            
            // Remove victim from game state (they become a ghost with no player entity)
            if let Some(victim) = state_lock.players.remove(pid) {
                let v_chunk = crate::state::AppState::get_chunk(victim.x, victim.y);
                if let Some(players) = state_lock.grid.get_mut(&v_chunk) {
                    players.remove(pid);
                    if players.is_empty() {
                        state_lock.grid.remove(&v_chunk);
                    }
                }
            }
        }
        
        let did_eat = !eaten_ids.is_empty();
        if did_eat {
            player.score += eaten_ids.len() as u32;
        }
    }

    // Put the player back
    state_lock.players.insert(client_id.to_string(), player);
    
    let did_eat = if any_moved { !eaten_ids.is_empty() } else { false };
    
    drop(state_lock);

    if did_eat {
        crate::state::broadcast_leaderboard(state).await;
    }

    if any_moved {
        Some((old_x, old_y))
    } else {
        None
    }
}
