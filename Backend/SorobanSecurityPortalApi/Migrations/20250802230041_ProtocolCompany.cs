using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class ProtocolCompany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "company_id",
                table: "project",
                type: "integer",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 8, 2, 23, 0, 40, 541, DateTimeKind.Utc).AddTicks(5408));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "company_id",
                table: "project");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 29, 9, 28, 30, 23, DateTimeKind.Utc).AddTicks(6762));
        }
    }
}
