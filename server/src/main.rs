mod actions;
mod bots;
mod models;
mod network;
mod state;
mod websocket;

use state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let state = Arc::new(Mutex::new(AppState::new()));

    let wt_state = state.clone();
    tokio::spawn(async move {
        if let Err(e) = network::start_webtransport_server(wt_state).await {
            log::error!("WebTransport server error: {}", e);
        }
    });

    let bot_state = state.clone();
    tokio::spawn(async move {
        bots::run_bot_thread(bot_state).await;
    });

    websocket::start_websocket_server(state).await
}
