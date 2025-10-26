using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateEntriesAuthorsCreators : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // vulnerability
            migrationBuilder.AddColumn<int>(
                name: "created_by",
                table: "vulnerability",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE vulnerability 
                SET created_by = login.login_id 
                FROM login 
                WHERE login.login = vulnerability.author");

            migrationBuilder.DropColumn(
                name: "author",
                table: "vulnerability");

            // report
            migrationBuilder.AddColumn<int>(
                name: "created_by",
                table: "report",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE report 
                SET created_by = login.login_id 
                FROM login 
                WHERE login.login = report.author");

            migrationBuilder.DropColumn(
                name: "author",
                table: "report");

            migrationBuilder.AddColumn<int>(
                name: "last_action_by_tmp",
                table: "report",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE report 
                SET last_action_by_tmp = login.login_id 
                FROM login 
                WHERE login.login = report.last_action_by");

            migrationBuilder.DropColumn(
                name: "last_action_by",
                table: "report");

            migrationBuilder.AddColumn<int>(
                name: "last_action_by",
                table: "report",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE report 
                SET last_action_by = last_action_by_tmp");

            migrationBuilder.DropColumn(
                name: "last_action_by_tmp",
                table: "report");

            // file
            migrationBuilder.AddColumn<int>(
                name: "created_by",
                table: "file",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE file 
                SET created_by = login.login_id 
                FROM login 
                WHERE login.login = file.author");

            migrationBuilder.DropColumn(
                name: "author",
                table: "file");

            // vulnerability
            migrationBuilder.AddColumn<int>(
                name: "last_action_by_tmp",
                table: "vulnerability",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE vulnerability 
                SET last_action_by_tmp = login.login_id 
                FROM login 
                WHERE login.login = vulnerability.last_action_by");

            migrationBuilder.DropColumn(
                name: "last_action_by",
                table: "vulnerability");

            migrationBuilder.AddColumn<int>(
                name: "last_action_by",
                table: "vulnerability",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE vulnerability 
                SET last_action_by = last_action_by_tmp");

            migrationBuilder.DropColumn(
                name: "last_action_by_tmp",
                table: "vulnerability");

            // protocol

            migrationBuilder.AddColumn<int>(
                name: "created_by_tmp",
                table: "protocol",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE protocol 
                SET created_by_tmp = login.login_id 
                FROM login 
                WHERE login.login = protocol.created_by");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "protocol");

            migrationBuilder.AddColumn<int>(
                name: "created_by",
                table: "protocol",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE protocol 
                SET created_by = created_by_tmp");

            migrationBuilder.DropColumn(
                name: "created_by_tmp",
                table: "protocol");

            // company

            migrationBuilder.AddColumn<int>(
                name: "created_by_tmp",
                table: "company",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE company 
                SET created_by_tmp = login.login_id 
                FROM login 
                WHERE login.login = company.created_by");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "company");

            migrationBuilder.AddColumn<int>(
                name: "created_by",
                table: "company",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE company 
                SET created_by = created_by_tmp");

            migrationBuilder.DropColumn(
                name: "created_by_tmp",
                table: "company");

            //auditor

            migrationBuilder.AddColumn<int>(
                name: "created_by_tmp",
                table: "auditor",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE auditor 
                SET created_by_tmp = login.login_id 
                FROM login 
                WHERE login.login = auditor.created_by");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "auditor");

            migrationBuilder.AddColumn<int>(
                name: "created_by",
                table: "auditor",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
                UPDATE auditor 
                SET created_by = created_by_tmp");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 10, 26, 4, 6, 7, 986, DateTimeKind.Utc).AddTicks(2366) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "created_by",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "report");

            migrationBuilder.DropColumn(
                name: "created_by",
                table: "file");

            migrationBuilder.AlterColumn<string>(
                name: "last_action_by",
                table: "vulnerability",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "author",
                table: "vulnerability",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "last_action_by",
                table: "report",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "author",
                table: "report",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "created_by",
                table: "protocol",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "author",
                table: "file",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "created_by",
                table: "company",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<string>(
                name: "created_by",
                table: "auditor",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 9, 28, 1, 35, 57, 456, DateTimeKind.Utc).AddTicks(6086) });
        }
    }
}
