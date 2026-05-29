using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentRunReportMeta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "auditor_name",
                table: "agent_run",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "protocol_name",
                table: "agent_run",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "report_date",
                table: "agent_run",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "report_title",
                table: "agent_run",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 5, 29, 21, 48, 51, 136, DateTimeKind.Utc).AddTicks(2743) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "auditor_name",
                table: "agent_run");

            migrationBuilder.DropColumn(
                name: "protocol_name",
                table: "agent_run");

            migrationBuilder.DropColumn(
                name: "report_date",
                table: "agent_run");

            migrationBuilder.DropColumn(
                name: "report_title",
                table: "agent_run");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2026, 5, 29, 17, 26, 5, 445, DateTimeKind.Utc).AddTicks(205) });
        }
    }
}
