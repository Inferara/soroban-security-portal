using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    public partial class AddForumTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create ForumCategory Table
            migrationBuilder.CreateTable(
                name: "forum_category",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_locked = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_category", x => x.id);
                });

            // Create ForumThread Table
            migrationBuilder.CreateTable(
                name: "forum_thread",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    category_id = table.Column<int>(type: "integer", nullable: false),
                    author_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    slug = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_pinned = table.Column<bool>(type: "boolean", nullable: false),
                    is_locked = table.Column<bool>(type: "boolean", nullable: false),
                    view_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_thread", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_thread_forum_category_category_id",
                        column: x => x.category_id,
                        principalTable: "forum_category",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_thread_login_author_id",
                        column: x => x.author_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Create ForumPost Table
            migrationBuilder.CreateTable(
                name: "forum_post",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    thread_id = table.Column<int>(type: "integer", nullable: false),
                    author_id = table.Column<int>(type: "integer", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    is_first_post = table.Column<bool>(type: "boolean", nullable: false),
                    votes = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_post", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_post_forum_thread_thread_id",
                        column: x => x.thread_id,
                        principalTable: "forum_thread",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_post_login_author_id",
                        column: x => x.author_id,
                        principalTable: "login",
                        principalColumn: "login_id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Seed Data
            migrationBuilder.InsertData(
                table: "forum_category",
                columns: new[] { "id", "created_at", "description", "is_locked", "name", "slug", "sort_order" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "General discussions about the portal.", false, "General", "general", 1 },
                    { 2, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Discussions about smart contract development.", false, "Soroban Development", "soroban-development", 2 },
                    { 3, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Sharing security tips and patterns.", false, "Security Best Practices", "security-best-practices", 3 },
                    { 4, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Deep dives into specific vulnerabilities.", false, "Vulnerability Discussions", "vulnerability-discussions", 4 }
                });

            // Indexes
            migrationBuilder.CreateIndex(
                name: "ix_forum_category_slug",
                table: "forum_category",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_thread_slug",
                table: "forum_thread",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_thread_category_id_is_pinned_created_at",
                table: "forum_thread",
                columns: new[] { "category_id", "is_pinned", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_post_thread_id_created_at",
                table: "forum_post",
                columns: new[] { "thread_id", "created_at" });
                
            // FK Indexes
            migrationBuilder.CreateIndex(
                name: "ix_forum_thread_author_id",
                table: "forum_thread",
                column: "author_id");
                
            migrationBuilder.CreateIndex(
                name: "ix_forum_post_author_id",
                table: "forum_post",
                column: "author_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "forum_post");
            migrationBuilder.DropTable(name: "forum_thread");
            migrationBuilder.DropTable(name: "forum_category");
        }
    }
}