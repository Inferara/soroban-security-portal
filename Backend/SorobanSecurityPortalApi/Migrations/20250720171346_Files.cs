using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class Files : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "pictures_container_guid",
                table: "vulnerability",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "file",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    container_guid = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    bin_file = table.Column<byte[]>(type: "bytea", nullable: true),
                    date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    author = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_file", x => x.id);
                });

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 20, 17, 13, 45, 710, DateTimeKind.Utc).AddTicks(7296));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "file");

            migrationBuilder.DropColumn(
                name: "pictures_container_guid",
                table: "vulnerability");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 7, 19, 7, 20, 53, 151, DateTimeKind.Utc).AddTicks(2415));
        }
    }
}
