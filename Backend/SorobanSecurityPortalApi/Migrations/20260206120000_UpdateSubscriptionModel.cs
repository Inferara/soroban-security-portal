using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorobanSecurityPortalApi.Migrations
{
    public partial class UpdateSubscriptionModel : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "subscription",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<int>(name: "UserId", table: "subscription", type: "integer", nullable: true);
            migrationBuilder.AddColumn<int>(name: "ProtocolId", table: "subscription", type: "integer", nullable: true);
            migrationBuilder.AddColumn<int>(name: "CategoryId", table: "subscription", type: "integer", nullable: true);

            migrationBuilder.CreateIndex(name: "IX_subscription_UserId", table: "subscription", column: "UserId");
            migrationBuilder.CreateIndex(name: "IX_subscription_ProtocolId", table: "subscription", column: "ProtocolId");
            migrationBuilder.CreateIndex(name: "IX_subscription_CategoryId", table: "subscription", column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_subscription_login_UserId",
                table: "subscription",
                column: "UserId",
                principalTable: "login",
                principalColumn: "LoginId");

            migrationBuilder.AddForeignKey(
                name: "FK_subscription_protocol_ProtocolId",
                table: "subscription",
                column: "ProtocolId",
                principalTable: "protocol",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_subscription_category_CategoryId",
                table: "subscription",
                column: "CategoryId",
                principalTable: "category",
                principalColumn: "Id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_subscription_login_UserId", table: "subscription");
            migrationBuilder.DropForeignKey(name: "FK_subscription_protocol_ProtocolId", table: "subscription");
            migrationBuilder.DropForeignKey(name: "FK_subscription_category_CategoryId", table: "subscription");

            migrationBuilder.DropIndex(name: "IX_subscription_UserId", table: "subscription");
            migrationBuilder.DropIndex(name: "IX_subscription_ProtocolId", table: "subscription");
            migrationBuilder.DropIndex(name: "IX_subscription_CategoryId", table: "subscription");

            migrationBuilder.DropColumn(name: "UserId", table: "subscription");
            migrationBuilder.DropColumn(name: "ProtocolId", table: "subscription");
            migrationBuilder.DropColumn(name: "CategoryId", table: "subscription");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "subscription",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}