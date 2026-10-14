import { describe, it, expect } from "vitest";
import { deriveProblems } from "./health";
import { ResourceData, Node } from "@/types/kubernetes";

function emptyData(): ResourceData {
  return {
    pods: [],
    services: [],
    deployments: [],
    replicaSets: [],
    statefulSets: [],
    daemonSets: [],
    jobs: [],
    cronJobs: [],
  };
}

const pod = (over: Partial<ResourceData["pods"][number]>) => ({
  name: "p",
  namespace: "ns",
  ready: "1/1",
  status: "Running",
  restart: 0,
  age: "1h",
  ip: "",
  node: "",
  ...over,
});

describe("deriveProblems", () => {
  it("flags a crashlooping pod as critical", () => {
    const d = emptyData();
    d.pods = [pod({ name: "boom", status: "CrashLoopBackOff" })];
    const [p] = deriveProblems(d, []);
    expect(p.sev).toBe("critical");
    expect(p.reason).toBe("CrashLoopBackOff");
    expect(p.view).toBe("pods");
  });

  it("flags a pending pod as warn, a healthy pod not at all", () => {
    const d = emptyData();
    d.pods = [pod({ status: "Pending" }), pod({ name: "ok" })];
    const problems = deriveProblems(d, []);
    expect(problems).toHaveLength(1);
    expect(problems[0].sev).toBe("warn");
  });

  it("flags a degraded deployment (0 available = critical)", () => {
    const d = emptyData();
    d.deployments = [
      { name: "api", namespace: "ns", ready: "0/3", upToDate: "3", available: "0", age: "1h" },
    ];
    const [p] = deriveProblems(d, []);
    expect(p.sev).toBe("critical");
    expect(p.reason).toBe("No replicas available");
  });

  it("ignores nodes with blank status (SSE updates) but flags NotReady", () => {
    const blank: Node = { name: "n1", status: "", roles: "", age: "", version: "" };
    const bad: Node = { name: "n2", status: "NotReady", roles: "", age: "", version: "" };
    const problems = deriveProblems(emptyData(), [blank, bad]);
    expect(problems).toHaveLength(1);
    expect(problems[0].name).toBe("n2");
    expect(problems[0].sev).toBe("critical");
  });

  it("sorts critical before warn", () => {
    const d = emptyData();
    d.pods = [pod({ name: "warn", status: "Pending" }), pod({ name: "crit", status: "Failed" })];
    const problems = deriveProblems(d, []);
    expect(problems[0].sev).toBe("critical");
    expect(problems[1].sev).toBe("warn");
  });
});
