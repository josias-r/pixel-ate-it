use crate::models::ClientMove;
use crate::state::SharedState;

pub async fn handle_player_move(state: &SharedState, client_id: &str, client_move: ClientMove) -> bool {
    let mut state_lock = state.lock().await;
    if let Some(player) = state_lock.players.get_mut(client_id) {
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
        any_moved
    } else {
        false
    }
}
