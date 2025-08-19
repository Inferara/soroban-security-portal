using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SorobanSecurityPortalApi.Models.DbModels;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class FillCompany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 8, 17, 20, 14, 18, 705, DateTimeKind.Utc).AddTicks(4230) });

            migrationBuilder.Sql(@"
                UPDATE 
                        vulnerability AS v
                    SET 
                        company = c.name
                    FROM 
                        project AS p
                    JOIN 
                        company AS c ON c.id = p.company_id
                    WHERE 
                        p.name = v.protocol;
                "); 
            
            migrationBuilder.Sql(@"
                UPDATE 
                        report AS r
                    SET 
                        company = c.name
                    FROM 
                        project AS p
                    JOIN 
                        company AS c ON c.id = p.company_id
                    WHERE 
                        p.name = r.protocol;
                ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "login",
                keyColumn: "login_id",
                keyValue: 1,
                columns: new[] { "connected_accounts", "created" },
                values: new object[] { new List<ConnectedAccountModel>(), new DateTime(2025, 8, 10, 14, 39, 39, 173, DateTimeKind.Utc).AddTicks(965) });
        }
    }
}
