using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateCategoryCreatedByField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "created_by_tmp",
                table: "category",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE category
                SET created_by_tmp = login.login_id 
                FROM login 
                WHERE login.login = category.created_by");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "category");

            migrationBuilder.RenameColumn(
                name: "created_by_tmp",
                table: "category",
                newName: "created_by");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 11, 9, 5, 20, 35, 49, DateTimeKind.Utc).AddTicks(5097) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "created_by",
                table: "category",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 10, 26, 4, 6, 7, 986, DateTimeKind.Utc).AddTicks(2366) });
        }
    }
}
