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

            // Backfill existing rows. created_at means "when this report was added to the portal", and
            // the home page counter uses it to show what curators added recently. The portal never
            // recorded that moment for rows created before this column existed, so use the best
            // portal-side proxy available:
            //  - the ingestion date of the report's first finding (vulnerability.date is stamped
            //    when findings are extracted from the uploaded report), capped at last_action_at,
            //    since a report cannot be acted on before it exists;
            //  - last_action_at alone for reports that have no findings.
            // The audit date (report.date) is deliberately NOT used. It is the date the audit took
            // place, entered by the uploader, and says nothing about when the report reached the
            // portal: it is usually months earlier, can be corrected later, and could even be in the
            // future, which would keep a report in the "new this month" count indefinitely.
            // The now() cap guarantees no backfilled value is in the future, so any remaining
            // inaccuracy ages out of the one-month window on its own.
            migrationBuilder.Sql(@"
                UPDATE report r
                SET created_at = LEAST(
                    r.last_action_at,
                    now(),
                    COALESCE(
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
