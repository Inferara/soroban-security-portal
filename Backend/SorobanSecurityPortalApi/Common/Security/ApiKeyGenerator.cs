using System.Security.Cryptography;
using System.Text;

namespace SorobanSecurityPortalApi.Common.Security
{
    // Creates and hashes API keys for the public surface.
    //
    // A key is "ssp_" followed by 40 random base62 characters (about 238 bits of entropy).
    // Because the key is long and random, a plain SHA-256 is the right hash: there is nothing
    // to brute-force, and the lookup on every request stays a single indexed equality.
    public static class ApiKeyGenerator
    {
        public const string Prefix = "ssp_";
        public const int RandomLength = 40;
        public const int DisplayPrefixLength = 12; // "ssp_" + first 8 random characters

        private const string Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

        public static string Generate()
        {
            var sb = new StringBuilder(Prefix, Prefix.Length + RandomLength);
            for (var i = 0; i < RandomLength; i++)
                sb.Append(Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]);
            return sb.ToString();
        }

        public static string Hash(string key)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(key));
            return Convert.ToHexStringLower(bytes);
        }

        public static string DisplayPrefix(string key) =>
            key.Length <= DisplayPrefixLength ? key : key[..DisplayPrefixLength];

        // Cheap shape check so obviously wrong tokens (for example a JWT) never reach the database.
        public static bool LooksLikeKey(string? value)
        {
            if (string.IsNullOrEmpty(value) || value.Length != Prefix.Length + RandomLength) return false;
            if (!value.StartsWith(Prefix, StringComparison.Ordinal)) return false;
            for (var i = Prefix.Length; i < value.Length; i++)
            {
                var c = value[i];
                if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))) return false;
            }
            return true;
        }
    }
}
