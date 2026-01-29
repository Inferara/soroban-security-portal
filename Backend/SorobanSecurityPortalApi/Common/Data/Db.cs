using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Common.Data
{
    public class Db : DbContext
    {
        public DbSet<SettingsModel> Settings { get; set; }
        public DbSet<LoginModel> Login { get; set; }
        public DbSet<LoginHistoryModel> LoginHistory { get; set; }
        public DbSet<ClientSsoModel> ClientSso { get; set; }
        public DbSet<VulnerabilityModel> Vulnerability { get; set; }
        public DbSet<ReportModel> Report { get; set; }
        public DbSet<SubscriptionModel> Subscription { get; set; }
        public DbSet<ProtocolModel> Protocol { get; set; }
        public DbSet<AuditorModel> Auditor { get; set; }
        public DbSet<CategoryModel> Category { get; set; }
        public DbSet<FileModel> File { get; set; }
        public DbSet<CompanyModel> Company { get; set; }
        public DbSet<BookmarkModel> Bookmark { get; set; }
        public DbSet<ModerationLogModel> ModerationLog { get; set; }
        public DbSet<UserProfileModel> UserProfiles { get; set; }

        // Added for Issue #91: Badge System tables
        public DbSet<BadgeDefinitionModel> BadgeDefinitions { get; set; }
        public DbSet<UserBadgeModel> UserBadges { get; set; }

        private readonly IDbQuery _dbQuery;
        private readonly ILogger<Db> _logger;
        private readonly IDataSourceProvider _dataSourceProvider;

        public Db(IDbQuery dbQuery, ILogger<Db> logger, IDataSourceProvider dataSourceProvider)
        {
            _dbQuery = dbQuery;
            _logger = logger;
            _dataSourceProvider = dataSourceProvider;
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            /* After updating to EF Core version: 9.0.0, the error "The model for context 'Db' has pending changes." occurs.
            To avoid this error we suppress the corresponding warning
            Reference: https://github.com/dotnet/efcore/issues/34431
            */
            optionsBuilder.ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning));

            if (optionsBuilder.IsConfigured) return;
            optionsBuilder.UseNpgsql(_dataSourceProvider.DataSource, o => o.UseVector());
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            builder.HasPostgresExtension("vector");
            builder.Entity<ReportModel>()
                .Property(x => x.Embedding)
                .HasColumnType("vector(3072)");

            base.OnModelCreating(builder);

            builder.Entity<UserProfileModel>()
                .HasOne(up => up.Login)
                .WithOne(l => l.UserProfile)
                .HasForeignKey<UserProfileModel>(up => up.LoginId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<UserProfileModel>()
                .HasIndex(up => up.LoginId)
                .IsUnique();

            builder.HasDbFunction(typeof(TrigramExtensions).GetMethod(nameof(TrigramExtensions.TrigramSimilarity))!)
                .HasName("similarity"); // PostgreSQL built-in function

            // Existing logic to handle Postgres Snake Case naming
            foreach (var entity in builder.Model.GetEntityTypes())
            {
                var tableName = entity.GetTableName();
                if (tableName != null)
                    entity.SetTableName(tableName.ToSnakeCase());

                foreach (var property in entity.GetProperties())
                {
                    property.SetColumnName(property.Name.ToSnakeCase());
                }

                foreach (var key in entity.GetKeys())
                {
                    var keyName = key.GetName();
                    if (keyName != null)
                        key.SetName(keyName.ToSnakeCase());
                }

                foreach (var key in entity.GetForeignKeys())
                {
                    var constraintName = key.GetConstraintName();
                    if (constraintName != null)
                        key.SetConstraintName(constraintName.ToSnakeCase());
                }

                foreach (var index in entity.GetIndexes())
                {
                    var dbName = index.GetDatabaseName();
                    if (dbName != null)
                        index.SetDatabaseName(dbName.ToSnakeCase());
                }
            }

            // Seed Initial Badge Definitions for Issue #91
            builder.Entity<BadgeDefinitionModel>().HasData(
                new BadgeDefinitionModel { Id = Guid.Parse("00000000-0000-0000-0000-000000000001"), Name = "First Comment", Description = "Posted first comment", Icon = "🎉", Category = BadgeCategory.Participation, Criteria = "first_comment" },
                new BadgeDefinitionModel { Id = Guid.Parse("00000000-0000-0000-0000-000000000002"), Name = "Reporter", Description = "Submitted first report", Icon = "📝", Category = BadgeCategory.Contribution, Criteria = "first_report" },
                new BadgeDefinitionModel { Id = Guid.Parse("00000000-0000-0000-0000-000000000003"), Name = "Bug Hunter", Description = "Added first vulnerability", Icon = "🔍", Category = BadgeCategory.Contribution, Criteria = "first_vulnerability" },
                new BadgeDefinitionModel { Id = Guid.Parse("00000000-0000-0000-0000-000000000004"), Name = "Rising Star", Description = "Reached 100 reputation", Icon = "⭐", Category = BadgeCategory.Expertise, Criteria = "reputation:100" },
                new BadgeDefinitionModel { Id = Guid.Parse("00000000-0000-0000-0000-000000000005"), Name = "Top Contributor", Description = "Reached 1000 reputation", Icon = "🏆", Category = BadgeCategory.Expertise, Criteria = "reputation:1000" },
                new BadgeDefinitionModel { Id = Guid.Parse("00000000-0000-0000-0000-000000000006"), Name = "Helpful", Description = "10 upvoted comments", Icon = "💬", Category = BadgeCategory.Community, Criteria = "upvoted_comments:10" }
            );

            builder.Entity<LoginModel>().HasData(
                new LoginModel
                {
                    LoginId = 1,
                    CreatedBy = "system",
                    Login = "admin@sorobansecurity.com",
                    Email = "admin@sorobansecurity.com",
                    IsEnabled = true,
                    PasswordHash = "default".GetHash(),
                    LoginType = LoginTypeEnum.Password,
                    Role = RoleEnum.Admin,
                    FullName = "Admin",
                    Created = DateTime.UtcNow,
                });
        }
    }
}
