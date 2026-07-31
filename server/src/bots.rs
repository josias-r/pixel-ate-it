use crate::actions::handle_player_move;
use crate::models::{ClientMove, MoveItem, PlayerState};
use crate::state::{SharedState, broadcast_update_nearby};
use std::time::Duration;
use uuid::Uuid;

pub async fn run_bot_thread(state: SharedState) {
    let mut interval = tokio::time::interval(Duration::from_secs(1));
    let mut bots: Vec<String> = Vec::new();
    let mut bot_seqs = std::collections::HashMap::<String, u32>::new();

    loop {
        interval.tick().await;

        let mut st = state.lock().await;
        let num_clients = st.clients.len();

        // Remove bots that were eaten from our local list
        bots.retain(|bot_id| st.players.contains_key(bot_id));

        let mut needed_bots = num_clients as i32 - bots.len() as i32;

        // spawn needed bots
        while needed_bots > 0 {
            let bot_id = format!("bot-{}", Uuid::new_v4());

            // simple spawn logic
            let active_chunks: Vec<_> = st.grid.keys().cloned().collect();
            let mut spawn_x = 0;
            let mut spawn_y = 0;

            // use a simple pseudo-random based on time if rand is not available
            let t = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_micros() as usize;
            if !active_chunks.is_empty() {
                let &(cx, cy) = &active_chunks[t % active_chunks.len()];
                spawn_x =
                    cx * crate::state::CHUNK_SIZE + (t % crate::state::CHUNK_SIZE as usize) as i32;
                spawn_y = cy * crate::state::CHUNK_SIZE
                    + ((t / 2) % crate::state::CHUNK_SIZE as usize) as i32;
            }

            st.players.insert(
                bot_id.clone(),
                PlayerState {
                    id: bot_id.clone(),
                    x: spawn_x,
                    y: spawn_y,
                    color: "#888888".to_string(), // Gray color for bots
                    last_seq: 0,
                    score: 0,
                },
            );
            st.insert_to_grid(bot_id.clone(), spawn_x, spawn_y, 0);
            bots.push(bot_id.clone());
            bot_seqs.insert(bot_id.clone(), 0);
            needed_bots -= 1;
        }

        while needed_bots < 0 {
            if let Some(bot_id) = bots.pop() {
                if let Some(p) = st.players.remove(&bot_id) {
                    st.remove_from_grid(&bot_id, p.x, p.y, p.score);
                    bot_seqs.remove(&bot_id);
                }
            }
            needed_bots += 1;
        }

        // drop lock before moving them, because handle_player_move locks state
        drop(st);

        for bot_id in &bots {
            let seq = bot_seqs.get(bot_id).unwrap_or(&0) + 1;
            bot_seqs.insert(bot_id.clone(), seq);

            let t = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos() as usize;
            let id_hash = bot_id.as_bytes().iter().map(|&b| b as usize).sum::<usize>();
            let hash = id_hash.wrapping_add(t).wrapping_add(seq as usize);
            let dir = match hash % 4 {
                0 => "up",
                1 => "down",
                2 => "left",
                _ => "right",
            }
            .to_string();

            let client_move = ClientMove {
                moves: vec![MoveItem {
                    direction: dir,
                    seq,
                }],
            };

            if let Some((old_x, old_y)) = handle_player_move(&state, bot_id, client_move).await {
                let (new_x, new_y) = {
                    let st = state.lock().await;
                    if let Some(p) = st.players.get(bot_id) {
                        (p.x, p.y)
                    } else {
                        (old_x, old_y)
                    }
                };
                broadcast_update_nearby(&state, new_x, new_y, Some((old_x, old_y)), bot_id).await;
            }
        }
    }
}
