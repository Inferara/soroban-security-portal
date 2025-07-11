namespace SorobanSecurityPortalApi.Common
{
    public class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;

        public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (SorobanSecurityPortalUiException ex)
            {
                _logger.LogError(ex, "SorobanSecurityPortalUiException exception occurred.");
                await HandleUiExceptionAsync(context, ex);
            }
            catch (SorobanSecurityPortalAuthException ex)
            {
                await HandleAuthExceptionAsync(context, ex);
            }
            catch (OperationCanceledException ex)
            {
                // Do nothing. This is expected when the request is canceled.
            }
        }

        private static Task HandleUiExceptionAsync(HttpContext context, SorobanSecurityPortalUiException exception)
        {
            var response = new { message = exception.Message };
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            return context.Response.WriteAsJsonAsync(response);
        }

        private static Task HandleAuthExceptionAsync(HttpContext context, SorobanSecurityPortalAuthException exception)
        {
            var response = new { message = exception.Message };
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return context.Response.WriteAsJsonAsync(response);
        }

        public class SorobanSecurityPortalUiException : Exception
        {
            public SorobanSecurityPortalUiException(string message) : base(message)
            {
            }
        }

        public class SorobanSecurityPortalAuthException : Exception
        {
            public SorobanSecurityPortalAuthException(string message) : base(message)
            {
            }
        }
    }
}
