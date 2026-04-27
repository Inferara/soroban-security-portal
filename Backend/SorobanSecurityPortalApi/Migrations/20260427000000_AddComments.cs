using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    public partial class AddComments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "comment",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    content = table.Column<string>(type: "text", nullable: false),
                    content_html = table.Column<string>(type: "text", nullable: false),
                    author_id = table.Column<int>(type: "integer", nullable: false),
                    entity_type = table.Column<int>(type: "integer", nullable: false),
                    entity_id = table.Column<int>(type: "integer", nullable: false),
                    parent_id = table.Column<int>(type: "integer", nullable: true),
                    is_edited = table.Column<bool>(type: "boolean", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_comment", x => x.id);
                    table.ForeignKey(
                        name: "fk_comment_login_author_id",
                        column: x => x.author_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_comment_comment_parent_id",
                        column: x => x.parent_id,
                        principalTable: "comment",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "comment_vote",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    comment_id = table.Column<int>(type: "integer", nullable: false),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    vote = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_comment_vote", x => x.id);
                    table.ForeignKey(
                        name: "fk_comment_vote_comment_comment_id",
                        column: x => x.comment_id,
                        principalTable: "comment",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_comment_vote_login_user_id",
                        column: x => x.user_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_comment_author_id",
                table: "comment",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_comment_entity_type_entity_id",
                table: "comment",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "ix_comment_parent_id",
                table: "comment",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "ix_comment_vote_comment_id_user_id",
                table: "comment_vote",
                columns: new[] { "comment_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_comment_vote_user_id",
                table: "comment_vote",
                column: "user_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "comment_vote");
            migrationBuilder.DropTable(name: "comment");
        }
    }
}
