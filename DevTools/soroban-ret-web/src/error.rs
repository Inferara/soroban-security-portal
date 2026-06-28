use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

/// Errors surfaced by the Dev Tools backend. Each maps to an HTTP status and a
/// stable machine-readable `kind` so the portal UI can render targeted messages.
#[derive(Debug)]
#[allow(dead_code)]
pub enum WebError {
    InvalidInput(String),
    DecompileError(String),
    NetworkError(String),
    CompileError(String),
    NotConfigured(String),
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
    kind: &'static str,
}

impl IntoResponse for WebError {
    fn into_response(self) -> Response {
        let (status, kind, message) = match self {
            WebError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, "invalid_input", msg),
            WebError::DecompileError(msg) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "decompile_error", msg)
            }
            WebError::NetworkError(msg) => (StatusCode::BAD_GATEWAY, "network_error", msg),
            WebError::CompileError(msg) => (StatusCode::UNPROCESSABLE_ENTITY, "compile_error", msg),
            WebError::NotConfigured(msg) => {
                (StatusCode::SERVICE_UNAVAILABLE, "not_configured", msg)
            }
        };
        let body = ErrorBody {
            error: message,
            kind,
        };
        (status, axum::Json(body)).into_response()
    }
}

impl From<soroban_ret::DecompileError> for WebError {
    fn from(e: soroban_ret::DecompileError) -> Self {
        WebError::DecompileError(e.to_string())
    }
}

impl From<reqwest::Error> for WebError {
    fn from(e: reqwest::Error) -> Self {
        WebError::NetworkError(e.to_string())
    }
}

impl From<stellar_xdr::curr::Error> for WebError {
    fn from(e: stellar_xdr::curr::Error) -> Self {
        WebError::NetworkError(format!("XDR error: {}", e))
    }
}
