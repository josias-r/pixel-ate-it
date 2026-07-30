use std::{collections::HashMap, sync::Arc};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
use wtransport::endpoint::Endpoint;
use wtransport::tls::Identity;
use wtransport::ServerConfig;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
struct PlayerState {
    id: String,
    x: i32,
    y: i32,
}

#[derive(Debug, Deserialize)]
struct ClientMove {
    #[serde(rename = "move")]
    direction: String, // "up", "down", "left", "right"
}

#[derive(Debug, Serialize)]
struct ServerUpdate {
    #[serde(rename = "type")]
    msg_type: String, // "update"
    others: Vec<RelativePlayer>,
}

#[derive(Debug, Serialize)]
struct RelativePlayer {
    id: String,
    x: i32,
    y: i32,
}

type ClientSender = mpsc::UnboundedSender<Vec<u8>>;

struct AppState {
    players: HashMap<String, PlayerState>,
    clients: HashMap<String, ClientSender>,
}

impl AppState {
    fn new() -> Self {
        Self {
            players: HashMap::new(),
            clients: HashMap::new(),
        }
    }
}

type SharedState = Arc<Mutex<AppState>>;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let state = Arc::new(Mutex::new(AppState::new()));

    // Generate or load certificate for WebTransport
    let cert_path = std::env::var("TLS_CERT_PATH").unwrap_or_default();
    let key_path = std::env::var("TLS_KEY_PATH").unwrap_or_default();

    let identity = if !cert_path.is_empty() && !key_path.is_empty() {
        println!("Loading TLS certificates from {} and {}", cert_path, key_path);
        // Load the certificates from the provided paths
        // We read the files directly. If they fail, we panic to make it clear.
        let cert_chain = std::fs::read(&cert_path).expect("Failed to read TLS_CERT_PATH");
        let private_key = std::fs::read(&key_path).expect("Failed to read TLS_KEY_PATH");
        
        let identity = Identity::load_pem(&cert_chain, &private_key)
            .expect("Failed to parse PEM files into Identity");
        
        identity
    } else {
        println!("No TLS_CERT_PATH/TLS_KEY_PATH provided, using ephemeral self-signed cert.");
        Identity::self_signed(["localhost", "127.0.0.1", "::1"]).unwrap()
    };
    
    let cert = identity.certificate_chain().as_slice()[0].clone();
    let hash = cert.hash();
    
    // Convert the hash into a hex string
    let hash_hex: String = hash.as_ref().iter().map(|b| format!("{:02x}", b)).collect();
    println!("Server cert hash: {}", hash_hex);

    // Write the hash directly to a file that the frontend can import!
    let ts_content = format!("export const hexHash = \"{}\";\n", hash_hex);
    if let Err(e) = std::fs::write("../app/src/cert_hash.ts", ts_content) {
        println!("Warning: Could not write cert_hash.ts to frontend: {}", e);
    }

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string()).parse().unwrap_or(3000);
    let config = ServerConfig::builder()
        .with_bind_default(port)
        .with_identity(identity)
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

    let client_id_clone = client_id.clone();
    let state_clone = state.clone();
    
    let connection_recv = connection.clone();
    let mut recv_task = tokio::spawn(async move {
        loop {
            match connection_recv.receive_datagram().await {
                Ok(datagram) => {
                    let payload = datagram.payload();
                    if let Ok(client_move) = serde_json::from_slice::<ClientMove>(payload.as_ref()) {
                        let moved = {
                            let mut st = state_clone.lock().await;
                            if let Some(player) = st.players.get_mut(&client_id_clone) {
                                match client_move.direction.as_str() {
                                    "up" => player.y -= 1,
                                    "down" => player.y += 1,
                                    "left" => player.x -= 1,
                                    "right" => player.x += 1,
                                    _ => {}
                                }
                                true
                            } else {
                                false
                            }
                        };
                        
                        if moved {
                            broadcast_update_except(&state_clone, &client_id_clone).await;
                        }
                    }
                }
                Err(_) => break, // Connection closed or error
            }
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

async fn broadcast_update(state: &SharedState) {
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
                others,
            };
            if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                let _ = sender.send(json_bytes);
            }
        }
    }
}

async fn broadcast_update_except(state: &SharedState, exclude_id: &str) {
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
                others,
            };
            if let Ok(json_bytes) = serde_json::to_vec(&msg) {
                let _ = sender.send(json_bytes);
            }
        }
    }
}
