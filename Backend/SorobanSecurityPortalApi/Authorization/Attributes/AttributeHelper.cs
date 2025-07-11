using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Extensions;

namespace SorobanSecurityPortalApi.Authorization.Attributes
{
    public class AttributeHelper: IAttributeHelper
    {
        private readonly ExtendedConfig _extendedConfig;
        public AttributeHelper(ExtendedConfig extendedConfig)
        {
            _extendedConfig = extendedConfig;
        }

        public bool TryAuthenticateUserFromToken(HttpContext httpContext, out ClaimsPrincipal user)
        {
            user = null;
            var tokenFromQuery = httpContext.Request.Query["token"].FirstOrDefault();

            if (string.IsNullOrEmpty(tokenFromQuery))
                return false;

            var tokenHandler = new JwtSecurityTokenHandler();
            try
            {
                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = _extendedConfig.AuthSecurityKey.GetSymmetricSecurityKey(),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };

                user = tokenHandler.ValidateToken(tokenFromQuery, validationParameters, out _);
                httpContext.User = user;
                return true;
            }
            catch
            {
                return false;
            }
        }
    }

    public interface IAttributeHelper
    {
        bool TryAuthenticateUserFromToken(HttpContext httpContext, out ClaimsPrincipal user);
    }
}

