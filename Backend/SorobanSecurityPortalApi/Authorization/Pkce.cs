using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace SorobanSecurityPortalApi.Authorization;

public class Pkce
{
    public string CodeVerifier;
    public string CodeChallenge;

    public Pkce(uint size = 128)
    {
        CodeVerifier = GenerateCodeVerifier(size);
        CodeChallenge = GenerateCodeChallenge(CodeVerifier);
    }

    public static string GenerateCodeVerifier(uint size = 128)
    {
        if (size < 43 || size > 128)
            size = 128;
        const string unreservedCharacters =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        return RandomNumberGenerator.GetString(unreservedCharacters, (int) size);
    }

    public static string GenerateCodeChallenge(string codeVerifier)
    {
        var challengeBytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(codeVerifier));
        return Base64UrlEncoder.Encode(challengeBytes);
    }
}