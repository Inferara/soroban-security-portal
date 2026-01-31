using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCommentSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "comments",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    author_id = table.Column<int>(type: "integer", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    entity_id = table.Column<int>(type: "integer", nullable: false),
                    parent_comment_id = table.Column<int>(type: "integer", nullable: true),
                    content = table.Column<string>(type: "text", nullable: false),
                    content_html = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    upvote_count = table.Column<int>(type: "integer", nullable: false),
                    downvote_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_comments_comments_parent_comment_id",
                        column: x => x.parent_comment_id,
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_comments_login_author_id",
                        column: x => x.author_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mentions",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    comment_id = table.Column<int>(type: "integer", nullable: false),
                    mentioned_user_id = table.Column<int>(type: "integer", nullable: false),
                    start_index = table.Column<int>(type: "integer", nullable: false),
                    length = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_mentions", x => x.id);
                    table.ForeignKey(
                        name: "fk_mentions_comments_comment_id",
                        column: x => x.comment_id,
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_mentions_login_mentioned_user_id",
                        column: x => x.mentioned_user_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 29, 14, 40, 12, 120, DateTimeKind.Utc).AddTicks(9158) });

            migrationBuilder.CreateIndex(
                name: "ix_comments_author",
                table: "comments",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_comments_entity",
                table: "comments",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "ix_comments_parent_comment_id",
                table: "comments",
                column: "parent_comment_id");

            migrationBuilder.CreateIndex(
                name: "ix_mentions_comment_id",
                table: "mentions",
                column: "comment_id");

            migrationBuilder.CreateIndex(
                name: "ix_mentions_mentioned_user_id",
                table: "mentions",
                column: "mentioned_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mentions");

            migrationBuilder.DropTable(
                name: "comments");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 29, 1, 18, 36, 384, DateTimeKind.Utc).AddTicks(2530) });
        }
    }
}
