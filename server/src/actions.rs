use crate::models::ClientMove;
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
    }

    // Put the player back
    state_lock.players.insert(client_id.to_string(), player);

    if any_moved {
        Some((old_x, old_y))
    } else {
        None
    }
}
