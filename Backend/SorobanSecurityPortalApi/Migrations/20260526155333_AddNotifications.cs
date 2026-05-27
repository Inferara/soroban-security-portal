using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notification",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    recipient_user_id = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    actor_user_id = table.Column<int>(type: "integer", nullable: false),
                    comment_id = table.Column<int>(type: "integer", nullable: false),
                    entity_type = table.Column<int>(type: "integer", nullable: false),
                    entity_id = table.Column<int>(type: "integer", nullable: false),
                    preview = table.Column<string>(type: "character varying(280)", maxLength: 280, nullable: false),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification", x => x.id);
                });

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 5, 26, 15, 53, 33, 208, DateTimeKind.Utc).AddTicks(4131) });

            migrationBuilder.CreateIndex(
                name: "ix_notification_recipient_user_id_created_at",
                table: "notification",
                columns: new[] { "recipient_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_recipient_user_id_is_read",
                table: "notification",
                columns: new[] { "recipient_user_id", "is_read" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 5, 26, 15, 15, 39, 961, DateTimeKind.Utc).AddTicks(6929) });
        }
    }
}
