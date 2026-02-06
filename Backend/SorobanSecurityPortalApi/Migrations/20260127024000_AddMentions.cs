using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddMentions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mention",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    mentioned_user_id = table.Column<int>(type: "integer", nullable: false),
                    mentioned_by_user_id = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    entity_type = table.Column<string>(type: "text", nullable: false),
                    entity_id = table.Column<int>(type: "integer", nullable: false),
                    start_position = table.Column<int>(type: "integer", nullable: false),
                    end_position = table.Column<int>(type: "integer", nullable: false),
                    mentioned_username = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_mention", x => x.id);
                    table.ForeignKey(
                        name: "fk_mention_login_mentioned_by_user_id",
                        column: x => x.mentioned_by_user_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_mention_login_mentioned_user_id",
                        column: x => x.mentioned_user_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_mention_mentioned_by_user_id",
                table: "mention",
                column: "mentioned_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_mention_mentioned_user_id",
                table: "mention",
                column: "mentioned_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mention");
        }
    }
}