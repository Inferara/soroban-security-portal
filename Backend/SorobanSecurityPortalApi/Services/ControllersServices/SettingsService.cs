using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;
using Json.Schema.Generation;
using SorobanSecurityPortalApi.Common.Extensions;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class SettingsService : ISettingsService
    {
        private readonly ExtendedConfig _extendedConfig;
        private readonly IInstanceSync _instanceSync;
        private readonly ISettingsProcessor _settingsProcessor;

        public SettingsService(
            ExtendedConfig extendedConfig,
            IInstanceSync instanceSync,
            ISettingsProcessor settingsProcessor)
        {
            _extendedConfig = extendedConfig;
            _instanceSync = instanceSync;
            _settingsProcessor = settingsProcessor;
        }

        public List<SettingsViewModel> ListAll()
        {
            var props = typeof(ExtendedConfig)
                .GetProperties()
                .ToList();
            _extendedConfig.Reset();

            var settings = _settingsProcessor.Get(SettingType.Common);
            return props
                .Select(prop => new SettingsViewModel
                {
                    SettingId = prop.Name,
                    Value = settings.ContainsKey(prop.Name)
                        ? settings[prop.Name]
                        : prop.GetValue(_extendedConfig)?.ToString() ?? "",
                    Tooltip = prop.GetCustomAttributes(false).OfType<TooltipAttribute>().FirstOrDefault()?.TooltipText ?? "",
                    DateType = prop.GetCustomAttributes(false).OfType<DataTypeAttribute>().FirstOrDefault()?.DataType.ToString() ?? DataTypeAttribute.ConfigDataTypeEnum.String.ToString(),
                    Description = prop.GetCustomAttributes(false).OfType<DescriptionAttribute>().FirstOrDefault()?.Description ?? "",
                    Category = prop.GetCustomAttributes(false).OfType<CategoryAttribute>().FirstOrDefault()?.Category.GetDescription() ?? CategoryAttribute.ConfigCategoryEnum.Common.GetDescription(),
                    Options = prop.GetCustomAttributes(false).OfType<DataTypeAttribute>().FirstOrDefault()?.Options,
                })
                .ToList();

        }

        public void SaveAll(List<SettingsViewModel> settingsViewModels)
        {
            var settings = settingsViewModels
                .ToDictionary(x => x.SettingId, x => x.Value);
            _settingsProcessor.Set(SettingType.Common, settings);
            _extendedConfig.Reset();
        }

        public void Reboot()
        {
            _instanceSync.SetRestartNeeded();
        }

    }

    public interface ISettingsService
    {
        List<SettingsViewModel> ListAll();
        void SaveAll(List<SettingsViewModel> settingsViewModels);
        void Reboot();
    }
}
