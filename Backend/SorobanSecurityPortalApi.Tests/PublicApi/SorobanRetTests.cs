using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    public class SorobanRetClientTests
    {
        // A handler that answers from a function, and records what was sent.
        private sealed class StubHandler : HttpMessageHandler
        {
            public Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Respond { get; set; } =
                (_, _) => Task.FromResult(Json(HttpStatusCode.OK, "{}"));
            public List<(HttpMethod Method, string Url, string Body)> Requests { get; } = new();

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Requests.Add((request.Method, request.RequestUri!.ToString(), request.Content == null ? "" : await request.Content.ReadAsStringAsync(cancellationToken)));
                return await Respond(request, cancellationToken);
            }
        }

        private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
            new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

        private const string Sample = @"{
            ""source"": ""pub fn hello() {}"", ""wat"": ""(module)"", ""wasm_hex"": ""00"", ""wasm_hex_truncated"": false, ""wasm_base64"": ""AAAA"",
            ""wasm_size"": 1234, ""sections"": [], ""sdk_version"": ""23.0.0"", ""standard_interfaces"": [""SEP-41""], ""warnings"": [""a warning""],
            ""is_soroban"": true, ""elapsed_ms"": 321, ""wasm_hash"": ""abc123"", ""engine"": ""library"", ""engine_version"": ""0.0.4"",
            ""contract_info"": { ""function_count"": 2, ""type_count"": 1, ""has_constructor"": true,
              ""functions"": [
                { ""name"": ""__constructor"", ""params"": [{ ""name"": ""admin"", ""type_name"": ""Address"" }], ""return_type"": null, ""takes_env"": true, ""is_constructor"": true, ""is_check_auth"": false, ""body_recovered"": true, ""line_number"": 5 },
                { ""name"": ""transfer"", ""params"": [{ ""name"": ""to"", ""type_name"": ""Address"" }, { ""name"": ""amount"", ""type_name"": ""i128"" }], ""return_type"": ""bool"", ""takes_env"": true, ""is_constructor"": false, ""is_check_auth"": false, ""body_recovered"": false, ""line_number"": 12 }
              ],
              ""types"": [{ ""name"": ""DataKey"", ""kind"": ""enum"", ""line_number"": 1 }] }
        }";

        private readonly StubHandler _handler = new();
        private readonly Mock<IExtendedConfig> _config = new();

        public SorobanRetClientTests()
        {
            _config.SetupGet(c => c.DevToolsUrl).Returns("http://ret.internal:8787/");
            _config.SetupGet(c => c.RetRequestTimeoutSeconds).Returns(90);
        }

        private SorobanRetClient Build(int maxConcurrent = 3, TimeSpan? slotWait = null)
        {
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(f => f.CreateClient(HttpClients.NoRetryClient)).Returns(() => new HttpClient(_handler, disposeHandler: false));
            return new SorobanRetClient(factory.Object, _config.Object, NullLogger<SorobanRetClient>.Instance, maxConcurrent, slotWait ?? TimeSpan.FromSeconds(5));
        }

        [Fact]
        public async Task Versions_Are_Read_From_The_Dev_Tools_Backend()
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.OK, @"{""current"":""0.0.4"",""available"":[""0.0.3"",""0.0.4""],""compile_enabled"":false}"));

            var result = await Build().GetVersionsAsync(CancellationToken.None);

            result.Current.Should().Be("0.0.4");
            result.Available.Should().Equal("0.0.3", "0.0.4");
            _handler.Requests.Should().ContainSingle().Which.Should().Be((HttpMethod.Get, "http://ret.internal:8787/api/dev-tools/versions", ""));
        }

        [Fact]
        public async Task By_Address_Sends_The_Read_Only_Request_And_Maps_The_Answer()
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.OK, Sample));

            var result = await Build().DisassembleAddressAsync("CABC", "mainnet", "0.0.3", CancellationToken.None);

            var request = _handler.Requests.Single();
            request.Method.Should().Be(HttpMethod.Post);
            request.Url.Should().Be("http://ret.internal:8787/api/dev-tools/address");
            request.Body.Should().Contain("\"address\":\"CABC\"").And.Contain("\"network\":\"mainnet\"").And.Contain("\"version\":\"0.0.3\"").And.Contain("\"spec_only\":false");

            result.Source.Should().Be("pub fn hello() {}");
            result.WasmSize.Should().Be(1234);
            result.WasmHash.Should().Be("abc123");
            result.SdkVersion.Should().Be("23.0.0");
            result.IsSoroban.Should().BeTrue();
            result.EngineVersion.Should().Be("0.0.4");
            result.ElapsedMs.Should().Be(321);
            result.StandardInterfaces.Should().Equal("SEP-41");
            result.Warnings.Should().Equal("a warning");
            result.Functions.Select(f => f.Name).Should().Equal("__constructor", "transfer");
            result.Functions[1].Should().BeEquivalentTo(new RetFunction
            {
                Name = "transfer",
                Params = new() { new() { Name = "to", Type = "Address" }, new() { Name = "amount", Type = "i128" } },
                ReturnType = "bool",
                IsConstructor = false,
                BodyRecovered = false,
                Line = 12,
            });
            result.Types.Should().ContainSingle().Which.Name.Should().Be("DataKey");
        }

        [Fact]
        public async Task By_Wasm_Sends_The_Module_As_Base64()
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.OK, Sample));

            await Build().DisassembleWasmAsync(new byte[] { 0, 0x61, 0x73, 0x6D }, null, CancellationToken.None);

            var request = _handler.Requests.Single();
            request.Url.Should().Be("http://ret.internal:8787/api/dev-tools/disassemble");
            request.Body.Should().Contain("\"wasm_base64\":\"AGFzbQ==\"");
        }

        [Fact]
        public async Task Only_Decompile_And_Version_Endpoints_Are_Ever_Used_Never_Compile()
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.OK, Sample));
            var client = Build();

            await client.GetVersionsAsync(CancellationToken.None);
            await client.DisassembleAddressAsync("C", "mainnet", null, CancellationToken.None);
            await client.DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None);

            _handler.Requests.Select(r => r.Url).Should().OnlyContain(u => !u.Contains("compile"));
        }

        [Theory]
        [InlineData("invalid_input", "Unknown version '9.9.9'", typeof(PublicApiValidationException), "Unknown version '9.9.9'")]
        [InlineData("decompile_error", "bad section", typeof(PublicApiValidationException), "Could not decompile this module: bad section")]
        [InlineData("network_error", "Contract not found on-chain", typeof(PublicApiUnavailableException), "Could not fetch the contract from the network: Contract not found on-chain")]
        public async Task The_Backends_Error_Kinds_Become_Messages_For_The_Caller(string kind, string error, Type expected, string message)
        {
            var status = kind == "network_error" ? HttpStatusCode.BadGateway : kind == "decompile_error" ? HttpStatusCode.UnprocessableEntity : HttpStatusCode.BadRequest;
            _handler.Respond = (_, _) => Task.FromResult(Json(status, $"{{\"error\":\"{error}\",\"kind\":\"{kind}\"}}"));

            var act = () => Build().DisassembleAddressAsync("CABC", "mainnet", null, CancellationToken.None);

            var thrown = (await act.Should().ThrowAsync<Exception>()).Which;
            thrown.GetType().Should().Be(expected);
            thrown.Message.Should().Be(message);
        }

        [Theory]
        [InlineData("RPC request failed: error sending request for url (https://rpc.internal.example:8443/?api-key=SECRET)")]
        [InlineData("RPC error: node 10.1.2.3 is behind by 41 ledgers")]
        [InlineData("Failed to parse RPC response: expected value at line 1 column 1 from http://10.0.0.5")]
        public async Task A_Network_Error_That_Could_Carry_The_Nodes_Address_Is_Replaced_By_A_Fixed_Message(string upstream)
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.BadGateway, $"{{\"error\":\"{upstream}\",\"kind\":\"network_error\"}}"));

            var act = () => Build().DisassembleAddressAsync("CABC", "mainnet", null, CancellationToken.None);

            var message = (await act.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message;
            message.Should().Be("Could not fetch the contract from the Stellar network right now. Try again later.");
            message.Should().NotContainAny("rpc.internal", "SECRET", "10.", "api-key");
        }

        [Theory]
        [InlineData("Contract not found on-chain")]
        [InlineData("RPC returned HTTP 503 Service Unavailable")]
        [InlineData("Unexpected ledger entry type")]
        public async Task The_Few_Known_Safe_Network_Messages_Are_Passed_On(string upstream)
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.BadGateway, $"{{\"error\":\"{upstream}\",\"kind\":\"network_error\"}}"));

            var act = () => Build().DisassembleAddressAsync("CABC", "mainnet", null, CancellationToken.None);

            (await act.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message.Should().EndWith(upstream);
        }

        [Fact]
        public async Task A_Caller_Who_Goes_Away_Stops_The_Request_And_Frees_The_Slot()
        {
            CancellationToken seen = default;
            var started = new TaskCompletionSource();
            _handler.Respond = async (_, token) => { seen = token; started.SetResult(); await Task.Delay(Timeout.Infinite, token); return Json(HttpStatusCode.OK, "{}"); };
            var client = Build(maxConcurrent: 1, slotWait: TimeSpan.FromMilliseconds(200));
            using var caller = new CancellationTokenSource();

            var call = client.GetVersionsAsync(caller.Token);
            await started.Task;
            caller.Cancel();

            await call.Awaiting(c => c).Should().ThrowAsync<OperationCanceledException>(); // the caller's own cancellation, not the "took too long" message
            seen.IsCancellationRequested.Should().BeTrue();
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.OK, @"{""current"":""0.0.4"",""available"":[]}"));
            (await client.GetVersionsAsync(CancellationToken.None)).Current.Should().Be("0.0.4"); // the only slot is free again
        }

        [Fact]
        public async Task Only_An_Upstream_Decompile_Failure_Counts_Against_The_Allowance()
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.UnprocessableEntity, "{\"error\":\"bad section\",\"kind\":\"decompile_error\"}"));
            var decompile = (await ((Func<Task>)(() => Build().DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None))).Should().ThrowAsync<PublicApiValidationException>()).Which;
            decompile.ChargesAllowance.Should().BeTrue();

            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.BadRequest, "{\"error\":\"Unknown version\",\"kind\":\"invalid_input\"}"));
            var invalid = (await ((Func<Task>)(() => Build().DisassembleWasmAsync(new byte[] { 1 }, "9.9.9", CancellationToken.None))).Should().ThrowAsync<PublicApiValidationException>()).Which;
            invalid.ChargesAllowance.Should().BeFalse();
        }

        [Fact]
        public async Task Busy_And_Not_Configured_Do_Not_Charge_But_A_Timeout_Does()
        {
            _config.SetupGet(c => c.DevToolsUrl).Returns("");
            (await ((Func<Task>)(() => Build().GetVersionsAsync(CancellationToken.None))).Should().ThrowAsync<PublicApiUnavailableException>()).Which.ChargesAllowance.Should().BeFalse();

            _config.SetupGet(c => c.DevToolsUrl).Returns("http://ret.internal:8787/");
            var release = new TaskCompletionSource();
            _handler.Respond = async (_, _) => { await release.Task; return Json(HttpStatusCode.OK, "{}"); };
            var client = Build(maxConcurrent: 1, slotWait: TimeSpan.FromMilliseconds(100));
            var first = client.GetVersionsAsync(CancellationToken.None);
            var busy = (await ((Func<Task>)(() => client.GetVersionsAsync(CancellationToken.None))).Should().ThrowAsync<PublicApiUnavailableException>()).Which;
            busy.Message.Should().Contain("busy");
            busy.ChargesAllowance.Should().BeFalse();
            release.SetResult();
            await first;
        }

        [Fact]
        public async Task An_Unexpected_Failure_Is_Reported_Generically_Without_Internals()
        {
            _handler.Respond = (_, _) => Task.FromResult(Json(HttpStatusCode.InternalServerError, @"{""error"":""panic at /srv/secret/path.rs:12"",""kind"":""something_else""}"));

            var act = () => Build().DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None);

            (await act.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message.Should().NotContain("secret").And.Contain("temporarily unavailable");
        }

        [Fact]
        public async Task A_Reply_That_Is_Not_Json_Is_Reported_Generically()
        {
            _handler.Respond = (_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html>proxy error</html>") });

            var act = () => Build().DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiUnavailableException>();
        }

        [Fact]
        public async Task An_Unreachable_Backend_Is_Reported_As_Unavailable()
        {
            _handler.Respond = (_, _) => throw new HttpRequestException("connection refused 10.0.0.7:8787");

            var act = () => Build().GetVersionsAsync(CancellationToken.None);

            (await act.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message.Should().NotContain("10.0.0.7");
        }

        [Fact]
        public async Task A_Call_That_Takes_Too_Long_Is_Cut_Off_And_Cancels_The_Request()
        {
            _config.SetupGet(c => c.RetRequestTimeoutSeconds).Returns(0); // clamped to the 5 second minimum
            CancellationToken seen = default;
            _handler.Respond = async (_, token) => { seen = token; await Task.Delay(Timeout.Infinite, token); return Json(HttpStatusCode.OK, "{}"); };
            var client = Build();

            // Use a short timeout through the config minimum: wait it out with a cancellable probe.
            var act = () => client.GetVersionsAsync(CancellationToken.None);
            var task = act.Should().ThrowAsync<PublicApiUnavailableException>();

            (await task).Which.Message.Should().Contain("took too long");
            seen.IsCancellationRequested.Should().BeTrue();
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task Without_A_Configured_Backend_The_Tools_Say_So_And_Call_Nothing(string url)
        {
            _config.SetupGet(c => c.DevToolsUrl).Returns(url);

            var act = () => Build().GetVersionsAsync(CancellationToken.None);

            (await act.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message.Should().Contain("not available");
            _handler.Requests.Should().BeEmpty();
        }

        [Fact]
        public async Task At_Most_The_Configured_Number_Of_Requests_Run_At_Once_And_The_Rest_Are_Told_To_Retry()
        {
            var release = new TaskCompletionSource();
            var running = 0;
            _handler.Respond = async (_, _) => { Interlocked.Increment(ref running); await release.Task; return Json(HttpStatusCode.OK, Sample); };
            var client = Build(maxConcurrent: 2, slotWait: TimeSpan.FromMilliseconds(200));

            var first = client.DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None);
            var second = client.DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None);
            while (Volatile.Read(ref running) < 2) await Task.Delay(10);

            var third = () => client.DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None);
            (await third.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message.Should().Contain("busy");
            running.Should().Be(2);

            release.SetResult();
            await Task.WhenAll(first, second);
            (await client.DisassembleWasmAsync(new byte[] { 1 }, null, CancellationToken.None)).Should().NotBeNull(); // slots are free again
        }

        [Fact]
        public async Task A_Failed_Request_Gives_Its_Slot_Back()
        {
            _handler.Respond = (_, _) => throw new HttpRequestException("down");
            var client = Build(maxConcurrent: 1, slotWait: TimeSpan.FromMilliseconds(200));

            for (var i = 0; i < 5; i++)
            {
                var act = () => client.GetVersionsAsync(CancellationToken.None);
                (await act.Should().ThrowAsync<PublicApiUnavailableException>()).Which.Message.Should().NotContain("busy");
            }
        }
    }

    public class RetServiceTests
    {
        private const string ValidAddress = "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH";
        private static readonly byte[] Module = { 0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00, 0x01, 0x02 };

        private readonly Mock<ISorobanRetClient> _client = new();
        private readonly Mock<IExtendedConfig> _config = new();

        public RetServiceTests()
        {
            _config.SetupGet(c => c.RetMaxWasmBytes).Returns(1024);
            _client.Setup(c => c.DisassembleAddressAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result());
            _client.Setup(c => c.DisassembleWasmAsync(It.IsAny<byte[]>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result());
        }

        private RetService Build() => new(_client.Object, _config.Object);

        private static RetDisassembly Result(string source = "pub fn x() {}", string wat = "(module)") => new(
            source, wat, 99, "deadbeef", "23.0.0", true, new() { "SEP-41" }, new() { "w" }, new() { new RetFunction { Name = "x" } }, new(), "0.0.4", 12);

        [Theory]
        [InlineData("")]
        [InlineData(null)]
        [InlineData("GABC")]
        [InlineData("CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDD")]     // 55 chars
        [InlineData("CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDHH")]   // 57 chars
        [InlineData("cag5lryq5jveui5teid72eyovx44ttujt5bqr2j6j77fh65pccfajddh")]    // lower case
        [InlineData("CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJ1DH")]    // 1 is not base32
        [InlineData("CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH/../x")]
        public async Task A_Malformed_Address_Is_Refused_Before_Anything_Is_Called(string? address)
        {
            var act = () => Build().DecompileAddress(address, null, null, false, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiValidationException>().WithMessage("*address*");
            _client.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(null, "mainnet")]
        [InlineData("", "mainnet")]
        [InlineData("MAINNET", "mainnet")]
        [InlineData(" testnet ", "testnet")]
        public async Task Network_Defaults_To_Mainnet_And_Is_Normalised(string? network, string expected)
        {
            var result = await Build().DecompileAddress(ValidAddress, network, null, false, CancellationToken.None);

            result.Network.Should().Be(expected);
            _client.Verify(c => c.DisassembleAddressAsync(ValidAddress, expected, null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData("futurenet")]
        [InlineData("main")]
        [InlineData("http://evil")]
        public async Task An_Unknown_Network_Is_Refused(string network)
        {
            var act = () => Build().DecompileAddress(ValidAddress, network, null, false, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiValidationException>().WithMessage("*network*");
        }

        [Theory]
        [InlineData("0.0.4", "0.0.4")]
        [InlineData("v0.0.4", "0.0.4")]
        [InlineData("  1.2.30 ", "1.2.30")]
        [InlineData(null, null)]
        [InlineData("", null)]
        public async Task The_Version_Is_Cleaned_Or_Left_Out(string? version, string? expected)
        {
            await Build().DecompileAddress(ValidAddress, null, version, false, CancellationToken.None);

            _client.Verify(c => c.DisassembleAddressAsync(ValidAddress, "mainnet", expected, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData("latest")]
        [InlineData("٠.٠.٤")]           // Arabic-Indic digits: \d would accept them
        [InlineData("0.0")]
        [InlineData("0.0.4-beta")]
        [InlineData("../../etc/passwd")]
        [InlineData("0.0.4; rm -rf /")]
        public async Task A_Version_That_Is_Not_A_Plain_Number_Is_Refused(string version)
        {
            var act = () => Build().DecompileAddress(ValidAddress, null, version, false, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiValidationException>().WithMessage("*version*");
            _client.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task The_Result_Has_Source_Functions_And_The_Version_That_Made_It_But_No_Module_Bytes()
        {
            var result = await Build().DecompileAddress(ValidAddress, null, null, false, CancellationToken.None);

            result.Source.Should().Be("pub fn x() {}");
            result.Functions.Should().ContainSingle().Which.Name.Should().Be("x");
            result.EngineVersion.Should().Be("0.0.4");
            result.WasmHash.Should().Be("deadbeef");
            result.WasmSha256.Should().Be("deadbeef");
            result.Address.Should().Be(ValidAddress);
            result.Wat.Should().BeNull();
            typeof(RetDecompileResult).GetProperties().Select(p => p.Name).Should().NotContain(new[] { "WasmHex", "WasmBase64", "Sections" });
        }

        [Fact]
        public async Task Wat_Only_Comes_Back_When_Asked_For()
        {
            (await Build().DecompileAddress(ValidAddress, null, null, includeWat: false, CancellationToken.None)).Wat.Should().BeNull();
            var with = await Build().DecompileAddress(ValidAddress, null, null, includeWat: true, CancellationToken.None);

            with.Wat.Should().Be("(module)");
            with.WatTruncated.Should().BeFalse();
        }

        [Fact]
        public async Task Very_Long_Source_And_Wat_Are_Cut_And_Flagged()
        {
            _client.Setup(c => c.DisassembleAddressAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result(new string('s', RetService.MaxTextChars + 10), new string('w', RetService.MaxTextChars + 10)));

            var result = await Build().DecompileAddress(ValidAddress, null, null, includeWat: true, CancellationToken.None);

            result.Source.Should().HaveLength(RetService.MaxTextChars);
            result.SourceTruncated.Should().BeTrue();
            result.Wat.Should().HaveLength(RetService.MaxTextChars);
            result.WatTruncated.Should().BeTrue();
        }

        // ---- by WASM ----

        [Fact]
        public async Task A_Valid_Module_Is_Decoded_Forwarded_And_Hashed()
        {
            var result = await Build().DecompileWasm(Convert.ToBase64String(Module), "0.0.3", false, CancellationToken.None);

            _client.Verify(c => c.DisassembleWasmAsync(It.Is<byte[]>(b => b.SequenceEqual(Module)), "0.0.3", It.IsAny<CancellationToken>()), Times.Once);
            result.WasmSha256.Should().Be(Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(Module)));
            result.Address.Should().BeNull();
        }

        [Fact]
        public async Task Base64_With_Line_Breaks_And_Padding_Whitespace_Is_Accepted()
        {
            var b64 = Convert.ToBase64String(Module);

            await Build().DecompileWasm("  " + b64 + "\n", null, false, CancellationToken.None);

            _client.Verify(c => c.DisassembleWasmAsync(It.IsAny<byte[]>(), null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(null, "required")]
        [InlineData("", "required")]
        [InlineData("   ", "required")]
        [InlineData("not base64 !!!", "not valid base64")]
        [InlineData("AAAA", "not a WebAssembly module")]                      // decodes, wrong magic
        [InlineData("AGFzbQ==", "not a WebAssembly module")]                  // "\0asm" but no version
        public async Task A_Bad_Module_Is_Refused_Without_Calling_The_Decompiler(string? input, string message)
        {
            var act = () => Build().DecompileWasm(input, null, false, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiValidationException>().WithMessage($"*{message}*");
            _client.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task A_Module_Over_The_Limit_Is_Refused_And_Is_Not_Even_Decoded()
        {
            var tooBig = new byte[2048];
            Module.CopyTo(tooBig, 0);
            var b64 = Convert.ToBase64String(tooBig);

            var act = () => Build().DecompileWasm(b64, null, false, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiValidationException>().WithMessage("*too large*1 KB*");
            _client.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task A_Module_Exactly_At_The_Limit_Is_Accepted()
        {
            var exact = new byte[1024];
            Module.CopyTo(exact, 0);

            await Build().DecompileWasm(Convert.ToBase64String(exact), null, false, CancellationToken.None);

            _client.Verify(c => c.DisassembleWasmAsync(It.Is<byte[]>(b => b.Length == 1024), null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task A_Huge_Payload_Is_Refused_By_Length_Alone()
        {
            var huge = new string('A', 50_000_000);

            var act = () => Build().DecompileWasm(huge, null, false, CancellationToken.None);

            await act.Should().ThrowAsync<PublicApiValidationException>().WithMessage("*too large*");
        }

        // ---- log descriptions ----

        [Fact]
        public void The_Log_Gets_A_Fingerprint_Of_The_Module_Never_The_Module()
        {
            var b64 = Convert.ToBase64String(Module);

            var described = PublicApiOperations.DescribeWasm(b64, "0.0.4", 1024);

            described.Should().Contain("sha256=").And.Contain("bytes=10").And.Contain("version=0.0.4");
            described.Should().NotContain(b64);
        }

        [Theory]
        [InlineData(null, "empty")]
        [InlineData("not base64!", "invalid-base64")]
        public void The_Log_Description_Copes_With_Bad_Input(string? input, string expected)
        {
            PublicApiOperations.DescribeWasm(input, null, 1024).Should().Contain(expected);
        }

        [Fact]
        public void An_Oversized_Payload_Is_Described_By_Its_Length_Without_Being_Decoded()
        {
            PublicApiOperations.DescribeWasm(new string('A', 10_000_000), null, 1024).Should().Contain("oversized chars=10000000");
        }

        [Fact]
        public void The_Address_Call_Is_Logged_With_Address_Network_And_Version()
        {
            PublicApiOperations.Describe(ValidAddress, null, "0.0.4").Should().Be($"address={ValidAddress} network=mainnet version=0.0.4");
        }
    }
}
