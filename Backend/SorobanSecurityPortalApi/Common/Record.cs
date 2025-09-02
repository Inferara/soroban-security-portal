namespace SorobanSecurityPortalApi.Common
{
    public abstract record Result<T, E>
    {
        public sealed record Ok(T Value) : Result<T, E>;
        public sealed record Err(E Error) : Result<T, E>;
    }
}
