//! Minimal Stellar RPC client that resolves a contract address to its on-chain
//! WASM bytecode via two `getLedgerEntries` calls (instance -> code).
//!
//! Ported from the soroban-decompiler reference web backend so the portal's
//! Dev Tools "by address" mode matches the decompiler's behavior exactly.

use crate::error::WebError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use stellar_xdr::curr::{
    ContractDataDurability, ContractExecutable, ContractId, Hash, LedgerEntry, LedgerEntryData,
    LedgerKey, LedgerKeyContractCode, LedgerKeyContractData, Limits, ReadXdr, ScAddress,
    ScContractInstance, ScVal, WriteXdr,
};

pub struct RpcClient {
    http: Client,
    rpc_url: String,
}

#[derive(Serialize)]
struct JsonRpcRequest<'a> {
    jsonrpc: &'a str,
    id: u64,
    method: &'a str,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct JsonRpcResponse {
    result: Option<GetLedgerEntriesResult>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct GetLedgerEntriesResult {
    entries: Option<Vec<LedgerEntryResult>>,
}

#[derive(Deserialize)]
struct LedgerEntryResult {
    xdr: String,
}

#[derive(Deserialize)]
struct JsonRpcError {
    message: String,
}

pub struct FetchResult {
    pub wasm: Vec<u8>,
    pub wasm_hash: String,
}

impl RpcClient {
    pub fn new(http: Client, rpc_url: String) -> Self {
        Self { http, rpc_url }
    }

    pub async fn fetch_contract_wasm(&self, address: &str) -> Result<FetchResult, WebError> {
        let contract_id = decode_contract_address(address)?;

        // Step 1: Get the contract instance to find the WASM hash
        let instance_key = LedgerKey::ContractData(LedgerKeyContractData {
            contract: ScAddress::Contract(ContractId(Hash(contract_id))),
            key: ScVal::LedgerKeyContractInstance,
            durability: ContractDataDurability::Persistent,
        });
        let instance_key_b64 = instance_key
            .to_xdr_base64(Limits::none())
            .map_err(|e| WebError::NetworkError(format!("Failed to encode ledger key: {}", e)))?;

        let entry = self.get_ledger_entry(&instance_key_b64).await?;
        let entry_data = decode_ledger_entry_data(&entry)?;

        let wasm_hash = match entry_data {
            LedgerEntryData::ContractData(data) => match data.val {
                ScVal::ContractInstance(ScContractInstance { executable, .. }) => match executable {
                    ContractExecutable::Wasm(hash) => hash,
                    ContractExecutable::StellarAsset => {
                        return Err(WebError::InvalidInput(
                            "This is a Stellar Asset Contract (SAC), not a custom WASM contract"
                                .to_string(),
                        ));
                    }
                },
                _ => {
                    return Err(WebError::NetworkError(
                        "Unexpected contract instance format".to_string(),
                    ));
                }
            },
            _ => {
                return Err(WebError::NetworkError(
                    "Unexpected ledger entry type".to_string(),
                ));
            }
        };

        let hash_hex = hex_encode(&wasm_hash.0);

        // Step 2: Fetch the actual WASM bytecode using the hash
        let code_key = LedgerKey::ContractCode(LedgerKeyContractCode {
            hash: wasm_hash.clone(),
        });
        let code_key_b64 = code_key
            .to_xdr_base64(Limits::none())
            .map_err(|e| WebError::NetworkError(format!("Failed to encode code key: {}", e)))?;

        let code_entry_xdr = self.get_ledger_entry(&code_key_b64).await?;
        let code_entry_data = decode_ledger_entry_data(&code_entry_xdr)?;

        let wasm_bytes = match code_entry_data {
            LedgerEntryData::ContractCode(code) => code.code.to_vec(),
            _ => {
                return Err(WebError::NetworkError(
                    "Unexpected ledger entry type for code".to_string(),
                ));
            }
        };

        Ok(FetchResult {
            wasm: wasm_bytes,
            wasm_hash: hash_hex,
        })
    }

    async fn get_ledger_entry(&self, key_b64: &str) -> Result<String, WebError> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "getLedgerEntries",
            params: serde_json::json!({ "keys": [key_b64] }),
        };

        let resp = self
            .http
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| WebError::NetworkError(format!("RPC request failed: {}", e)))?;

        if !resp.status().is_success() {
            return Err(WebError::NetworkError(format!(
                "RPC returned HTTP {}",
                resp.status()
            )));
        }

        let body: JsonRpcResponse = resp
            .json()
            .await
            .map_err(|e| WebError::NetworkError(format!("Failed to parse RPC response: {}", e)))?;

        if let Some(err) = body.error {
            return Err(WebError::NetworkError(format!("RPC error: {}", err.message)));
        }

        let entries = body
            .result
            .and_then(|r| r.entries)
            .ok_or_else(|| WebError::NetworkError("Contract not found on-chain".to_string()))?;

        if entries.is_empty() {
            return Err(WebError::NetworkError(
                "Contract not found on-chain".to_string(),
            ));
        }

        Ok(entries[0].xdr.clone())
    }
}

/// Decode the `xdr` field of a `getLedgerEntries` result entry into a
/// `LedgerEntryData`. Soroban RPC returns the raw `LedgerEntryData`, but some
/// providers/versions wrap it in a full `LedgerEntry`; accept both.
fn decode_ledger_entry_data(xdr_b64: &str) -> Result<LedgerEntryData, WebError> {
    if let Ok(data) = LedgerEntryData::from_xdr_base64(xdr_b64, Limits::none()) {
        return Ok(data);
    }
    let entry = LedgerEntry::from_xdr_base64(xdr_b64, Limits::none())?;
    Ok(entry.data)
}

/// Decode a Stellar contract address (C...) to 32-byte contract ID.
///
/// Strkey format: base32(version_byte + 32_byte_payload + 2_byte_crc16)
/// Contract version byte: 2 << 3 = 16
fn decode_contract_address(address: &str) -> Result<[u8; 32], WebError> {
    if address.len() != 56 || !address.starts_with('C') {
        return Err(WebError::InvalidInput(
            "Invalid contract address: must be 56 characters starting with 'C'".to_string(),
        ));
    }

    let decoded = base32_decode(address)
        .map_err(|e| WebError::InvalidInput(format!("Invalid contract address encoding: {}", e)))?;

    if decoded.len() != 35 {
        return Err(WebError::InvalidInput(
            "Invalid contract address: wrong decoded length".to_string(),
        ));
    }

    let version = decoded[0];
    if version != 16 {
        // 2 << 3
        return Err(WebError::InvalidInput(format!(
            "Invalid contract address: expected version byte 16 (contract), got {}",
            version
        )));
    }

    let payload_end = decoded.len() - 2;
    let expected_crc = crc16_xmodem(&decoded[..payload_end]);
    let actual_crc = u16::from_le_bytes([decoded[payload_end], decoded[payload_end + 1]]);
    if actual_crc != expected_crc {
        return Err(WebError::InvalidInput(
            "Invalid contract address: checksum mismatch".to_string(),
        ));
    }

    let mut contract_id = [0u8; 32];
    contract_id.copy_from_slice(&decoded[1..33]);
    Ok(contract_id)
}

/// Minimal base32 decoder (RFC 4648, no padding).
fn base32_decode(input: &str) -> Result<Vec<u8>, &'static str> {
    fn char_value(c: u8) -> Result<u8, &'static str> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'2'..=b'7' => Ok(c - b'2' + 26),
            b'=' => Ok(0), // padding
            _ => Err("invalid base32 character"),
        }
    }

    let bytes = input.as_bytes();
    let mut result = Vec::with_capacity(bytes.len() * 5 / 8);
    let mut buffer: u64 = 0;
    let mut bits: u32 = 0;

    for &c in bytes {
        if c == b'=' {
            break;
        }
        buffer = (buffer << 5) | char_value(c)? as u64;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            result.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }

    Ok(result)
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn crc16_xmodem(data: &[u8]) -> u16 {
    let mut crc = 0u16;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if (crc & 0x8000) != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

#[cfg(test)]
mod tests {
    use super::decode_contract_address;

    #[test]
    fn decode_contract_address_rejects_bad_checksum() {
        let mut invalid = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC".to_string();
        invalid.replace_range(invalid.len() - 1.., "D");

        let err =
            decode_contract_address(&invalid).expect_err("expected checksum validation failure");

        match err {
            crate::error::WebError::InvalidInput(msg) => {
                assert!(msg.contains("checksum mismatch"));
            }
            other => panic!("unexpected error: {:?}", other),
        }
    }
}
