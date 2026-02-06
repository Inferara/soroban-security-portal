using System.Reflection;
using System.Text.RegularExpressions;

namespace SorobanSecurityPortalApi.Common.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddHttpClients(this IServiceCollection services)
        {   
            services.AddHttpClient("SorobanClient", (sp, client) =>
            {
                var ec = sp.GetRequiredService<ExtendedConfig>();
                
                client.BaseAddress = new Uri(ec.AppUrl); 
                client.DefaultRequestHeaders.Add("Accept", "application/json");
            });

            return services;
        }
        public static IRegistrationOfAssemblies ForInterfacesMatching(this IServiceCollection serviceCollection, string regex) => new Registration(serviceCollection) { Regex = regex };
    }

    public class Registration : IRegistrationOfAssemblies, IRegistrationReuseImplementations, IRegistrationServiceLifetime
    {
        private readonly IServiceCollection _serviceCollection;
        public string Regex { get; set; } = string.Empty;
        public List<Assembly> Assemblies { get; set; } = new();
        public Dictionary<Type, object> ReusableImplementations { get; set; } = new Dictionary<Type, object>();

        public Registration(IServiceCollection serviceCollection)
        {
            _serviceCollection = serviceCollection;
        }

        public IRegistrationReuseImplementations OfAssemblies(IEnumerable<Assembly> assemblies)
        {
            Assemblies = assemblies.ToList();
            return this;
        }

        public IRegistrationReuseImplementations OfAssemblies(Assembly assembly) => OfAssemblies(new List<Assembly> { assembly });

        public IRegistrationServiceLifetime UseWhenPossible(object obj)
        {
            ReusableImplementations.Add(obj.GetType(), obj);
            return this;
        }

        public IRegistrationServiceLifetime UseWhenPossible(List<object> objects)
        {
            objects.ForEach(obj => ReusableImplementations.Add(obj.GetType(), obj));
            return this;
        }

        public void AddSingletons() => Register(ServiceLifetime.Singleton);

        public void AddTransients() => Register(ServiceLifetime.Transient);

        public void AddScoped() => Register(ServiceLifetime.Scoped);

        private void Register(ServiceLifetime serviceLifetime)
        {
            var regex = new Regex(Regex);
            var interfaces = Assemblies
                .SelectMany(p => p.GetTypes())
                .SelectMany(p => p.GetInterfaces())
                .Where(p => regex.IsMatch(p.Name))
                .ToList();
            foreach (var interfaceValue in interfaces)
            {
                if (interfaceValue.Namespace?.StartsWith("System") == true ||
                    interfaceValue.Namespace?.StartsWith("Microsoft") == true ||
                    interfaceValue.Name == "IRegistrationOfAssemblies" ||
                    interfaceValue.Name == "IRegistrationReuseImplementations" ||
                    interfaceValue.Name == "IRegistrationServiceLifetime" ||
                    _serviceCollection.Any(s => s.ServiceType == interfaceValue))
                {
                    continue;
                }
                var impl = Assemblies.SelectMany(p => p.GetTypes()).FirstOrDefault(t => interfaceValue.IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);
                if (impl == null)
                {
                    continue;
                }
                _serviceCollection.Add(ReusableImplementations.ContainsKey(impl)
                    ? new ServiceDescriptor(interfaceValue, ReusableImplementations[impl])
                    : new ServiceDescriptor(interfaceValue, impl, serviceLifetime));
            }
        }
    }

    public interface IRegistrationOfAssemblies
    {
        IRegistrationReuseImplementations OfAssemblies(IEnumerable<Assembly> assemblies);
        IRegistrationReuseImplementations OfAssemblies(Assembly assembly);
    }

    public interface IRegistrationReuseImplementations
    {
        void AddSingletons();
        void AddTransients();
        void AddScoped();
        IRegistrationServiceLifetime UseWhenPossible(object obj);
        IRegistrationServiceLifetime UseWhenPossible(List<object> objects);
    }

    public interface IRegistrationServiceLifetime
    {
        void AddSingletons();
        void AddTransients();
        void AddScoped();
    }
}
