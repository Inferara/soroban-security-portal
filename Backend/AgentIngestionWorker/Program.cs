using AgentIngestionWorker.Api;
using AgentIngestionWorker.OpenCode;
using AgentIngestionWorker.Pdf;
using AgentIngestionWorker.Worker;
using Microsoft.Extensions.Logging;

var apiBaseUrl = Environment.GetEnvironmentVariable("API_BASE_URL")
    ?? "http://localhost:5000/";

var loggerFactory = LoggerFactory.Create(b => b.AddConsole());

var http = new HttpClient { BaseAddress = new Uri(apiBaseUrl) };
var apiClient = new InternalApiClient(http);

var processRunner = new RealProcessRunner();

// Wall-clock and stall caps are env-tunable. The stall watchdog must tolerate the long
// quiet gaps glm-5.1 takes while reasoning/generating between tool steps (a 90s default
// kills legitimate work); the hard Timeout still backstops a truly hung process.
static TimeSpan MinutesFromEnv(string name, double fallback)
    => TimeSpan.FromMinutes(double.TryParse(Environment.GetEnvironmentVariable(name), out var v) ? v : fallback);
static TimeSpan SecondsFromEnv(string name, double fallback)
    => TimeSpan.FromSeconds(double.TryParse(Environment.GetEnvironmentVariable(name), out var v) ? v : fallback);

var runnerOpts = new OpenCodeRunnerOptions
{
    Model = Environment.GetEnvironmentVariable("OPENCODE_MODEL") ?? "zai-coding-plan/glm-5.1",
    OpenCodeBin = Environment.GetEnvironmentVariable("OPENCODE_BIN") ?? "opencode",
    Timeout = MinutesFromEnv("OPENCODE_TIMEOUT_MIN", 20),
    StallTimeout = SecondsFromEnv("OPENCODE_STALL_SEC", 300),
};
var openCodeRunner = new OpenCodeRunner(processRunner, runnerOpts);

// Separate HttpClient for PDF downloads (no base address — fetches absolute URLs)
var downloadHttp = new HttpClient();
var pdfExtractor = new PdfTextExtractor();
var ingestionPrompt = new IngestionPrompt(downloadHttp, pdfExtractor);

var workerOpts = new IngestionRunnerOptions
{
    PollInterval = TimeSpan.FromSeconds(15),
};
var workerLogger = loggerFactory.CreateLogger<IngestionRunner>();

var runner = new IngestionRunner(apiClient, openCodeRunner, ingestionPrompt, workerOpts, workerLogger);

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

await runner.RunLoopAsync(cts.Token);
