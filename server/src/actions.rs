use crate::models::{ClientMove, EatenMessage};
use crate::state::SharedState;

pub async fn handle_player_move(
    state: &SharedState,
    client_id: &str,
    client_move: ClientMove,
) -> Option<(i32, i32)> {
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
    let mut killed_by = None;

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
        let my_size = crate::state::AppState::get_size(player.score);
        let old_chunks = crate::state::AppState::get_chunks_for_rect(old_x, old_y, my_size);
        let new_chunks = crate::state::AppState::get_chunks_for_rect(player.x, player.y, my_size);

        if old_chunks != new_chunks {
            for chunk in &old_chunks {
                if !new_chunks.contains(chunk) {
                    if let Some(players) = state_lock.grid.get_mut(chunk) {
                        players.remove(client_id);
                        if players.is_empty() {
                            state_lock.grid.remove(chunk);
                        }
                    }
                }
            }
            for chunk in &new_chunks {
                if !old_chunks.contains(chunk) {
                    state_lock
                        .grid
                        .entry(*chunk)
                        .or_default()
                        .insert(client_id.to_string());
                }
            }
        }

        // Eat mechanics
        for chunk in &new_chunks {
            if let Some(chunk_players) = state_lock.grid.get(chunk) {
                // Collect target pids first to avoid double borrowing or iterating while changing
                let chunk_pids: Vec<String> = chunk_players.iter().cloned().collect();
                for pid in chunk_pids {
                    if pid != client_id && !eaten_ids.contains(&pid) {
                        if let Some(other) = state_lock.players.get(&pid) {
                            let other_size = crate::state::AppState::get_size(other.score);
                            let x_overlap = player.x < other.x + other_size && player.x + my_size > other.x;
                            let y_overlap = player.y < other.y + other_size && player.y + my_size > other.y;
                            
                            if x_overlap && y_overlap {
                                if my_size >= other_size {
                                    eaten_ids.push(pid.clone());
                                } else {
                                    killed_by = Some(pid.clone());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(killer_id) = killed_by {
        log::info!("Player {} was eaten by {}", client_id, killer_id);
        
        let my_size = crate::state::AppState::get_size(player.score);
        let current_chunks = crate::state::AppState::get_chunks_for_rect(player.x, player.y, my_size);
        for chunk in current_chunks {
            if let Some(players) = state_lock.grid.get_mut(&chunk) {
                players.remove(client_id);
                if players.is_empty() {
                    state_lock.grid.remove(&chunk);
                }
            }
        }

        if let Some(sender) = state_lock.clients.get(client_id) {
            let msg = EatenMessage {
                msg_type: "eaten".to_string(),
                by_id: killer_id.clone(),
            };
            if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                let _ = sender.send(json_bytes);
            }
        }

        if let Some(mut killer) = state_lock.players.remove(&killer_id) {
             killer.score += player.score + 1;
             state_lock.players.insert(killer_id, killer);
        }

        drop(state_lock);
        crate::state::broadcast_leaderboard_if_changed(state).await;
        
        return Some((old_x, old_y));
    }

    let mut gained_score = 0;
    for pid in &eaten_ids {
        log::info!("Player {} was eaten by {}", pid, client_id);
        
        if let Some(sender) = state_lock.clients.get(pid) {
            let msg = EatenMessage {
                msg_type: "eaten".to_string(),
                by_id: client_id.to_string(),
            };
            if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                let _ = sender.send(json_bytes);
            }
        }

        if let Some(victim) = state_lock.players.remove(pid) {
            gained_score += victim.score + 1;
            let v_size = crate::state::AppState::get_size(victim.score);
            let v_chunks = crate::state::AppState::get_chunks_for_rect(victim.x, victim.y, v_size);
            for chunk in v_chunks {
                if let Some(players) = state_lock.grid.get_mut(&chunk) {
                    players.remove(pid);
                    if players.is_empty() {
                        state_lock.grid.remove(&chunk);
                    }
                }
            }
        }
    }

    if gained_score > 0 {
        player.score += gained_score;
    }

    state_lock.players.insert(client_id.to_string(), player);

    let did_eat = gained_score > 0;
    drop(state_lock);

    if did_eat {
        crate::state::broadcast_leaderboard_if_changed(state).await;
    }

    if any_moved || did_eat {
        Some((old_x, old_y))
    } else {
        None
    }
}
