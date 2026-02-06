using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

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
        public DbSet<MentionModel> Mention { get; set; }
        public DbSet<NotificationModel> Notification { get; set; }
        public DbSet<ModerationLogModel> ModerationLog { get; set; }
        public DbSet<UserProfileModel> UserProfiles { get; set; }
        public DbSet<ForumCategoryModel> ForumCategory { get; set; }
        public DbSet<ForumThreadModel> ForumThread { get; set; }
        public DbSet<ForumPostModel> ForumPost { get; set; }


        public virtual DbSet<RatingModel> Rating { get; set; }
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
            /* 
            After updating to EF Core version: 9.0.0, the error "The model for context 'Db' has pending changes." occurs.
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
            builder.Entity<ForumCategoryModel>()
                .HasIndex(c => c.Slug)
                .IsUnique();

            builder.Entity<ForumThreadModel>()
                .HasIndex(t => t.Slug)
                .IsUnique();
            builder.Entity<ForumThreadModel>()
                .HasIndex(t => new { t.CategoryId, t.IsPinned, t.CreatedAt });

            builder.Entity<ForumPostModel>()
                .HasIndex(p => new { p.ThreadId, p.CreatedAt });
            var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

            builder.Entity<ForumCategoryModel>().HasData(
                new ForumCategoryModel 
                { 
                    Id = 1, 
                    Name = "General", 
                    Slug = "general", 
                    Description = "General discussions about the portal.", 
                    SortOrder = 1, 
                    CreatedAt = seedDate 
                },
                new ForumCategoryModel 
                { 
                    Id = 2, 
                    Name = "Soroban Development", 
                    Slug = "soroban-development", 
                    Description = "Discussions about smart contract development.", 
                    SortOrder = 2, 
                    CreatedAt = seedDate 
                },
                new ForumCategoryModel 
                { 
                    Id = 3, 
                    Name = "Security Best Practices", 
                    Slug = "security-best-practices", 
                    Description = "Sharing security tips and patterns.", 
                    SortOrder = 3, 
                    CreatedAt = seedDate 
                },
                new ForumCategoryModel 
                { 
                    Id = 4, 
                    Name = "Vulnerability Discussions", 
                    Slug = "vulnerability-discussions", 
                    Description = "Deep dives into specific vulnerabilities.", 
                    SortOrder = 4, 
                    CreatedAt = seedDate 
                }
            );

            builder.Entity<RatingModel>()
                .HasIndex(r => new { r.UserId, r.EntityType, r.EntityId })
                .IsUnique();

            builder.Entity<RatingModel>()
                .HasIndex(r => new { r.EntityType, r.EntityId });

            builder.HasDbFunction(typeof(TrigramExtensions).GetMethod(nameof(TrigramExtensions.TrigramSimilarity))!)
                .HasName("similarity"); // PostgreSQL built-in function
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