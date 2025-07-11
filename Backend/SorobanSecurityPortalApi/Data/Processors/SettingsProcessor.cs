using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors;

public class SettingsProcessor : ISettingsProcessor
{
    private readonly Db _db;
    private readonly IDbQuery _dbQuery;

    public SettingsProcessor(Db db, IDbQuery dbQuery)
    {
        _db = db;
        _dbQuery = dbQuery;
    }

    public Dictionary<string, string> Get(SettingType settingType, int? entityId = null)
    {
        var settingValue = _db.Settings.AsNoTracking().FirstOrDefault(item => item.SettingsType == settingType && item.EntityId == entityId);
        if (settingValue?.Content != null)
        {
            return settingValue.Content;
        }
        return new Dictionary<string, string>();
    }

    public void Set(SettingType settingType, Dictionary<string, string> value, int? entityId = null)
    {
        var settingValue = _db.Settings.FirstOrDefault(item => item.SettingsType == settingType && item.EntityId == entityId);
        if (settingValue == null)
        {
            settingValue = new SettingsModel
            {
                SettingsType = settingType,
                EntityId = entityId,
                Content = value
            };
            _db.Settings.Add(settingValue);
        }
        else
        {
            settingValue.Content = value;
        }
        _db.SaveChanges();
    }
}

public interface ISettingsProcessor
{
    Dictionary<string, string> Get(SettingType settingType, int? entityId = null);
    void Set(SettingType settingType, Dictionary<string, string> value, int? entityId = null);
}