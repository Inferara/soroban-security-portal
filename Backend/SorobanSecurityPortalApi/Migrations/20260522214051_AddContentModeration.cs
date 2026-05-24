using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddContentModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "vulnerability",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_hidden",
                table: "vulnerability",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "report",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_hidden",
                table: "report",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "content_flag",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    content_type = table.Column<int>(type: "integer", nullable: false),
                    content_id = table.Column<int>(type: "integer", nullable: false),
                    flagged_by_user_id = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<int>(type: "integer", nullable: false),
                    comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_content_flag", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "moderation_action",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    content_type = table.Column<int>(type: "integer", nullable: false),
                    content_id = table.Column<int>(type: "integer", nullable: false),
                    moderator_id = table.Column<int>(type: "integer", nullable: false),
                    action = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_moderation_action", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_content_flag_content_type_content_id",
                table: "content_flag",
                columns: new[] { "content_type", "content_id" });

            migrationBuilder.CreateIndex(
                name: "ix_content_flag_content_type_content_id_flagged_by_user_id",
                table: "content_flag",
                columns: new[] { "content_type", "content_id", "flagged_by_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_moderation_action_content_type_content_id_created_at",
                table: "moderation_action",
                columns: new[] { "content_type", "content_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_moderation_action_created_at",
                table: "moderation_action",
                column: "created_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "content_flag");

            migrationBuilder.DropTable(
                name: "moderation_action");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "is_hidden",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "report");

            migrationBuilder.DropColumn(
                name: "is_hidden",
                table: "report");

        }
    }
}
