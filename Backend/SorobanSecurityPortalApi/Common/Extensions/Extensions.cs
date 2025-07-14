using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using JsonRepairUtils;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace SorobanSecurityPortalApi.Common.Extensions;

public static class Extensions
{
    public static string SqlSafe(this string? unsafeString) => unsafeString?.Replace("'", "''") ?? "";

    public static T? JsonGet<T>(this string value, string path = "")
    {
        if (string.IsNullOrEmpty(value))
            return default;
        try
        {
            var jToken = value.StartsWith("[") ? JArray.Parse(value) : JObject.Parse(value).SelectToken(path);
            return jToken == null ? default : jToken.ToObject<T>();
        }
        catch
        {
            return default;
        }
    }

    public static string? ToJson(this object? value, bool formatOutput = false)
    {
        if (value == null)
            return null;
        try
        {
            return JsonConvert.SerializeObject(value, formatOutput ? Formatting.Indented : Formatting.None);
        }
        catch
        {
            return null;
        }
    }

    public static bool IsJson(this string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;
        value = value.Trim();
        if ((value.StartsWith("{") && value.EndsWith("}")) || // Object
            (value.StartsWith("[") && value.EndsWith("]")))   // Array
        {
            try
            {
                JsonDocument.Parse(value);
                return true;
            }
            catch
            {
                return false;
            }
        }
        return false;
    }

    public static string FromBase64(this string base64EncodedData)
    {
        try
        {
            var base64EncodedBytes = Convert.FromBase64String(base64EncodedData);
            return Encoding.UTF8.GetString(base64EncodedBytes);
        }
        catch
        {
            return string.Empty;
        }
    }

    public static string GetHash(this string input) => Convert.ToBase64String(MD5.Create().ComputeHash(Encoding.UTF8.GetBytes(input)));

    public static string? GetLogin(this ControllerBase controllerBase)
    {
        if (controllerBase.HttpContext.User.Identity is not ClaimsIdentity identity)
            return null;
        var claims = identity.Claims.ToDictionary(key => key.Type, value => value.Value);
        var login = claims[ClaimTypes.NameIdentifier];
        return login;
    }

    public static string Sha256(this string input)
    {
        var hashString = new SHA256Managed();
        var bytes = Encoding.Default.GetBytes(input);
        var hash = hashString.ComputeHash(bytes);
        var sixteenBytes = new Byte[16];
        Array.Copy(hash, sixteenBytes, 16);
        // Safe Base64 encoding: https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce/call-your-api-using-the-authorization-code-flow-with-pkce
        return Convert.ToBase64String(sixteenBytes).Replace('+','-').Replace('/', '_').Trim('=');
    }

    public static string ToSnakeCase(this string input)
    {
        if (string.IsNullOrEmpty(input)) { return input; }
        var startUnderscores = Regex.Match(input, @"^_+");
        return startUnderscores + Regex.Replace(input, @"([a-z0-9])([A-Z])", "$1_$2").ToLower();
    }

    public static string ToCamelCase(this string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;
        var cleanedText = Regex.Replace(text, @"[^a-zA-Z0-9\s]", "");
        var words = cleanedText.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(words.Select((word, index) => index == 0 ? word.ToLower() : char.ToUpper(word[0]) + word.Substring(1).ToLower()));
    }

    public static SymmetricSecurityKey GetSymmetricSecurityKey(this string input) => 
        new(Encoding.UTF8.GetBytes(input));

    public static string UniqueId(this string id)
    {
        if (id == null)
        {
            throw new ArgumentNullException(nameof(id));
        }
        var data = Convert.ToBase64String(Encoding.UTF8.GetBytes(id));
        var sb = new StringBuilder();
        foreach (var c in data)
        {
            switch (c)
            {
                case '+':
                    sb.Append('-');
                    break;
                case '/':
                    sb.Append('_');
                    break;
                case '=':
                    break;
                default:
                    sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }

    public static string GetDescription(this Enum genericEnum)
    {
        var genericEnumType = genericEnum.GetType();
        var memberInfo = genericEnumType.GetMember(genericEnum.ToString());
        if (memberInfo.Length > 0)
        {
            var customAttributes = memberInfo[0].GetCustomAttributes(typeof(System.ComponentModel.DescriptionAttribute), false);
            if (customAttributes.Length > 0)
            {
                return ((System.ComponentModel.DescriptionAttribute)customAttributes.ElementAt(0)).Description;
            }
        }
        return genericEnum.ToString();
    }

    public static string EncodeCharacters(this string value)
    {
        var sb = new StringBuilder();
        foreach (var c in value)
        {
            sb.Append(c < 65 || c > 122 ? "\\\\u" + ((int)c).ToString("x4") : c);
        }
        return sb.ToString();
    }

    public static string DecodeCharacters(this string value) => 
        Regex.Replace(value, @"\\\\u(?<Value>[a-zA-Z0-9]{4})", m => ((char)int.Parse(m.Groups["Value"].Value, NumberStyles.HexNumber)).ToString());


    public static string FixJsonSyntax(this string? json)
    {
        // No answer - try one more time
        if (string.IsNullOrEmpty(json))
            return string.Empty;
        // Sometimes we have description after JSON, so we need to remove it
        var braceFirstIndex = json.IndexOf("{", StringComparison.InvariantCulture);
        var braceLastIndex = json.LastIndexOf("}", StringComparison.InvariantCulture);
        // No brace - not a JSON, try one more time
        if (braceLastIndex == -1 || braceFirstIndex == -1)
            return string.Empty;
        // Remove all after last brace
        if (braceLastIndex != json.Length - 1)
        {
            json = json.Remove(braceLastIndex + 1);
        }
        // Remove all before first brace
        if (braceFirstIndex != 0)
        {
            json = json.Remove(0, braceFirstIndex);
        }
        json = new JsonRepair().Repair(json);
        return json;
    }

    public static string StripBase64(this string base64Data)
    {
        var base64Span = base64Data.AsSpan();
        var base64Index = base64Span.IndexOf(";base64,");
        if (base64Index == -1)
            return base64Data;
        return new string(base64Span[(base64Index + 8)..]);
    }

    private static readonly Random Random = new Random();
    public static T GetRandomElement<T>(this List<T> list)
    {
        if (list == null || list.Count == 0)
        {
            throw new ArgumentException("List cannot be null or empty.");
        }

        int index = Random.Next(list.Count);
        return list[index];
    }

    public static bool IsPdf(this byte[] fileBytes)
    {
        // Check if the byte array starts with the PDF file signature "%PDF"
        if (fileBytes == null || fileBytes.Length < 4)
            return false;

        return fileBytes[0] == 0x25 && // %
               fileBytes[1] == 0x50 && // P
               fileBytes[2] == 0x44 && // D
               fileBytes[3] == 0x46;   // F
    }
}