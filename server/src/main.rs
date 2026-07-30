mod models;
mod state;
mod actions;
mod network;

use state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    
    let state = Arc::new(Mutex::new(AppState::new()));

    network::start_server(state).await
}
