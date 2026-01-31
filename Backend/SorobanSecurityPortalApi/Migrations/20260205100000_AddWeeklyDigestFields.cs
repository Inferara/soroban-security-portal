using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddWeeklyDigestFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "receive_weekly_digest",
                table: "user_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_digest_sent_at",
                table: "user_profiles",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "receive_weekly_digest",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "last_digest_sent_at",
                table: "user_profiles");
        }
    }
}
