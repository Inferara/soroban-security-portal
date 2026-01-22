using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddModerationLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

            migrationBuilder.CreateIndex(
                name: "ix_moderation_log_user_id",
                table: "moderation_log",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_moderation_log_created_at",
                table: "moderation_log",
                column: "created_at");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 22, 0, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "moderation_log");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 11, 30, 2, 29, 25, 139, DateTimeKind.Utc).AddTicks(1314) });
        }
    }
}
