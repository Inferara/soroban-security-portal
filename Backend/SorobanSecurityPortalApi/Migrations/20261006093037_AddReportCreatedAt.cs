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
            // created before this column existed use the best available proxy: the ingestion date of
            // the report's first finding (vulnerability.date is stamped at extraction time), clamped
            // to [audit date, last action]. The clamp matters at both ends:
            //  - a finding can carry a client-supplied date older than the upload, so the audit date
            //    (which an upload can never precede) is the floor;
            //  - last_action_at is the ceiling, since a report cannot be acted on before it exists,
            //    and it is also the fallback for reports without findings.
            // Using the audit date alone (months earlier) would hide recent uploads from the count;
            // using now() would make every existing report count as "new this month" for 30 days.
            migrationBuilder.Sql(@"
                UPDATE report r
                SET created_at = GREATEST(
                    r.date,
                    LEAST(
                        (SELECT MIN(v.date) FROM vulnerability v WHERE v.report_id = r.id),
                        r.last_action_at));
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
