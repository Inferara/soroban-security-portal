# Setting Up a Lightweight Kubernetes Cluster with K3s on Kamatera

We choose **K3s** over **Minik8s** due to its lightweight footprint and native support in Kamatera environments.

---

## 1. Provision a New Virtual Machine

Create a new VM on Kamatera with the following specs:

* **OS**: Ubuntu Linux
* **Series**: B series
* **CPU**: 1 vCPU
* **Memory**: 4 GB RAM
* **Storage**: 20 GB SSD

---

## 2. SSH Into the VM and Install K3s

Run the following command to install K3s:

```bash
curl -sfL https://get.k3s.io | sh -
```

This script installs and starts K3s, a lightweight Kubernetes distribution.

---

## 3. Install Midnight Commander (Optional)

Midnight Commander (MC) is a text-based file manager, useful for navigating the system:

```bash
apt-get update
apt-get install mc
```

Launch it using:

```bash
mc
```

---

## 4. Retrieve and Configure Kubeconfig

To connect to your K3s cluster remotely:

1. Navigate to the K3s config file:

   ```
   /etc/rancher/k3s/k3s.yaml
   ```

2. Download this file to your local machine.

3. **Important**: Replace all instances of `localhost` with the public IP address of your VM.

4. Use the updated kubeconfig file with `kubectl` on your local machine:

   ```bash
   export KUBECONFIG=/path/to/k3s.yaml
   kubectl get nodes
   ```

---

You're now ready to use your K3s cluster on Kamatera.