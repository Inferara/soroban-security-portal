using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateTableRelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "pk_project",
                table: "project");

            migrationBuilder.RenameTable(
                name: "project",
                newName: "protocol");

            migrationBuilder.RenameColumn(
                name: "protocol",
                table: "report",
                newName: "protocol_legacy");

            migrationBuilder.RenameColumn(
                name: "auditor",
                table: "report",
                newName: "auditor_legacy");

            migrationBuilder.AddColumn<int>(
                name: "report_id",
                table: "vulnerability",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "auditor_id",
                table: "report",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "protocol_id",
                table: "report",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "company",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Vector>(
                name: "embedding",
                table: "company",
                type: "vector(3072)",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "image",
                table: "company",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "auditor",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Vector>(
                name: "embedding",
                table: "auditor",
                type: "vector(3072)",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "image",
                table: "auditor",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "protocol",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Vector>(
                name: "embedding",
                table: "protocol",
                type: "vector(3072)",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "image",
                table: "protocol",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "pk_protocol",
                table: "protocol",
                column: "id");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 8, 21, 9, 32, 16, 427, DateTimeKind.Utc).AddTicks(6818) });

            migrationBuilder.CreateIndex(
                name: "ix_vulnerability_report_id",
                table: "vulnerability",
                column: "report_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_auditor_id",
                table: "report",
                column: "auditor_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_protocol_id",
                table: "report",
                column: "protocol_id");

            migrationBuilder.CreateIndex(
                name: "ix_protocol_company_id",
                table: "protocol",
                column: "company_id");

            migrationBuilder.AddForeignKey(
                name: "fk_protocol_company_company_id",
                table: "protocol",
                column: "company_id",
                principalTable: "company",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_report_auditor_auditor_id",
                table: "report",
                column: "auditor_id",
                principalTable: "auditor",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_report_protocol_protocol_id",
                table: "report",
                column: "protocol_id",
                principalTable: "protocol",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_vulnerability_report_report_id",
                table: "vulnerability",
                column: "report_id",
                principalTable: "report",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_protocol_company_company_id",
                table: "protocol");

            migrationBuilder.DropForeignKey(
                name: "fk_report_auditor_auditor_id",
                table: "report");

            migrationBuilder.DropForeignKey(
                name: "fk_report_protocol_protocol_id",
                table: "report");

            migrationBuilder.DropForeignKey(
                name: "fk_vulnerability_report_report_id",
                table: "vulnerability");

            migrationBuilder.DropIndex(
                name: "ix_vulnerability_report_id",
                table: "vulnerability");

            migrationBuilder.DropIndex(
                name: "ix_report_auditor_id",
                table: "report");

            migrationBuilder.DropIndex(
                name: "ix_report_protocol_id",
                table: "report");

            migrationBuilder.DropPrimaryKey(
                name: "pk_protocol",
                table: "protocol");

            migrationBuilder.DropIndex(
                name: "ix_protocol_company_id",
                table: "protocol");

            migrationBuilder.DropColumn(
                name: "report_id",
                table: "vulnerability");

            migrationBuilder.DropColumn(
                name: "auditor_id",
                table: "report");

            migrationBuilder.DropColumn(
                name: "protocol_id",
                table: "report");

            migrationBuilder.DropColumn(
                name: "description",
                table: "company");

            migrationBuilder.DropColumn(
                name: "embedding",
                table: "company");

            migrationBuilder.DropColumn(
                name: "image",
                table: "company");

            migrationBuilder.DropColumn(
                name: "description",
                table: "auditor");

            migrationBuilder.DropColumn(
                name: "embedding",
                table: "auditor");

            migrationBuilder.DropColumn(
                name: "image",
                table: "auditor");

            migrationBuilder.DropColumn(
                name: "description",
                table: "protocol");

            migrationBuilder.DropColumn(
                name: "embedding",
                table: "protocol");

            migrationBuilder.DropColumn(
                name: "image",
                table: "protocol");

            migrationBuilder.RenameTable(
                name: "protocol",
                newName: "project");

            migrationBuilder.RenameColumn(
                name: "protocol_legacy",
                table: "report",
                newName: "protocol");

            migrationBuilder.RenameColumn(
                name: "auditor_legacy",
                table: "report",
                newName: "auditor");

            migrationBuilder.AddPrimaryKey(
                name: "pk_project",
                table: "project",
                column: "id");

            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 8, 17, 20, 14, 18, 705, DateTimeKind.Utc).AddTicks(4230) });
        }
    }
}
