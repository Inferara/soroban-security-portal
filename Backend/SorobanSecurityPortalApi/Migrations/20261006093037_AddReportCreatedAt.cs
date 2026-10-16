using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddReportCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "created_at",
                table: "report",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            // Backfill existing rows. The portal never recorded when a report was added, so for rows
            // created before this column existed use the best available proxy: the earlier of the
            // report's last action and the ingestion date of its first finding (vulnerability.date is
            // stamped at extraction time). That is at or before the real creation moment, unlike the
            // audit date (months earlier, which would hide recent uploads from the count) or now()
            // (which would make every existing report count as "new this month" for 30 days).
            migrationBuilder.Sql(@"
                UPDATE report r
                SET created_at = LEAST(
                    (SELECT MIN(v.date) FROM vulnerability v WHERE v.report_id = r.id),
                    r.last_action_at);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "created_at",
                table: "report");
        }
    }
}
