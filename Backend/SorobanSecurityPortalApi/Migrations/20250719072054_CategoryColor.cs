using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class CategoryColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "url",
                table: "category",
                newName: "text_color");

            migrationBuilder.AddColumn<string>(
                name: "bg_color",
                table: "category",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 19, 7, 20, 53, 151, DateTimeKind.Utc).AddTicks(2415));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "bg_color",
                table: "category");

            migrationBuilder.RenameColumn(
                name: "text_color",
                table: "category",
                newName: "url");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 13, 16, 4, 39, 764, DateTimeKind.Utc).AddTicks(8123));
        }
    }
}
