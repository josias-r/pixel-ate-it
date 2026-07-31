use crate::actions::handle_player_move;
use crate::models::{ClientMove, PlayerState};
use crate::state::{SharedState, broadcast_update_nearby, send_update_to_client};
use futures::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::protocol::Message;
use uuid::Uuid;

pub async fn start_websocket_server(state: SharedState) -> anyhow::Result<()> {
    let port: u16 = std::env::var("WS_PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .unwrap_or(3001);

    let listener = TcpListener::bind(("0.0.0.0", port)).await?;
    log::info!("WebSocket server listening on port {}", port);

    while let Ok((stream, _)) = listener.accept().await {
        let state_clone = state.clone();
        tokio::spawn(async move {
            let mut extracted_color = "#ff00aa".to_string();

            let callback = |req: &Request, response: Response| {
                let uri = req.uri().to_string();
                if let Some(idx) = uri.find("color=") {
                    let extracted = &uri[idx + 6..];
                    let decoded = urlencoding::decode(extracted)
                        .unwrap_or(std::borrow::Cow::Borrowed("#ff00aa"))
                        .into_owned();
                    if decoded.starts_with('#') {
                        extracted_color = decoded;
                    } else {
                        extracted_color = format!("#{}", decoded);
                    }
                }
                Ok(response)
            };

            if let Ok(ws_stream) = tokio_tungstenite::accept_hdr_async(stream, callback).await {
                if let Err(e) = handle_ws_session(ws_stream, state_clone, extracted_color).await {
                    log::error!("WS Session error: {}", e);
                }
            }
        });
    }

    Ok(())
}

async fn handle_ws_session(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    state: SharedState,
    my_color: String,
) -> anyhow::Result<()> {
    let client_id = Uuid::new_v4().to_string();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Register client
    let spawn_pos;
    {
        let mut st = state.lock().await;

        let active_chunks: Vec<_> = st.grid.keys().cloned().collect();
        let mut spawn_x = 0;
        let mut spawn_y = 0;

        if !active_chunks.is_empty() {
            let t = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_micros() as usize;
            let &(cx, cy) = &active_chunks[t % active_chunks.len()];

            let dx = ((t / 3) % 3) as i32 - 1;
            let dy = ((t / 7) % 3) as i32 - 1;

            let px = ((t / 11) % crate::state::CHUNK_SIZE as usize) as i32;
            let py = ((t / 13) % crate::state::CHUNK_SIZE as usize) as i32;

            spawn_x = (cx + dx) * crate::state::CHUNK_SIZE + px;
            spawn_y = (cy + dy) * crate::state::CHUNK_SIZE + py;
        }

        spawn_pos = (spawn_x, spawn_y);

        st.clients.insert(client_id.clone(), tx);
        st.players.insert(
            client_id.clone(),
            PlayerState {
                id: client_id.clone(),
                x: spawn_x,
                y: spawn_y,
                color: my_color,
                last_seq: 0,
                score: 0,
            },
        );
        st.insert_to_grid(client_id.clone(), spawn_x, spawn_y, 0);
    }

    log::debug!("WS Client {} connected", client_id);

    broadcast_update_nearby(&state, spawn_pos.0, spawn_pos.1, None, "").await;
    send_update_to_client(&state, &client_id).await;
    crate::state::send_leaderboard_to_client(&state, &client_id).await;
    crate::state::broadcast_leaderboard_if_changed(&state).await;

    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Binary(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let client_id_clone = client_id.clone();
    let state_clone = state.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let Message::Binary(payload_vec) = msg {
                if let Ok(client_move) = serde_json::from_slice::<ClientMove>(&payload_vec) {
                    if let Some((old_x, old_y)) =
                        handle_player_move(&state_clone, &client_id_clone, client_move).await
                    {
                        send_update_to_client(&state_clone, &client_id_clone).await;

                        let (new_x, new_y) = {
                            let st = state_clone.lock().await;
                            if let Some(p) = st.players.get(&client_id_clone) {
                                (p.x, p.y)
                            } else {
                                (old_x, old_y)
                            }
                        };
                        broadcast_update_nearby(
                            &state_clone,
                            new_x,
                            new_y,
                            Some((old_x, old_y)),
                            &client_id_clone,
                        )
                        .await;
                    }
                }
            } else if let Message::Text(_) = msg {
                // Ignore text messages, we expect binary JSON payload to match WebTransport exactly
            }
        }
    });

    // If any task exits, abort the other
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    log::debug!("WS Client {} disconnected", client_id);
    let mut last_pos = None;
    {
        let mut st = state.lock().await;
        st.clients.remove(&client_id);
        if let Some(p) = st.players.remove(&client_id) {
            st.remove_from_grid(&client_id, p.x, p.y, p.score);
            last_pos = Some((p.x, p.y));
        }
    }
    if let Some((x, y)) = last_pos {
        broadcast_update_nearby(&state, x, y, None, &client_id).await;
    }
    crate::state::broadcast_leaderboard_if_changed(&state).await;
    Ok(())
}
