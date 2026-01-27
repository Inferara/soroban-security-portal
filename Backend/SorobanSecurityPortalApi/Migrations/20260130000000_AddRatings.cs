using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    public partial class AddRatings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "rating",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    entity_type = table.Column<int>(type: "integer", nullable: false),
                    entity_id = table.Column<int>(type: "integer", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    review = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rating", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_rating_entity_type_entity_id",
                table: "rating",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "ix_rating_user_id_entity_type_entity_id",
                table: "rating",
                columns: new[] { "user_id", "entity_type", "entity_id" },
                unique: true);

            migrationBuilder.Sql(@"
                CREATE MATERIALIZED VIEW rating_summaries AS
                SELECT 
                    entity_type,
                    entity_id,
                    COUNT(*) as total_reviews,
                    AVG(score) as average_score,
                    SUM(CASE WHEN score = 1 THEN 1 ELSE 0 END) as star1,
                    SUM(CASE WHEN score = 2 THEN 1 ELSE 0 END) as star2,
                    SUM(CASE WHEN score = 3 THEN 1 ELSE 0 END) as star3,
                    SUM(CASE WHEN score = 4 THEN 1 ELSE 0 END) as star4,
                    SUM(CASE WHEN score = 5 THEN 1 ELSE 0 END) as star5
                FROM rating
                GROUP BY entity_type, entity_id;
                
                CREATE UNIQUE INDEX ix_rating_summaries_type_id ON rating_summaries (entity_type, entity_id);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP MATERIALIZED VIEW IF EXISTS rating_summaries;");
            migrationBuilder.DropTable(name: "rating");
        }
    }
}