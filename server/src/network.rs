use crate::models::{ClientMove, PlayerState};
use crate::state::{broadcast_update, broadcast_update_except, SharedState};
use crate::actions::handle_player_move;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;
use wtransport::endpoint::Endpoint;
use wtransport::tls::Identity;
use wtransport::ServerConfig;

pub async fn start_server(state: SharedState) -> anyhow::Result<()> {
    // Generate self-signed certificate for WebTransport
    // We use serverCertificateHashes in the frontend so this is fully secure in prod
    let identity = Identity::self_signed(["localhost", "127.0.0.1", "::1"]).unwrap();
    let cert = identity.certificate_chain().as_slice()[0].clone();
    let hash = cert.hash();
    
    // Convert the hash into a hex string
    let hash_hex: String = hash.as_ref().iter().map(|b| format!("{:02x}", b)).collect();
    println!("Server cert hash: {}", hash_hex);

    // Write the hash directly to a file that the frontend can import (or a txt file for Docker)
    let hash_path = std::env::var("CERT_HASH_PATH").unwrap_or_else(|_| "../app/src/cert_hash.ts".to_string());
    let content = if hash_path.ends_with(".ts") {
        format!("export const hexHash = \"{}\";\n", hash_hex)
    } else {
        hash_hex.clone()
    };
    if let Err(e) = std::fs::write(&hash_path, content) {
        println!("Warning: Could not write cert_hash to {}: {}", hash_path, e);
    }

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string()).parse().unwrap_or(3000);
    let config = ServerConfig::builder()
        .with_bind_default(port)
        .with_identity(identity)
        .max_idle_timeout(Some(std::time::Duration::from_secs(10))).unwrap()
        .keep_alive_interval(Some(std::time::Duration::from_secs(4)))
        .build();

    let endpoint = Endpoint::server(config)?;
    println!("WebTransport server listening on port {}", port);

    loop {
        let incoming_session = endpoint.accept().await;
        let state_clone = state.clone();
        tokio::spawn(async move {
            if let Ok(session_request) = incoming_session.await {
                if let Ok(connection) = session_request.accept().await {
                    if let Err(e) = handle_session(connection, state_clone).await {
                        println!("Session error: {}", e);
                    }
                }
            }
        });
    }
}

async fn handle_session(connection: wtransport::Connection, state: SharedState) -> anyhow::Result<()> {
    let client_id = Uuid::new_v4().to_string();
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Register client
    {
        let mut st = state.lock().await;
        st.clients.insert(client_id.clone(), tx);
        st.players.insert(
            client_id.clone(),
            PlayerState {
                id: client_id.clone(),
                x: 0,
                y: 0,
                last_seq: 0,
            },
        );
    }
    
    println!("Client {} connected", client_id);
    
    // Broadcast initial state
    broadcast_update(&state).await;

    let connection = Arc::new(connection);
    let connection_send = connection.clone();
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if connection_send.send_datagram(&msg).is_err() {
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
                    let moved = handle_player_move(&st_clone, &cid_clone, client_move).await;
                    if moved {
                        broadcast_update_except(&st_clone, &cid_clone).await;
                    }
                } else {
                    println!("Failed to parse ClientMove from payload: {:?}", std::str::from_utf8(&payload_vec));
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

    println!("Client {} disconnected", client_id);
    {
        let mut st = state.lock().await;
        st.clients.remove(&client_id);
        st.players.remove(&client_id);
    }
    broadcast_update(&state).await;
    Ok(())
}
