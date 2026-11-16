using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.OpenApi;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Swashbuckle.AspNetCore.SwaggerGen;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    // The public OpenAPI document is read by tools (agent skills, gateways): every operation
    // names its MCP tool and says when to use it.
    public class PublicApiRoutingTests
    {
        private static List<(MethodInfo Method, string? Operation)> RestActions() =>
            typeof(PublicApiController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any())
                .Select(m => (m, m.GetCustomAttribute<PublicOperationAttribute>()?.Name))
                .ToList();

        private static List<string> OperationNames() =>
            typeof(PublicApiOperations).GetFields(BindingFlags.Public | BindingFlags.Static)
                .Where(f => f.IsLiteral && f.FieldType == typeof(string) && f.Name != nameof(PublicApiOperations.DecompilePrefix))
                .Select(f => (string)f.GetRawConstantValue()!)
                .ToList();

        [Fact]
        public void Every_Rest_Action_Names_Its_Operation_Once_And_Has_Routing_Hints()
        {
            var actions = RestActions();

            actions.Should().HaveCount(8);
            actions.Should().OnlyContain(a => a.Operation != null);
            actions.Select(a => a.Operation).Should().OnlyHaveUniqueItems();
            foreach (var (_, operation) in actions)
            {
                var route = PublicApiRouting.Routes[operation!];
                route.Purpose.Should().NotBeNullOrWhiteSpace();
                route.UseWhen.Should().NotBeNullOrWhiteSpace();
                route.NotFor.Should().NotBeNullOrWhiteSpace();
                route.ExampleQuestions.Length.Should().BeInRange(2, 3);
                route.Keywords.Should().NotBeEmpty();
            }
        }

        [Fact]
        public void Every_Operation_Is_Either_A_Rest_Action_Or_A_Decompiler_Tool()
        {
            var rest = RestActions().Select(a => a.Operation!).ToList();

            foreach (var name in OperationNames())
            {
                if (name.StartsWith("ret_")) rest.Should().NotContain(name);
                else rest.Should().Contain(name);
            }
            PublicApiRouting.Routes.Keys.Should().BeEquivalentTo(rest);
        }

        [Fact]
        public void The_Filter_Writes_The_Three_Extensions()
        {
            var method = typeof(PublicApiController).GetMethod(nameof(PublicApiController.ListTags))!;
            var operation = new OpenApiOperation();
            var context = new OperationFilterContext(
                new ApiDescription(), new Mock<ISchemaGenerator>().Object, new SchemaRepository(), new OpenApiDocument(), method);

            new PublicApiRoutingFilter().Apply(operation, context);

            var json = ToJson(operation);
            json["x-mcp-tool"]!.GetValue<string>().Should().Be("list_tags");
            json["x-side-effecting"]!.GetValue<bool>().Should().BeFalse();
            var routing = json["x-routing"]!.AsObject();
            routing.Select(p => p.Key).Should().BeEquivalentTo("purpose", "useWhen", "exampleQuestions", "keywords", "notFor");
            routing["exampleQuestions"]!.AsArray().Count.Should().Be(2);
        }

        [Fact]
        public void The_Filter_Leaves_Other_Operations_Alone()
        {
            var method = typeof(object).GetMethod(nameof(object.ToString))!;
            var operation = new OpenApiOperation();
            var context = new OperationFilterContext(
                new ApiDescription(), new Mock<ISchemaGenerator>().Object, new SchemaRepository(), new OpenApiDocument(), method);

            new PublicApiRoutingFilter().Apply(operation, context);

            (operation.Extensions?.Count ?? 0).Should().Be(0);
        }

        private static JsonObject ToJson(OpenApiOperation operation)
        {
            using var text = new System.IO.StringWriter();
            var writer = new OpenApiJsonWriter(text);
            operation.SerializeAsV3(writer);
            return JsonNode.Parse(text.ToString())!.AsObject();
        }

        [Fact]
        public void The_Data_Use_Note_Is_In_The_Mcp_Server_Instructions()
        {
            SorobanSecurityPortalApi.Mcp.PortalMcpTools.ServerInstructions.Should().Contain(PublicApiDocument.DataUseNote);
            PublicApiDocument.DataUseNote.Should().Contain("maintained by Inferara").And.Contain("not a security assessment");
        }
    }

    // The tag filters use jsonb operators that the in-memory test provider cannot run. These
    // tests ask the real PostgreSQL provider for the SQL (no database is contacted).
    public class TagFilterSqlTests
    {
        private static Db BuildDb()
        {
            var config = new Config(@"{
                ""ProductVersion"": ""1.0"", ""DbConnectionTimeout"": 30, ""DbServer"": ""localhost"", ""DbPort"": 5432,
                ""DbName"": ""db"", ""DbUser"": ""u"", ""DbPassword"": ""p"", ""DbTimeout"": 30, ""DbPgPoolSize"": 10,
                ""AutoCompactLargeObjectHeap"": false, ""DistributedCacheUrl"": ""localhost"", ""DistributedCachePassword"": ""x"",
                ""AppUrl"": ""https://portal.example/api/v1""
            }");
            return new Db(new Mock<IDbQuery>().Object, NullLogger<Db>.Instance, new DataSourceProvider(config));
        }

        [Fact]
        public void A_Tag_With_Several_Spellings_Becomes_An_Any_Of_Filter()
        {
            using var db = BuildDb();
            var spellings = new[] { "Access Control", "access control" };

            // The same predicate as VulnerabilityProcessor.BuildFilteredQuery (TagAnyOf).
            var sql = db.Vulnerability
                .Where(v => v.Tags != null && EF.Functions.JsonExistAny(v.Tags, spellings))
                .Select(v => v.Id)
                .ToQueryString();

            sql.Should().Contain("?|");
        }

        [Fact]
        public void Exact_Tags_Stay_A_Contains_Filter()
        {
            using var db = BuildDb();
            var serialized = JsonSerializer.Serialize(new[] { "Storage" });

            var sql = db.Vulnerability
                .Where(v => v.Tags != null && EF.Functions.JsonContains(v.Tags, serialized))
                .Select(v => v.Id)
                .ToQueryString();

            sql.Should().Contain("@>");
        }

        [Fact]
        public void The_Tag_Migration_Only_Rewrites_Tags_From_The_Curated_List()
        {
            var sql = NormalizeVulnerabilityTags.NormalizeSql;

            sql.Should().Contain("UPDATE vulnerability").And.Contain("FROM category");
            sql.Should().Contain("IS DISTINCT FROM"); // rows that need no change are not touched
            sql.Should().NotContain("DELETE");
        }
    }

    public class TagNormalizerTests
    {
        private static readonly string[] Curated = { "Access Control", "Logic Bug", "Rounding" };

        [Fact]
        public void Tags_Take_The_Curated_Spelling_And_Repeats_Are_Dropped()
        {
            VulnerabilityNormalizer.Tags(new[] { "access control", " Logic bug ", "logic bug", "Custom", "", "custom" }, Curated)
                .Should().Equal("Access Control", "Logic Bug", "Custom");
        }

        [Fact]
        public void No_Tags_Is_An_Empty_List()
        {
            VulnerabilityNormalizer.Tags(null, Curated).Should().BeEmpty();
        }
    }
}
