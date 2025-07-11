using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class Picture : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "author",
                table: "vulnerability",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "last_action_at",
                table: "vulnerability",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "last_action_by",
                table: "vulnerability",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "author",
                table: "report",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "last_action_at",
                table: "report",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "last_action_by",
                table: "report",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "picture",
                table: "login_history",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 9, 12, 37, 33, 951, DateTimeKind.Utc).AddTicks(9310));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "author",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "last_action_at",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "last_action_by",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "author",
                table: "report");

            migrationBuilder.DropColumn(
                name: "last_action_at",
                table: "report");

            migrationBuilder.DropColumn(
                name: "last_action_by",
                table: "report");

            migrationBuilder.DropColumn(
                name: "picture",
                table: "login_history");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 7, 4, 2, 16, 962, DateTimeKind.Utc).AddTicks(5464));
        }
    }
}
