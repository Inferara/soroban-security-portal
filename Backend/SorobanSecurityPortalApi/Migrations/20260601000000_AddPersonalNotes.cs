using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonalNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "personal_note",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    login_id = table.Column<int>(type: "integer", nullable: false),
                    vulnerability_id = table.Column<int>(type: "integer", nullable: false),
                    content = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_personal_note", x => x.id);
                    table.ForeignKey(
                        name: "fk_personal_note_login_login_id",
                        column: x => x.login_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_personal_note_vulnerability_vulnerability_id",
                        column: x => x.vulnerability_id,
                        principalTable: "vulnerability",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_personal_note_login_id",
                table: "personal_note",
                column: "login_id");

            migrationBuilder.CreateIndex(
                name: "ix_personal_note_login_id_vulnerability_id",
                table: "personal_note",
                columns: new[] { "login_id", "vulnerability_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_personal_note_vulnerability_id",
                table: "personal_note",
                column: "vulnerability_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "personal_note");
        }
    }
}
