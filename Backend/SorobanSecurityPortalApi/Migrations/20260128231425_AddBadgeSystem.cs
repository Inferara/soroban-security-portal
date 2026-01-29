using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBadgeSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "badge_definitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    icon = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<int>(type: "integer", nullable: false),
                    criteria = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_badge_definitions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "moderation_log",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    original_content = table.Column<string>(type: "text", nullable: false),
                    sanitized_content = table.Column<string>(type: "text", nullable: false),
                    filter_reason = table.Column<string>(type: "text", nullable: false),
                    is_blocked = table.Column<bool>(type: "boolean", nullable: false),
                    requires_moderation = table.Column<bool>(type: "boolean", nullable: false),
                    warnings = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_moderation_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_badges",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    badge_id = table.Column<Guid>(type: "uuid", nullable: false),
                    awarded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_badges", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_badges_badge_definitions_badge_id",
                        column: x => x.badge_id,
                        principalTable: "badge_definitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "badge_definitions",
                columns: new[] { "id", "category", "criteria", "description", "icon", "name" },
                values: new object[,]
                {
                    { new Guid("00000000-0000-0000-0000-000000000001"), 0, "first_comment", "Posted first comment", "🎉", "First Comment" },
                    { new Guid("00000000-0000-0000-0000-000000000002"), 1, "first_report", "Submitted first report", "📝", "Reporter" },
                    { new Guid("00000000-0000-0000-0000-000000000003"), 1, "first_vulnerability", "Added first vulnerability", "🔍", "Bug Hunter" },
                    { new Guid("00000000-0000-0000-0000-000000000004"), 2, "reputation:100", "Reached 100 reputation", "⭐", "Rising Star" },
                    { new Guid("00000000-0000-0000-0000-000000000005"), 2, "reputation:1000", "Reached 1000 reputation", "🏆", "Top Contributor" },
                    { new Guid("00000000-0000-0000-0000-000000000006"), 3, "upvoted_comments:10", "10 upvoted comments", "💬", "Helpful" }
                });

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 28, 23, 14, 18, 430, DateTimeKind.Utc).AddTicks(7509) });

            migrationBuilder.CreateIndex(
                name: "ix_user_badges_badge_id",
                table: "user_badges",
                column: "badge_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "moderation_log");

            migrationBuilder.DropTable(
                name: "user_badges");

            migrationBuilder.DropTable(
                name: "badge_definitions");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 27, 5, 40, 58, 575, DateTimeKind.Utc).AddTicks(7690) });
        }
    }
}
