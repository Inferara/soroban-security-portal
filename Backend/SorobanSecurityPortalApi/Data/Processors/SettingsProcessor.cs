using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors;

public class SettingsProcessor : ISettingsProcessor
{
    private readonly IDbContextFactory<Db> _dbFactory;

    public SettingsProcessor(IDbContextFactory<Db> dbFactor)
    {
        _dbFactory = dbFactor;
    }

    public Dictionary<string, string> Get(SettingType settingType, int? entityId = null)
    {
        using var db = _dbFactory.CreateDbContext();
        var settingValue = db.Settings.AsNoTracking().FirstOrDefault(item => item.SettingsType == settingType && item.EntityId == entityId);
        if (settingValue?.Content != null)
        {
            return settingValue.Content;
        }
        return new Dictionary<string, string>();
    }

    public void Set(SettingType settingType, Dictionary<string, string> value, int? entityId = null)
    {
        using var db = _dbFactory.CreateDbContext();
        var settingValue = db.Settings.FirstOrDefault(item => item.SettingsType == settingType && item.EntityId == entityId);
        if (settingValue == null)
        {
            settingValue = new SettingsModel
            {
                SettingsType = settingType,
                EntityId = entityId,
                Content = value
            };
            db.Settings.Add(settingValue);
        }
        else
        {
            settingValue.Content = value;
        }
        db.SaveChanges();
    }
}

public interface ISettingsProcessor
{
    Dictionary<string, string> Get(SettingType settingType, int? entityId = null);
    void Set(SettingType settingType, Dictionary<string, string> value, int? entityId = null);
}