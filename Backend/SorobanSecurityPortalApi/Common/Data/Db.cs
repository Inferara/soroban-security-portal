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
        public virtual DbSet<VulnerabilityModel> Vulnerability { get; set; }
        public virtual DbSet<ReportModel> Report { get; set; }
        public DbSet<SubscriptionModel> Subscription { get; set; }
        public DbSet<ProtocolModel> Protocol { get; set; }
        public DbSet<AuditorModel> Auditor { get; set; }
        public DbSet<CategoryModel> Category { get; set; }
        public DbSet<FileModel> File { get; set; }
        public DbSet<CompanyModel> Company { get; set; }
        public DbSet<BookmarkModel> Bookmark { get; set; }
        public DbSet<ModerationLogModel> ModerationLog { get; set; }
        public DbSet<UserProfileModel> UserProfiles { get; set; }
        public DbSet<ForumCategoryModel> ForumCategory { get; set; }
        public DbSet<ForumThreadModel> ForumThread { get; set; }
        public DbSet<ForumPostModel> ForumPost { get; set; }


        public virtual DbSet<RatingModel> Rating { get; set; }
        public DbSet<ContentFlagModel> ContentFlag { get; set; }
        public DbSet<ModerationActionModel> ModerationAction { get; set; }
        public virtual DbSet<CommentModel> Comment { get; set; }
        public virtual DbSet<VoteModel> Vote { get; set; }
        public virtual DbSet<MentionModel> Mention { get; set; }
        public virtual DbSet<NotificationModel> Notification { get; set; }
        public DbSet<PageViewModel> PageView { get; set; }
        public virtual DbSet<AgentRunModel> AgentRun { get; set; }
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
            builder.Entity<AuditorModel>()
                .Property(x => x.Embedding)
                .HasColumnType("vector(3072)");

            builder.Entity<CompanyModel>()
                .Property(x => x.Embedding)
                .HasColumnType("vector(3072)");

            builder.Entity<ProtocolModel>()
                .Property(x => x.Embedding)
                .HasColumnType("vector(3072)");

            builder.Entity<ReportModel>()
                .Property(x => x.Embedding)
                .HasColumnType("vector(3072)");

            builder.Entity<VulnerabilityModel>()
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

            // #134-L3: deleting a user (login) must NOT cascade-delete their forum
            // threads/posts (would wipe whole discussions). Use Restrict for author FKs.
            builder.Entity<ForumThreadModel>()
                .HasOne(t => t.Author)
                .WithMany()
                .HasForeignKey(t => t.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<ForumPostModel>()
                .HasOne(p => p.Author)
                .WithMany()
                .HasForeignKey(p => p.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

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

            builder.Entity<ContentFlagModel>()
                .HasIndex(f => new { f.ContentType, f.ContentId, f.FlaggedByUserId })
                .IsUnique();
            builder.Entity<ContentFlagModel>()
                .HasIndex(f => new { f.ContentType, f.ContentId });
            builder.Entity<ModerationActionModel>()
                .HasIndex(a => new { a.ContentType, a.ContentId, a.CreatedAt });
            builder.Entity<ModerationActionModel>()
                .HasIndex(a => a.CreatedAt);

            builder.Entity<CommentModel>()
                .HasIndex(c => new { c.EntityType, c.EntityId });
            builder.Entity<CommentModel>()
                .HasIndex(c => c.AuthorId);
            builder.Entity<CommentModel>()
                .HasIndex(c => c.ParentCommentId);

            builder.Entity<VoteModel>()
                .HasIndex(v => new { v.UserId, v.EntityType, v.EntityId })
                .IsUnique();
            builder.Entity<VoteModel>()
                .HasIndex(v => new { v.EntityType, v.EntityId });

            builder.Entity<MentionModel>()
                .HasIndex(m => m.CommentId);
            builder.Entity<MentionModel>()
                .HasIndex(m => m.MentionedUserId);

            builder.Entity<NotificationModel>()
                .HasIndex(n => new { n.RecipientUserId, n.CreatedAt });
            builder.Entity<NotificationModel>()
                .HasIndex(n => new { n.RecipientUserId, n.IsRead });

            builder.Entity<PageViewModel>()
                .HasIndex(p => new { p.EntityType, p.EntityId });
            builder.Entity<PageViewModel>()
                .HasIndex(p => p.ViewedAt);
            // Supports the per-day dedupe lookup (same visitor, same entity, same day).
            builder.Entity<PageViewModel>()
                .HasIndex(p => new { p.EntityType, p.EntityId, p.VisitorHash });

            builder.Entity<AgentRunModel>()
                .HasIndex(r => r.Status);
            builder.Entity<AgentRunModel>()
                .HasIndex(r => r.CreatedAt);
            // Agent-created reports/vulns must not vanish if a referenced report is deleted.
            builder.Entity<AgentRunModel>()
                .HasOne(r => r.Report)
                .WithMany()
                .HasForeignKey(r => r.ReportId)
                .OnDelete(DeleteBehavior.SetNull);

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
