using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUserBadgeForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "user_id",
                table: "user_badges");

            migrationBuilder.AddColumn<int>(
                name: "user_profile_id",
                table: "user_badges",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 29, 1, 18, 36, 384, DateTimeKind.Utc).AddTicks(2530) });

            migrationBuilder.CreateIndex(
                name: "ix_user_badges_user_profile_id",
                table: "user_badges",
                column: "user_profile_id");

            migrationBuilder.AddForeignKey(
                name: "fk_user_badges_user_profiles_user_profile_id",
                table: "user_badges",
                column: "user_profile_id",
                principalTable: "user_profiles",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_user_badges_user_profiles_user_profile_id",
                table: "user_badges");

            migrationBuilder.DropIndex(
                name: "ix_user_badges_user_profile_id",
                table: "user_badges");

            migrationBuilder.DropColumn(
                name: "user_profile_id",
                table: "user_badges");

            migrationBuilder.AddColumn<string>(
                name: "user_id",
                table: "user_badges",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 1, 28, 23, 14, 18, 430, DateTimeKind.Utc).AddTicks(7509) });
        }
    }
}
