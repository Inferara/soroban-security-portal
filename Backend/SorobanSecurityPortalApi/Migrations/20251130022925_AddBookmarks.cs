using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBookmarks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bookmark",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    login_id = table.Column<int>(type: "integer", nullable: false),
                    item_id = table.Column<int>(type: "integer", nullable: false),
                    bookmark_type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_bookmark", x => x.id);
                });

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 11, 30, 2, 29, 25, 139, DateTimeKind.Utc).AddTicks(1314) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bookmark");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 11, 9, 5, 20, 35, 49, DateTimeKind.Utc).AddTicks(5097) });
        }
    }
}
