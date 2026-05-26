using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "rating",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_hidden",
                table: "rating",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "rating");

            migrationBuilder.DropColumn(
                name: "is_hidden",
                table: "rating");
        }
    }
}
