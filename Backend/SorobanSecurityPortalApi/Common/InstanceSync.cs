namespace SorobanSecurityPortalApi.Common;

public class InstanceSync: IInstanceSync
{
    private readonly ICacheAccessor _cacheAccessor;
    private readonly string _currentProcessId;
    public const int TtlInSeconds = 30;
    public class InstanceSyncKeys
    {
        public const string MainInstance = "MainInstance";
        public const string RestartNeeded = "RestartNeeded";
    }

    public InstanceSync(ICacheAccessor cacheAccessor)
    {
        _cacheAccessor = cacheAccessor;
        _cacheAccessor.KeyPrefix = "InstanceSync-";
        _currentProcessId = System.Diagnostics.Process.GetCurrentProcess().Id.ToString();
    }

    private bool _isMainInstance = false;
    public bool IsMainInstance
    {
        get
        {
            var mainInstanceId = _cacheAccessor.GetCacheValue(InstanceSyncKeys.MainInstance);
            if (string.IsNullOrEmpty(mainInstanceId))
            {
                _cacheAccessor.SetCacheValue(InstanceSyncKeys.MainInstance, _currentProcessId, TtlInSeconds);
                mainInstanceId = _cacheAccessor.GetCacheValue(InstanceSyncKeys.MainInstance);
                if (mainInstanceId == _currentProcessId)
                {
                    _isMainInstance = true;
                    return true;
                }
            }
            else if (mainInstanceId == _currentProcessId)
            {
                _cacheAccessor.SetCacheValue(InstanceSyncKeys.MainInstance, _currentProcessId, TtlInSeconds);
                _isMainInstance = true;
                return true;
            }
            _isMainInstance = false;
            return false;
            
        }
    }

    public void SendHeartbeat()
    {
        if (_isMainInstance)
        {
            _cacheAccessor.SetCacheValue(InstanceSyncKeys.MainInstance, _currentProcessId, TtlInSeconds);
        }
        else
        {
            var mainInstanceId = _cacheAccessor.GetCacheValue(InstanceSyncKeys.MainInstance);
            if (string.IsNullOrEmpty(mainInstanceId))
            {
                _cacheAccessor.SetCacheValue(InstanceSyncKeys.MainInstance, _currentProcessId, TtlInSeconds);
                mainInstanceId = _cacheAccessor.GetCacheValue(InstanceSyncKeys.MainInstance);
                if (mainInstanceId == _currentProcessId)
                {
                    _isMainInstance = true;
                }
            }
        }
    }

    public void SetRestartNeeded()
    {
        _cacheAccessor.SetCacheValue(InstanceSyncKeys.RestartNeeded, "true", TtlInSeconds);
    }

    public bool IsRestartNeeded()
    {
        return _cacheAccessor.GetCacheValue(InstanceSyncKeys.RestartNeeded) == "true";
    }
}

public interface IInstanceSync
{
    bool IsMainInstance { get; }
    void SendHeartbeat();
    void SetRestartNeeded();
    bool IsRestartNeeded();
}