mod models;
mod state;
mod actions;
mod network;

use state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let state = Arc::new(Mutex::new(AppState::new()));

    // Add heartbeat broadcast loop to ensure eventual consistency
    // even if datagrams are dropped or clients desync
    let state_for_ticker = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(100));
        loop {
            interval.tick().await;
            state::broadcast_update(&state_for_ticker).await;
        }
    });

    network::start_server(state).await
}
