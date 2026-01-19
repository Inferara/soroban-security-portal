using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SorobanSecurityPortalApi.Authorization.Attributes
{
    public class RoleAuthorizeAttribute : Attribute, IAuthorizationFilter
    {
        private readonly Role[] _roles;
        public RoleAuthorizeAttribute(params Role[] roles)
        {
            _roles = roles;
        }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var httpContext = context.HttpContext;
            var user = httpContext.User;

            var attributeHelper = httpContext.RequestServices.GetRequiredService<IAttributeHelper>();
            if (user?.Identity == null || !user.Identity.IsAuthenticated)
            {
                if (!attributeHelper.TryAuthenticateUserFromToken(httpContext, out user) || user == null)
                {
                    context.Result = new UnauthorizedResult();
                    return;
                }
            }

            var role = user.FindFirstValue(ClaimTypes.Role);
            if (string.IsNullOrEmpty(role) || !_roles.Contains((Role)Enum.Parse(typeof(Role), role)))
            {
                context.Result = new UnauthorizedResult();
            }
        }
    }

    public enum Role
    {
        User = 1,
        Admin = 2,
        Contributor = 3,
        Moderator = 4
    }
}