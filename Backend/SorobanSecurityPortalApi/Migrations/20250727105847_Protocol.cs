using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class Protocol : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "connection");

            migrationBuilder.RenameColumn(
                name: "project",
                table: "vulnerability",
                newName: "protocol");

            migrationBuilder.RenameColumn(
                name: "project",
                table: "report",
                newName: "protocol");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 27, 10, 58, 46, 977, DateTimeKind.Utc).AddTicks(197));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "protocol",
                table: "vulnerability",
                newName: "project");

            migrationBuilder.RenameColumn(
                name: "protocol",
                table: "report",
                newName: "project");

            migrationBuilder.CreateTable(
                name: "connection",
                columns: table => new
                {
                    connection_id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    content = table.Column<Dictionary<string, string>>(type: "jsonb", nullable: false),
                    created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    workspace_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_connection", x => x.connection_id);
                });

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 20, 17, 13, 45, 710, DateTimeKind.Utc).AddTicks(7296));
        }
    }
}
