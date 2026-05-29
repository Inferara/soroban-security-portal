using AutoMapper;
using Microsoft.Extensions.Logging.Abstractions;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Tests.Services;

/// <summary>
/// Regression tests locking in the fix for #125: public profile endpoint must not leak PII.
/// </summary>
public class UserProfileServiceTests
{
    private readonly IMapper _mapper;

    public UserProfileServiceTests()
    {
        var config = new MapperConfiguration(
            mc => mc.AddProfile(new UserProfileModelProfile()),
            NullLoggerFactory.Instance);
        _mapper = config.CreateMapper();
    }

    // --- DTO shape: no PII fields allowed on the public view model ---

    [Fact]
    public void PublicUserProfileViewModel_DoesNotExposeEmail()
    {
        typeof(PublicUserProfileViewModel)
            .GetProperty("Email")
            .Should().BeNull("PublicUserProfileViewModel must not expose Email");
    }

    [Fact]
    public void PublicUserProfileViewModel_DoesNotExposeFullName()
    {
        typeof(PublicUserProfileViewModel)
            .GetProperty("FullName")
            .Should().BeNull("PublicUserProfileViewModel must not expose FullName");
    }

    [Fact]
    public void PublicUserProfileViewModel_DoesNotExposeConnectedAccounts()
    {
        typeof(PublicUserProfileViewModel)
            .GetProperty("ConnectedAccounts")
            .Should().BeNull("PublicUserProfileViewModel must not expose ConnectedAccounts");
    }

    // --- Mapping: LoginId round-trips; safe fields map correctly; PII is absent ---

    [Fact]
    public void Mapping_UserProfileModel_To_PublicViewModel_MapsLoginId()
    {
        var model = BuildUserProfileModel(loginId: 42);

        var vm = _mapper.Map<PublicUserProfileViewModel>(model);

        vm.LoginId.Should().Be(42);
    }

    [Fact]
    public void Mapping_UserProfileModel_To_PublicViewModel_MapsSafeFields()
    {
        var model = BuildUserProfileModel(loginId: 7,
            bio: "security researcher",
            location: "Berlin",
            website: "https://example.com",
            expertiseTags: new List<string> { "DeFi", "Soroban" },
            reputationScore: 100);

        var vm = _mapper.Map<PublicUserProfileViewModel>(model);

        vm.Bio.Should().Be("security researcher");
        vm.Location.Should().Be("Berlin");
        vm.Website.Should().Be("https://example.com");
        vm.ExpertiseTags.Should().BeEquivalentTo(new[] { "DeFi", "Soroban" });
        vm.ReputationScore.Should().Be(100);
    }

    [Fact]
    public void Mapping_UserProfileModel_WithPIIOnLogin_DoesNotLeakPIIIntoPublicViewModel()
    {
        // The Login navigation holds Email/FullName/ConnectedAccounts — none should
        // appear on the mapped PublicUserProfileViewModel, even when populated.
        var model = BuildUserProfileModel(loginId: 5);
        model.Login = new LoginModel
        {
            LoginId = 5,
            Email = "secret@example.com",
            FullName = "Alice Smith",
            ConnectedAccounts = new List<ConnectedAccountModel>
            {
                new() { ServiceName = "Google", AccountId = "g-12345" }
            }
        };

        var vm = _mapper.Map<PublicUserProfileViewModel>(model);

        // Verify via reflection: there is genuinely no pathway to the PII.
        var vmType = vm.GetType();
        vmType.GetProperty("Email").Should().BeNull();
        vmType.GetProperty("FullName").Should().BeNull();
        vmType.GetProperty("ConnectedAccounts").Should().BeNull();

        // And LoginId still round-trips correctly.
        vm.LoginId.Should().Be(5);
    }

    // --- Validation ordering: length error reported before scheme error for an oversized website ---

    [Fact]
    public async Task ValidateProfileDto_ReportsLengthError_BeforeSchemeError_ForOversizedWebsite()
    {
        // A value > 200 chars that is also not a valid http/https URL (e.g. just "x" * 201).
        // After the fix the length check fires first, so we get the length error.
        var oversized = new string('x', 201);
        var dto = new UpdateUserProfileViewModel { Website = oversized };

        var service = BuildService();
        // Invoke via the public surface: use CreateProfileAsync which calls ValidateProfileDto.
        // Since processor.ExistsAsync would be called only after validation, we only need the
        // validation result, which is surfaced as an Err result before any DB access.
        var result = await service.CreateProfileAsync(99, dto);

        result.Should().BeOfType<Result<UserProfileViewModel, string>.Err>();
        var err = (Result<UserProfileViewModel, string>.Err)result;
        err.Error.Should().Contain("200", because: "length error is reported before scheme error");
    }

    [Fact]
    public async Task ValidateProfileDto_ReportsSchemeError_WhenLengthIsAcceptableButSchemeIsWrong()
    {
        var dto = new UpdateUserProfileViewModel { Website = "ftp://example.com" };

        var service = BuildService();
        var result = await service.CreateProfileAsync(99, dto);

        result.Should().BeOfType<Result<UserProfileViewModel, string>.Err>();
        var err = (Result<UserProfileViewModel, string>.Err)result;
        err.Error.Should().Contain("http", because: "scheme error is reported for a short but invalid URL");
    }

    // --- Helpers ---

    private static UserProfileModel BuildUserProfileModel(
        int loginId = 1,
        string? bio = null,
        string? location = null,
        string? website = null,
        List<string>? expertiseTags = null,
        int reputationScore = 0)
    {
        return new UserProfileModel
        {
            Id = 100,
            LoginId = loginId,
            Login = new LoginModel { LoginId = loginId },
            Bio = bio,
            Location = location,
            Website = website,
            ExpertiseTags = expertiseTags ?? new List<string>(),
            ReputationScore = reputationScore,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private SorobanSecurityPortalApi.Services.ControllersServices.UserProfileService BuildService()
    {
        var processorMock = new Moq.Mock<SorobanSecurityPortalApi.Data.Processors.IUserProfileProcessor>();
        var loginMock = new Moq.Mock<SorobanSecurityPortalApi.Data.Processors.ILoginProcessor>();
        // ExistsAsync is never reached when validation fails — no setup needed.
        return new SorobanSecurityPortalApi.Services.ControllersServices.UserProfileService(
            processorMock.Object, loginMock.Object, _mapper);
    }

    // --- Public profile falls back to an empty profile for users without a profile row ---

    [Fact]
    public async Task GetPublicProfile_ReturnsEmptyProfile_ForExistingEnabledUserWithoutProfileRow()
    {
        var processorMock = new Moq.Mock<SorobanSecurityPortalApi.Data.Processors.IUserProfileProcessor>();
        processorMock.Setup(p => p.GetByLoginIdAsync(42)).ReturnsAsync((UserProfileModel?)null);
        var loginMock = new Moq.Mock<SorobanSecurityPortalApi.Data.Processors.ILoginProcessor>();
        loginMock.Setup(l => l.GetById(42)).ReturnsAsync(new LoginModel { LoginId = 42, IsEnabled = true });
        var service = new SorobanSecurityPortalApi.Services.ControllersServices.UserProfileService(
            processorMock.Object, loginMock.Object, _mapper);

        var result = await service.GetPublicProfileByLoginIdAsync(42);

        result.Should().NotBeNull();
        result!.LoginId.Should().Be(42);
        result.ReputationScore.Should().Be(0);
    }

    [Fact]
    public async Task GetPublicProfile_ReturnsNull_ForNonexistentUser()
    {
        var processorMock = new Moq.Mock<SorobanSecurityPortalApi.Data.Processors.IUserProfileProcessor>();
        processorMock.Setup(p => p.GetByLoginIdAsync(999)).ReturnsAsync((UserProfileModel?)null);
        var loginMock = new Moq.Mock<SorobanSecurityPortalApi.Data.Processors.ILoginProcessor>();
        loginMock.Setup(l => l.GetById(999)).ReturnsAsync((LoginModel?)null);
        var service = new SorobanSecurityPortalApi.Services.ControllersServices.UserProfileService(
            processorMock.Object, loginMock.Object, _mapper);

        (await service.GetPublicProfileByLoginIdAsync(999)).Should().BeNull();
    }
}
