// Mock data sources for data_view tables
export interface MockDataSourceColumn {
  name: string;
  type: string;
  description: string;
}

export interface MockDataSource {
  id: string;
  name: string;
  description: string;
  columns: MockDataSourceColumn[];
  sampleData: Record<string, any>[];
}

// Mock data for data_view tables
export const mockDataSources: Record<string, MockDataSource> = {
  'd2mio43q6gt6p380dis0': {
    id: 'd2mio43q6gt6p380dis0',
    name: 'pod_info_view',
    description: 'Pod 实例信息视图，包含 Pod 的基本信息和状态',
    columns: [
      { name: 'id', type: 'int64', description: '主键ID' },
      { name: 'pod_name', type: 'VARCHAR', description: 'Pod名称' },
      { name: 'pod_status', type: 'VARCHAR', description: 'Pod状态 (Running/Pending/Failed)' },
      { name: 'pod_node_name', type: 'VARCHAR', description: 'Pod所在节点名称' },
      { name: 'pod_namespace', type: 'VARCHAR', description: 'Pod所属命名空间' },
      { name: 'pod_ip', type: 'VARCHAR', description: 'Pod IP地址' },
      { name: 'pod_created_at', type: 'TIMESTAMP', description: 'Pod创建时间' },
    ],
    sampleData: [
      {
        id: 1,
        pod_name: 'nginx-abc123',
        pod_status: 'Running',
        pod_node_name: 'node-01',
        pod_namespace: 'default',
        pod_ip: '10.244.1.5',
        pod_created_at: '2024-01-15T10:30:00Z',
      },
      {
        id: 2,
        pod_name: 'redis-def456',
        pod_status: 'Running',
        pod_node_name: 'node-02',
        pod_namespace: 'default',
        pod_ip: '10.244.2.8',
        pod_created_at: '2024-01-15T11:20:00Z',
      },
      {
        id: 3,
        pod_name: 'app-ghi789',
        pod_status: 'Pending',
        pod_node_name: 'node-01',
        pod_namespace: 'production',
        pod_ip: '10.244.1.12',
        pod_created_at: '2024-01-15T12:00:00Z',
      },
    ],
  },
  'd2mio43q6gt6p380disg': {
    id: 'd2mio43q6gt6p380disg',
    name: 'node_info_view',
    description: 'Node 节点信息视图，包含节点的资源容量和状态',
    columns: [
      { name: 'id', type: 'int64', description: '主键ID' },
      { name: 'node_name', type: 'VARCHAR', description: '节点名称' },
      { name: 'node_status', type: 'VARCHAR', description: '节点状态 (Ready/NotReady)' },
      { name: 'node_cpu_capacity', type: 'VARCHAR', description: 'CPU总容量（核心数）' },
      { name: 'node_memory_capacity', type: 'VARCHAR', description: '内存总容量' },
      { name: 'node_cpu_allocatable', type: 'VARCHAR', description: '可分配的CPU（核心数）' },
      { name: 'node_memory_allocatable', type: 'VARCHAR', description: '可分配的内存' },
      { name: 'node_kubelet_version', type: 'VARCHAR', description: 'Kubelet版本' },
      { name: 'node_os_image', type: 'VARCHAR', description: '操作系统镜像' },
    ],
    sampleData: [
      {
        id: 1,
        node_name: 'node-01',
        node_status: 'Ready',
        node_cpu_capacity: '8',
        node_memory_capacity: '32Gi',
        node_cpu_allocatable: '7.5',
        node_memory_allocatable: '30Gi',
        node_kubelet_version: 'v1.28.0',
        node_os_image: 'Ubuntu 22.04',
      },
      {
        id: 2,
        node_name: 'node-02',
        node_status: 'Ready',
        node_cpu_capacity: '16',
        node_memory_capacity: '64Gi',
        node_cpu_allocatable: '15.5',
        node_memory_allocatable: '62Gi',
        node_kubelet_version: 'v1.28.0',
        node_os_image: 'Ubuntu 22.04',
      },
      {
        id: 3,
        node_name: 'node-03',
        node_status: 'NotReady',
        node_cpu_capacity: '8',
        node_memory_capacity: '32Gi',
        node_cpu_allocatable: '7.5',
        node_memory_allocatable: '30Gi',
        node_kubelet_version: 'v1.28.0',
        node_os_image: 'Ubuntu 22.04',
      },
    ],
  },
  'd2mio43q6gt6p380dith': {
    id: 'd2mio43q6gt6p380dith',
    name: 'service_info_view',
    description: 'Service 服务信息视图，包含服务的网络配置和路由信息',
    columns: [
      { name: 'id', type: 'int64', description: '主键ID' },
      { name: 'service_name', type: 'VARCHAR', description: 'Service名称' },
      { name: 'service_namespace', type: 'VARCHAR', description: 'Service所属命名空间' },
      { name: 'service_type', type: 'VARCHAR', description: 'Service类型 (ClusterIP/NodePort/LoadBalancer)' },
      { name: 'service_cluster_ip', type: 'VARCHAR', description: 'Cluster IP地址' },
      { name: 'service_ports', type: 'VARCHAR', description: '服务端口映射' },
      { name: 'service_selector', type: 'VARCHAR', description: 'Pod选择器标签' },
      { name: 'service_created_at', type: 'TIMESTAMP', description: 'Service创建时间' },
    ],
    sampleData: [
      {
        id: 1,
        service_name: 'nginx-service',
        service_namespace: 'default',
        service_type: 'ClusterIP',
        service_cluster_ip: '10.96.1.10',
        service_ports: '80/TCP',
        service_selector: 'app=nginx',
        service_created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 2,
        service_name: 'redis-service',
        service_namespace: 'default',
        service_type: 'ClusterIP',
        service_cluster_ip: '10.96.1.20',
        service_ports: '6379/TCP',
        service_selector: 'app=redis',
        service_created_at: '2024-01-15T11:00:00Z',
      },
    ],
  },
};

// Mock data for logic properties (metrics and operators)
export interface MockLogicPropertyData {
  [propertyName: string]: {
    type: 'metric' | 'operator';
    sampleValue: any;
  };
}

export const mockLogicPropertyData: Record<string, MockLogicPropertyData> = {
  pod: {
    pod_metrics: {
      type: 'metric',
      sampleValue: {
        cpu_usage: 45.2,
        memory_usage: 1024,
        memory_limit: 2048,
        cpu_cores: 0.5,
        network_rx_bytes: 1024000,
        network_tx_bytes: 512000,
        timestamp: '2024-01-15T12:30:00Z',
      },
    },
  },
  node: {
    node_health: {
      type: 'operator',
      sampleValue: {
        result: 'healthy',
        confidence: 0.95,
        checks: {
          kubelet: 'ok',
          container_runtime: 'ok',
          network: 'ok',
        },
        last_check: '2024-01-15T12:30:00Z',
      },
    },
  },
};

// Helper function to get mock data source by ID
export function getMockDataSource(dataSourceId: string): MockDataSource | undefined {
  return mockDataSources[dataSourceId];
}

// Helper function to get mock logic property data
export function getMockLogicPropertyData(entityId: string, propertyName: string): any | undefined {
  return mockLogicPropertyData[entityId]?.[propertyName]?.sampleValue;
}
