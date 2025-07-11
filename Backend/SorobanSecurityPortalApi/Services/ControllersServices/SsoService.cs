using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Services.ControllersServices;

public class SsoService : ISsoService
{
    private readonly IMapper _mapper;
    private readonly IClientSsoProcessor _clientSsoProcessor;

    public SsoService(
        IMapper mapper,
        IClientSsoProcessor clientSsoProcessor)
    {
        _mapper = mapper;
        _clientSsoProcessor = clientSsoProcessor;
    }

    public async Task<ClientSsoViewModel?> GetClientById(int clientSsoId)
    {
        var clientSsoModel = await _clientSsoProcessor.Get(clientSsoId);
        if (clientSsoModel == null) return null;

        var clientSsoViewModel = _mapper.Map<ClientSsoViewModel>(clientSsoModel);
        return clientSsoViewModel;
    }

    public async Task<List<ClientSsoViewModel>> ListClients()
    {
        var clientSsoList = await _clientSsoProcessor.List();
        var clientSsoViewModelList = _mapper.Map<List<ClientSsoViewModel>>(clientSsoList);
        return clientSsoViewModelList;
    }

    public async Task DeleteClient(int clientSsoId)
    {
        await _clientSsoProcessor.Delete(clientSsoId);
    }

    public async Task<ClientSsoViewModel> AddClient(ClientSsoViewModel clientSsoViewModel)
    {
        var clientSsoModel = _mapper.Map<ClientSsoModel>(clientSsoViewModel);
        var addedClientSso = await _clientSsoProcessor.Add(clientSsoModel);
        var addedClientSsoViewModel = _mapper.Map<ClientSsoViewModel>(addedClientSso);
        return addedClientSsoViewModel;
    }

    public async Task<ClientSsoViewModel> UpdateClient(ClientSsoViewModel clientSsoViewModel)
    {
        var clientSsoModel = _mapper.Map<ClientSsoModel>(clientSsoViewModel);
        var updatedClientSso = await _clientSsoProcessor.Update(clientSsoModel);
        var updatedClientSsoViewModel = _mapper.Map<ClientSsoViewModel>(updatedClientSso);
        return updatedClientSsoViewModel;
    }
}

public interface ISsoService
{
    Task<ClientSsoViewModel?> GetClientById(int clientSsoId);
    Task<List<ClientSsoViewModel>> ListClients();
    Task DeleteClient(int clientSsoId);
    Task<ClientSsoViewModel> AddClient(ClientSsoViewModel clientSsoViewModel);
    Task<ClientSsoViewModel> UpdateClient(ClientSsoViewModel clientSsoViewModel);
}
