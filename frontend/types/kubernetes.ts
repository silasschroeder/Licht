export interface Pod {
  name: string;
  namespace: string;
  ready: string;
  status: string;
  restart: number;
  age: string;
  ip: string;
  node: string;
  createdAt?: string | null;
  uid?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
  spec?: {
    containers?: any[];
    initContainers?: any[];
    nodeName?: string;
  };
  status_obj?: {
    phase?: string;
    podIP?: string;
    containerStatuses?: any[];
    initContainerStatuses?: any[];
    startTime?: string;
  };
}

export interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs: string;
  ports: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface Deployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: string;
  available: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface Node {
  name: string;
  status: string;
  roles: string;
  age: string;
  version: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    creationTimestamp?: string;
  };
  Name?: string;
}

export interface Namespace {
  name: string;
  status: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    creationTimestamp?: string;
  };
  Name?: string;
}

export interface ReplicaSet {
  name: string;
  namespace: string;
  desired: string;
  current: string;
  ready: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface StatefulSet {
  name: string;
  namespace: string;
  ready: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface DaemonSet {
  name: string;
  namespace: string;
  desired: string;
  current: string;
  ready: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface Job {
  name: string;
  namespace: string;
  completions: string;
  duration: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface CronJob {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  lastSchedule: string;
  age: string;
  createdAt?: string | null;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
}

export interface ResourceData {
  pods: Pod[];
  services: Service[];
  deployments: Deployment[];
  replicaSets: ReplicaSet[];
  statefulSets: StatefulSet[];
  daemonSets: DaemonSet[];
  jobs: Job[];
  cronJobs: CronJob[];
}

export type ResourceType =
  | "pods"
  | "services"
  | "deployments"
  | "replicaSets"
  | "statefulSets"
  | "daemonSets"
  | "jobs"
  | "cronJobs";

export type ResourceItem =
  | Pod
  | Service
  | Deployment
  | ReplicaSet
  | StatefulSet
  | DaemonSet
  | Job
  | CronJob;
