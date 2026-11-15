using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // ---- what the public surface returns ------------------------------------------------------

    public class RetVersionsResult
    {
        // The soroban-ret version the server runs by default.
        public string Current { get; set; } = "";
        public List<string> Available { get; set; } = new();
    }

    public class RetParam
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
    }

    public class RetFunction
    {
        public string Name { get; set; } = "";
        public List<RetParam> Params { get; set; } = new();
        public string? ReturnType { get; set; }
        public bool IsConstructor { get; set; }
        // False when soroban-ret could only recover the signature, not the body.
        public bool BodyRecovered { get; set; }
        // 1-based line of the function in `source`.
        public int? Line { get; set; }
    }

    public class RetType
    {
        public string Name { get; set; } = "";
        public string Kind { get; set; } = "";
        public int? Line { get; set; }
    }

    public class RetDecompileResult
    {
        // Rust recovered by soroban-ret. An approximation of the original source, not the source itself.
        public string Source { get; set; } = "";
        public bool SourceTruncated { get; set; }
        // WebAssembly text format. Only present when asked for; it is long.
        public string? Wat { get; set; }
        public bool? WatTruncated { get; set; }
        public string? Network { get; set; }
        public string? Address { get; set; }
        // Hash of the contract code on the network (by-address calls only).
        public string? WasmHash { get; set; }
        // SHA-256 of the module that was decompiled.
        public string WasmSha256 { get; set; } = "";
        public int WasmSize { get; set; }
        public bool IsSoroban { get; set; }
        public string? SdkVersion { get; set; }
        public List<string> StandardInterfaces { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<RetFunction> Functions { get; set; } = new();
        public List<RetType> Types { get; set; } = new();
        // The soroban-ret version that produced `source`.
        public string EngineVersion { get; set; } = "";
        public long ElapsedMs { get; set; }
    }

    // Thrown when the decompiler cannot be used right now (down, busy, timed out, the node could
    // not be reached). The message is shown to the caller, so it must not leak internals.
    public class PublicApiUnavailableException : Exception
    {
        public PublicApiUnavailableException(string message) : base(message) { }

        // False when nothing was done for the caller (the decompiler was busy), so their allowance is
        // not used up. True for a call that ran for a while and failed or timed out.
        public bool ChargesAllowance { get; init; } = true;
    }

    // ---- the client of soroban-ret-web -----------------------------------------------------------

    // What soroban-ret-web returned, reduced to what we pass on (it also sends the module itself
    // twice, as hex and base64, which we drop).
    public sealed record RetDisassembly(
        string Source, string Wat, int WasmSize, string? WasmHash, string? SdkVersion, bool IsSoroban,
        List<string> StandardInterfaces, List<string> Warnings, List<RetFunction> Functions, List<RetType> Types,
        string EngineVersion, long ElapsedMs);

    // The token is the caller's (their request being aborted); it stops the work and frees the slot.
    public interface ISorobanRetClient
    {
        Task<RetVersionsResult> GetVersionsAsync(CancellationToken cancellationToken);
        Task<RetDisassembly> DisassembleAddressAsync(string address, string network, string? version, CancellationToken cancellationToken);
        Task<RetDisassembly> DisassembleWasmAsync(byte[] wasm, string? version, CancellationToken cancellationToken);
    }

    // Calls the Dev Tools backend (soroban-ret-web) that already runs next to the portal. Only the
    // read-only decompile endpoints are used: never /compile, which runs user code on the server.
    public partial class SorobanRetClient : ISorobanRetClient
    {
        // The messages soroban-ret-web builds for a contract the node cannot give us, free of addresses.
        [GeneratedRegex("^(Contract not found on-chain|RPC returned HTTP [0-9]{3}[^\\r\\n]{0,40}|Unexpected [A-Za-z ]{1,60})$")]
        private static partial Regex SafeNetworkMessage();

        // Decompiling a large contract takes tens of seconds of CPU on the shared node, so only a
        // few run at once. A caller that cannot get a slot soon is told to retry instead of queueing.
        public const int DefaultMaxConcurrentRequests = 3;
        public static readonly TimeSpan DefaultSlotWaitTime = TimeSpan.FromSeconds(5);
        private const string ApiPath = "api/dev-tools/";

        private readonly SemaphoreSlim _slots;
        private readonly TimeSpan _slotWaitTime;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IExtendedConfig _config;
        private readonly ILogger<SorobanRetClient> _logger;

        public SorobanRetClient(IHttpClientFactory httpClientFactory, IExtendedConfig config, ILogger<SorobanRetClient> logger)
            : this(httpClientFactory, config, logger, DefaultMaxConcurrentRequests, DefaultSlotWaitTime)
        {
        }

        public SorobanRetClient(
            IHttpClientFactory httpClientFactory, IExtendedConfig config, ILogger<SorobanRetClient> logger,
            int maxConcurrentRequests, TimeSpan slotWaitTime)
        {
            _httpClientFactory = httpClientFactory;
            _config = config;
            _logger = logger;
            _slots = new SemaphoreSlim(maxConcurrentRequests, maxConcurrentRequests);
            _slotWaitTime = slotWaitTime;
        }

        public async Task<RetVersionsResult> GetVersionsAsync(CancellationToken cancellationToken)
        {
            using var response = await SendAsync(HttpMethod.Get, "versions", null, cancellationToken);
            using var doc = await ReadAsync(response);
            var root = doc.RootElement;
            return new RetVersionsResult
            {
                Current = Str(root, "current") ?? "",
                Available = StrList(root, "available"),
            };
        }

        public async Task<RetDisassembly> DisassembleAddressAsync(string address, string network, string? version, CancellationToken cancellationToken)
        {
            using var response = await SendAsync(HttpMethod.Post, "address",
                new { address, network, spec_only = false, version }, cancellationToken);
            using var doc = await ReadAsync(response);
            return Map(doc.RootElement);
        }

        public async Task<RetDisassembly> DisassembleWasmAsync(byte[] wasm, string? version, CancellationToken cancellationToken)
        {
            using var response = await SendAsync(HttpMethod.Post, "disassemble",
                new { wasm_base64 = Convert.ToBase64String(wasm), spec_only = false, version }, cancellationToken);
            using var doc = await ReadAsync(response);
            return Map(doc.RootElement);
        }

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, CancellationToken cancellationToken)
        {
            var baseUrl = (_config.DevToolsUrl ?? "").Trim().TrimEnd('/');
            if (baseUrl.Length == 0)
                throw new PublicApiUnavailableException("The decompiler is not available on this server.") { ChargesAllowance = false };

            if (!await _slots.WaitAsync(_slotWaitTime, cancellationToken))
                throw new PublicApiUnavailableException("The decompiler is busy. Try again in a moment.") { ChargesAllowance = false };
            try
            {
                using var request = new HttpRequestMessage(method, $"{baseUrl}/{ApiPath}{path}");
                if (body != null) request.Content = JsonContent.Create(body);

                // Ends when the time is up or the caller goes away, whichever comes first.
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(5, _config.RetRequestTimeoutSeconds)));
                try
                {
                    var client = _httpClientFactory.CreateClient(HttpClients.NoRetryClient);
                    // The body is read inside the slot too: the decompile work is done by then.
                    var response = await client.SendAsync(request, HttpCompletionOption.ResponseContentRead, timeout.Token);
                    if (response.IsSuccessStatusCode) return response;
                    using (response) throw await ToException(response);
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested && timeout.IsCancellationRequested)
                {
                    throw new PublicApiUnavailableException("The decompiler took too long. The contract may be very large; try again later.");
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogError(ex, "soroban-ret-web is not reachable");
                    throw new PublicApiUnavailableException("The decompiler is temporarily unavailable. Try again later.");
                }
            }
            finally
            {
                _slots.Release();
            }
        }

        // soroban-ret-web answers { "error": "...", "kind": "invalid_input" | "decompile_error" | ... }.
        private async Task<Exception> ToException(HttpResponseMessage response)
        {
            string? message = null;
            string? kind = null;
            try
            {
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                message = Str(doc.RootElement, "error");
                kind = Str(doc.RootElement, "kind");
            }
            catch (JsonException) { /* not our service's error body */ }

            message = Shorten(message);
            switch (kind)
            {
                // The caller's input: a bad address or version, or a contract that is not a custom WASM.
                case "invalid_input" when !string.IsNullOrEmpty(message):
                    return new PublicApiValidationException(message);
                case "decompile_error" when !string.IsNullOrEmpty(message):
                    return new PublicApiValidationException($"Could not decompile this module: {message}") { ChargesAllowance = true };
                // The Stellar node did not give us the contract. Only a few known messages are passed on:
                // the others (for example "RPC request failed: ... url ...") can carry the node's address.
                case "network_error":
                    return new PublicApiUnavailableException(message != null && SafeNetworkMessage().IsMatch(message)
                        ? $"Could not fetch the contract from the network: {message}"
                        : "Could not fetch the contract from the Stellar network right now. Try again later.");
            }
            _logger.LogError("soroban-ret-web answered {Status} ({Kind}): {Message}", (int)response.StatusCode, kind, message);
            return new PublicApiUnavailableException("The decompiler is temporarily unavailable. Try again later.");
        }

        private static async Task<JsonDocument> ReadAsync(HttpResponseMessage response)
        {
            try
            {
                return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            }
            catch (JsonException)
            {
                throw new PublicApiUnavailableException("The decompiler returned an unexpected answer. Try again later.");
            }
        }

        private static RetDisassembly Map(JsonElement root)
        {
            var info = root.TryGetProperty("contract_info", out var ci) ? ci : default;
            return new RetDisassembly(
                Source: Str(root, "source") ?? "",
                Wat: Str(root, "wat") ?? "",
                WasmSize: root.TryGetProperty("wasm_size", out var size) && size.TryGetInt32(out var s) ? s : 0,
                WasmHash: Str(root, "wasm_hash"),
                SdkVersion: Str(root, "sdk_version"),
                IsSoroban: root.TryGetProperty("is_soroban", out var soroban) && soroban.ValueKind == JsonValueKind.True,
                StandardInterfaces: StrList(root, "standard_interfaces"),
                Warnings: StrList(root, "warnings"),
                Functions: info.ValueKind == JsonValueKind.Object && info.TryGetProperty("functions", out var fns) && fns.ValueKind == JsonValueKind.Array
                    ? fns.EnumerateArray().Select(MapFunction).ToList()
                    : new(),
                Types: info.ValueKind == JsonValueKind.Object && info.TryGetProperty("types", out var types) && types.ValueKind == JsonValueKind.Array
                    ? types.EnumerateArray().Select(t => new RetType { Name = Str(t, "name") ?? "", Kind = Str(t, "kind") ?? "", Line = Int(t, "line_number") }).ToList()
                    : new(),
                EngineVersion: Str(root, "engine_version") ?? "",
                ElapsedMs: root.TryGetProperty("elapsed_ms", out var ms) && ms.TryGetInt64(out var m) ? m : 0);
        }

        private static RetFunction MapFunction(JsonElement f) => new()
        {
            Name = Str(f, "name") ?? "",
            Params = f.TryGetProperty("params", out var ps) && ps.ValueKind == JsonValueKind.Array
                ? ps.EnumerateArray().Select(p => new RetParam { Name = Str(p, "name") ?? "", Type = Str(p, "type_name") ?? "" }).ToList()
                : new(),
            ReturnType = Str(f, "return_type"),
            IsConstructor = f.TryGetProperty("is_constructor", out var c) && c.ValueKind == JsonValueKind.True,
            BodyRecovered = f.TryGetProperty("body_recovered", out var b) && b.ValueKind == JsonValueKind.True,
            Line = Int(f, "line_number"),
        };

        private static string? Str(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        private static int? Int(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

        private static List<string> StrList(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array
                ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList()
                : new();

        private static string? Shorten(string? message)
        {
            if (string.IsNullOrWhiteSpace(message)) return null;
            message = message.Trim();
            return message.Length <= 300 ? message : message[..300] + "...";
        }
    }

    // ---- the operations ---------------------------------------------------------------------------

    public interface IRetService
    {
        int MaxWasmBytes { get; }
        Task<RetVersionsResult> Versions(CancellationToken cancellationToken);
        Task<RetDecompileResult> DecompileAddress(string? address, string? network, string? version, bool includeWat, CancellationToken cancellationToken);
        Task<RetDecompileResult> DecompileWasm(string? wasmBase64, string? version, bool includeWat, CancellationToken cancellationToken);
    }

    // Validates what a caller sends and shapes what soroban-ret answers. The transports (MCP today)
    // call this through the same gate as every other public operation.
    public partial class RetService : IRetService
    {
        // A Soroban contract id as a strkey: "C" + 55 base32 characters.
        [GeneratedRegex("^C[A-Z2-7]{55}$")]
        private static partial Regex ContractAddress();

        // [0-9], not \d: \d also matches digits of other scripts.
        [GeneratedRegex(@"^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$")]
        private static partial Regex VersionNumber();

        public const int MaxTextChars = 300_000;
        private static readonly byte[] WasmMagic = { 0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00 };

        private readonly ISorobanRetClient _client;
        private readonly IExtendedConfig _config;

        public RetService(ISorobanRetClient client, IExtendedConfig config)
        {
            _client = client;
            _config = config;
        }

        public int MaxWasmBytes => _config.RetMaxWasmBytes;

        public async Task<RetVersionsResult> Versions(CancellationToken cancellationToken) => await _client.GetVersionsAsync(cancellationToken);

        public async Task<RetDecompileResult> DecompileAddress(string? address, string? network, string? version, bool includeWat, CancellationToken cancellationToken)
        {
            var cleanAddress = (address ?? "").Trim();
            if (!ContractAddress().IsMatch(cleanAddress))
                throw new PublicApiValidationException("'address' must be a Stellar contract address: 56 characters, starting with C.");
            var cleanNetwork = string.IsNullOrWhiteSpace(network) ? "mainnet" : network.Trim().ToLowerInvariant();
            if (cleanNetwork is not ("mainnet" or "testnet"))
                throw new PublicApiValidationException("'network' must be 'mainnet' or 'testnet'.");
            var cleanVersion = CleanVersion(version);

            var result = await _client.DisassembleAddressAsync(cleanAddress, cleanNetwork, cleanVersion, cancellationToken);
            var shaped = Shape(result, includeWat);
            shaped.Address = cleanAddress;
            shaped.Network = cleanNetwork;
            // The on-chain code hash of a contract is the SHA-256 of its module.
            shaped.WasmSha256 = shaped.WasmHash ?? "";
            return shaped;
        }

        public async Task<RetDecompileResult> DecompileWasm(string? wasmBase64, string? version, bool includeWat, CancellationToken cancellationToken)
        {
            var wasm = DecodeWasm(wasmBase64, _config.RetMaxWasmBytes);
            var cleanVersion = CleanVersion(version);

            var result = await _client.DisassembleWasmAsync(wasm, cleanVersion, cancellationToken);
            var shaped = Shape(result, includeWat);
            shaped.WasmSha256 = Convert.ToHexStringLower(SHA256.HashData(wasm));
            return shaped;
        }

        // Checks the size before decoding, so an oversized payload costs almost nothing.
        public static byte[] DecodeWasm(string? wasmBase64, int maxBytes)
        {
            var text = (wasmBase64 ?? "").Trim();
            if (text.Length == 0)
                throw new PublicApiValidationException("'wasmBase64' is required: the contract's .wasm file, base64 encoded.");
            var maxChars = (maxBytes + 2) / 3 * 4 + 8;
            if (text.Length > maxChars)
                throw new PublicApiValidationException($"The WASM is too large. The limit is {maxBytes / 1024} KB.");

            byte[] wasm;
            try
            {
                wasm = Convert.FromBase64String(text);
            }
            catch (FormatException)
            {
                throw new PublicApiValidationException("'wasmBase64' is not valid base64.");
            }
            if (wasm.Length > maxBytes)
                throw new PublicApiValidationException($"The WASM is too large. The limit is {maxBytes / 1024} KB.");
            if (wasm.Length < WasmMagic.Length || !wasm.AsSpan(0, WasmMagic.Length).SequenceEqual(WasmMagic))
                throw new PublicApiValidationException("This is not a WebAssembly module (it does not start with \\0asm).");
            return wasm;
        }

        private static string? CleanVersion(string? version)
        {
            if (string.IsNullOrWhiteSpace(version)) return null;
            var clean = version.Trim().TrimStart('v');
            if (!VersionNumber().IsMatch(clean))
                throw new PublicApiValidationException("'version' must look like 0.0.4. Use ret_versions to see what is available.");
            return clean;
        }

        private static RetDecompileResult Shape(RetDisassembly r, bool includeWat)
        {
            var result = new RetDecompileResult
            {
                Source = r.Source,
                WasmHash = r.WasmHash,
                WasmSize = r.WasmSize,
                IsSoroban = r.IsSoroban,
                SdkVersion = r.SdkVersion,
                StandardInterfaces = r.StandardInterfaces,
                Warnings = r.Warnings,
                Functions = r.Functions,
                Types = r.Types,
                EngineVersion = r.EngineVersion,
                ElapsedMs = r.ElapsedMs,
            };
            if (result.Source.Length > MaxTextChars)
            {
                result.Source = result.Source[..MaxTextChars];
                result.SourceTruncated = true;
            }
            if (includeWat)
            {
                result.Wat = r.Wat.Length > MaxTextChars ? r.Wat[..MaxTextChars] : r.Wat;
                result.WatTruncated = r.Wat.Length > MaxTextChars;
            }
            return result;
        }
    }
}
