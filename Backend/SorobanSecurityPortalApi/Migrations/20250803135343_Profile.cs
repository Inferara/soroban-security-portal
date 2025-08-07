using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class Profile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tokens_limit",
                table: "login");

            migrationBuilder.AddColumn<List<ConnectedAccountModel>>(
                name: "connected_accounts",
                table: "login",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "image",
                table: "login",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "personal_info",
                table: "login",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created", "image", "personal_info" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 8, 3, 13, 53, 42, 395, DateTimeKind.Utc).AddTicks(294), null, "" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "connected_accounts",
                table: "login");

            migrationBuilder.DropColumn(
                name: "image",
                table: "login");

            migrationBuilder.DropColumn(
                name: "personal_info",
                table: "login");

            migrationBuilder.AddColumn<int>(
                name: "tokens_limit",
                table: "login",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "created", "tokens_limit" },
                values: new object[] { new DateTime(2025, 8, 3, 13, 45, 28, 869, DateTimeKind.Utc).AddTicks(387), 0 });
        }
    }
}
