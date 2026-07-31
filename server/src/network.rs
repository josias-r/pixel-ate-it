use crate::models::{ClientMove, PlayerState};
use crate::state::{send_update_to_client, broadcast_update_nearby, SharedState};
use crate::actions::handle_player_move;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;
use wtransport::endpoint::Endpoint;
use wtransport::tls::Identity;
use wtransport::ServerConfig;

pub async fn start_webtransport_server(state: SharedState) -> anyhow::Result<()> {
    // Generate self-signed certificate for WebTransport
    // We use serverCertificateHashes in the frontend so this is fully secure in prod
    let identity = Identity::self_signed(["localhost", "127.0.0.1", "::1"]).unwrap();
    let cert = identity.certificate_chain().as_slice()[0].clone();
    let hash = cert.hash();
    
    // Convert the hash into a hex string
    let hash_hex: String = hash.as_ref().iter().map(|b| format!("{:02x}", b)).collect();
    log::info!("Server cert hash: {}", hash_hex);

    // Write the hash directly to a file that the frontend can import (or a txt file for Docker)
    let hash_path = std::env::var("CERT_HASH_PATH").unwrap_or_else(|_| "../app/src/cert_hash.ts".to_string());
    let content = if hash_path.ends_with(".ts") {
        format!("export const hexHash = \"{}\";\n", hash_hex)
    } else {
        hash_hex.clone()
    };
    if let Err(e) = std::fs::write(&hash_path, content) {
        log::warn!("Could not write cert_hash to {}: {}", hash_path, e);
    }

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string()).parse().unwrap_or(3000);
    let config = ServerConfig::builder()
        .with_bind_default(port)
        .with_identity(identity)
        .max_idle_timeout(Some(std::time::Duration::from_secs(10))).unwrap()
        .keep_alive_interval(Some(std::time::Duration::from_secs(4)))
        .build();

    let endpoint = Endpoint::server(config)?;
    log::info!("WebTransport server listening on port {}", port);

    loop {
        let incoming_session = endpoint.accept().await;
        let state_clone = state.clone();
        tokio::spawn(async move {
            if let Ok(session_request) = incoming_session.await {
                // Extract color from path, e.g., /?color=%23ff00aa or /?color=ff00aa
                let path = session_request.path().to_string();
                let mut color = "#ff00aa".to_string(); // fallback
                if let Some(idx) = path.find("color=") {
                    let extracted = &path[idx + 6..];
                    let decoded = urlencoding::decode(extracted).unwrap_or(std::borrow::Cow::Borrowed("#ff00aa")).into_owned();
                    if decoded.starts_with('#') {
                        color = decoded;
                    } else {
                        color = format!("#{}", decoded);
                    }
                }

                if let Ok(connection) = session_request.accept().await {
                    if let Err(e) = handle_session(connection, state_clone, color).await {
                        log::error!("Session error: {}", e);
                    }
                }
            }
        });
    }
}

async fn handle_session(connection: wtransport::Connection, state: SharedState, my_color: String) -> anyhow::Result<()> {
    let client_id = Uuid::new_v4().to_string();
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Register client
    let spawn_pos;
    {
        let mut st = state.lock().await;
        
        // Find a random active chunk
        let active_chunks: Vec<_> = st.grid.keys().cloned().collect();
        let mut spawn_x = 0;
        let mut spawn_y = 0;
        
        if !active_chunks.is_empty() {
            // Unsafe to use rand directly without adding it to dependencies.
            // Let's use a very simple pseudo-random approach based on time or client_id hash, 
            // or just pick the first chunk to avoid adding new crates.
            // Wait, we can use the time!
            let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_micros() as usize;
            let &(cx, cy) = &active_chunks[t % active_chunks.len()];
            
            // neighbor offset
            let dx = ((t / 3) % 3) as i32 - 1;
            let dy = ((t / 7) % 3) as i32 - 1;
            
            // pixel inside chunk
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
            },
        );
        st.insert_to_grid(client_id.clone(), spawn_x, spawn_y);
    }
    
    log::debug!("Client {} connected", client_id);
    
    // Broadcast initial state to nearby players only
    broadcast_update_nearby(&state, spawn_pos.0, spawn_pos.1, None, "").await;
    // And send an update to the newly connected client
    send_update_to_client(&state, &client_id).await;

    let connection = Arc::new(connection);
    let connection_send = connection.clone();
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Ok(opening) = connection_send.open_uni().await {
                if let Ok(mut stream) = opening.await {
                    if let Err(e) = stream.write_all(&msg).await {
                        log::error!("Failed to write to stream: {}", e);
                        break;
                    }
                    if let Err(e) = stream.finish().await {
                        log::error!("Failed to finish stream: {}", e);
                        break;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    });

    let connection_recv = connection.clone();
    let client_id_clone = client_id.clone();
    let state_clone = state.clone();

    let mut recv_task = tokio::spawn(async move {
        let handle_payload = |payload: &[u8], st: &SharedState, cid: &str| -> core::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> {
            let payload_vec = payload.to_vec();
            let st_clone = st.clone();
            let cid_clone = cid.to_string();
            Box::pin(async move {
                if let Ok(client_move) = serde_json::from_slice::<ClientMove>(&payload_vec) {
                    if let Some((old_x, old_y)) = handle_player_move(&st_clone, &cid_clone, client_move).await {
                        // send update to client itself to ack its moves and give it the new surroundings
                        send_update_to_client(&st_clone, &cid_clone).await;
                        
                        let (new_x, new_y) = {
                            let st = st_clone.lock().await;
                            if let Some(p) = st.players.get(&cid_clone) {
                                (p.x, p.y)
                            } else {
                                (old_x, old_y)
                            }
                        };
                        // broadcast to nearby clients
                        broadcast_update_nearby(&st_clone, new_x, new_y, Some((old_x, old_y)), &cid_clone).await;
                    }
                } else {
                    log::warn!("Failed to parse ClientMove from payload: {:?}", std::str::from_utf8(&payload_vec));
                }
            })
        };

        let datagram_fut = async {
            loop {
                match connection_recv.receive_datagram().await {
                    Ok(datagram) => {
                        handle_payload(datagram.payload().as_ref(), &state_clone, &client_id_clone).await;
                    }
                    Err(_) => break,
                }
            }
        };

        let stream_fut = async {
            loop {
                match connection_recv.accept_uni().await {
                    Ok(mut stream) => {
                        let st_clone = state_clone.clone();
                        let cid_clone = client_id_clone.clone();
                        tokio::spawn(async move {
                            let mut buf = Vec::new();
                            let mut chunk = [0u8; 1024];
                            // Wait, reading to end of stream
                            while let Ok(Some(bytes_read)) = stream.read(&mut chunk).await {
                                buf.extend_from_slice(&chunk[..bytes_read]);
                            }
                            handle_payload(&buf, &st_clone, &cid_clone).await;
                        });
                    }
                    Err(_) => break,
                }
            }
        };

        tokio::select! {
            _ = datagram_fut => {}
            _ = stream_fut => {}
        }
    });

    // If any task exits, abort the other
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    log::debug!("Client {} disconnected", client_id);
    let mut last_pos = None;
    {
        let mut st = state.lock().await;
        st.clients.remove(&client_id);
        if let Some(p) = st.players.remove(&client_id) {
            st.remove_from_grid(&client_id, p.x, p.y);
            last_pos = Some((p.x, p.y));
        }
    }
    if let Some((x, y)) = last_pos {
        broadcast_update_nearby(&state, x, y, None, &client_id).await;
    }
    Ok(())
}
