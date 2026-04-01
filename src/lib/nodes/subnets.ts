// ---------------------------------------------------------------------------
// Subnet Specialization — Bittensor-Inspired Node Grouping
// ---------------------------------------------------------------------------
// Groups OpenClaw nodes by specialization (inference, code, vision, etc.)
// to enable intelligent routing based on request type.
//
// Features:
//   - Auto-assignment based on node capabilities and observed performance
//   - Weighted node selection within subnets (reputation, latency, availability)
//   - Health monitoring per subnet
//   - Dynamic subnet membership as nodes come online/offline
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { REPUTATION_CONFIG } from './reliability';

// ── Types ────────────────────────────────────────────────────────────────

export type SubnetType =
  | 'inference'
  | 'training'
  | 'embedding'
  | 'code'
  | 'vision'
  | 'multimodal'
  | 'research';

export const ALL_SUBNET_TYPES: SubnetType[] = [
  'inference',
  'training',
  'embedding',
  'code',
  'vision',
  'multimodal',
  'research',
];

export interface Subnet {
  id: string;
  type: SubnetType;
  name: string;
  description: string;
  nodes: string[];
  totalCapacityTflops: number;
  activeRequests: number;
  avgLatencyMs: number;
  avgReputationScore: number;
  models: string[];
  createdAt: Date;
}

export interface SubnetAssignment {
  nodeId: string;
  subnets: SubnetType[];
  primarySubnet: SubnetType;
  performance: Record<
    SubnetType,
    { requests: number; avgLatencyMs: number; errorRate: number }
  >;
}

export interface SubnetHealth {
  online: number;
  total: number;
  avgLatency: number;
  capacity: number;
}

// ── Subnet Metadata ─────────────────────────────────────────────────────

const SUBNET_META: Record<SubnetType, { name: string; description: string }> = {
  inference: {
    name: 'Inference Subnet',
    description: 'General-purpose text generation and chat completion',
  },
  training: {
    name: 'Training Subnet',
    description: 'Fine-tuning and training workloads (high VRAM nodes)',
  },
  embedding: {
    name: 'Embedding Subnet',
    description: 'Text and multimodal embedding generation',
  },
  code: {
    name: 'Code Subnet',
    description: 'Code generation, completion, and analysis',
  },
  vision: {
    name: 'Vision Subnet',
    description: 'Image understanding and visual reasoning',
  },
  multimodal: {
    name: 'Multimodal Subnet',
    description: 'Combined text, image, audio, and video processing',
  },
  research: {
    name: 'Research Subnet',
    description: 'Deep reasoning, scientific analysis, and long-context tasks',
  },
};

// Capability keywords mapped to subnet types
const CAPABILITY_SUBNET_MAP: Record<string, SubnetType[]> = {
  'text-generation': ['inference'],
  'chat': ['inference'],
  'completion': ['inference'],
  'code': ['code'],
  'code-generation': ['code'],
  'code-completion': ['code'],
  'vision': ['vision'],
  'image-understanding': ['vision'],
  'image-to-text': ['vision'],
  'embedding': ['embedding'],
  'embeddings': ['embedding'],
  'multimodal': ['multimodal'],
  'audio': ['multimodal'],
  'video': ['multimodal'],
  'reasoning': ['research'],
  'research': ['research'],
  'math': ['research'],
  'training': ['training'],
  'fine-tuning': ['training'],
};

// VRAM threshold for training eligibility (GB)
const TRAINING_VRAM_THRESHOLD = 40;

// ── SubnetManager ───────────────────────────────────────────────────────

class SubnetManager {
  /** Node-to-subnet assignments */
  private assignments = new Map<string, SubnetAssignment>();

  /** Performance tracking per node per subnet */
  private performanceHistory = new Map<
    string,
    Record<SubnetType, { totalRequests: number; totalLatency: number; errors: number }>
  >();

  /** Active request count per subnet */
  private activeSubnetRequests = new Map<SubnetType, number>();

  // ── Auto-Assignment ─────────────────────────────────────────────────

  /**
   * Assign a node to subnets based on its declared capabilities
   * and observed performance.
   */
  assignNodeToSubnets(
    nodeId: string,
    capabilities: Record<string, unknown>,
  ): SubnetType[] {
    const subnets = new Set<SubnetType>();

    // Check declared capabilities
    const declaredCaps = capabilities.capabilities ?? capabilities.models ?? [];
    const capList: string[] = Array.isArray(declaredCaps)
      ? declaredCaps.map((c: unknown) => String(c).toLowerCase())
      : [];

    // Also check top-level capability flags
    for (const [key, value] of Object.entries(capabilities)) {
      if (value === true || value === 'true') {
        capList.push(key.toLowerCase());
      }
    }

    // Map capabilities to subnets
    for (const cap of capList) {
      for (const [keyword, subnetTypes] of Object.entries(CAPABILITY_SUBNET_MAP)) {
        if (cap.includes(keyword)) {
          for (const st of subnetTypes) {
            subnets.add(st);
          }
        }
      }
    }

    // Check VRAM for training eligibility
    const vram = capabilities.vramCapacityGB ?? capabilities.vram ?? 0;
    if (typeof vram === 'number' && vram >= TRAINING_VRAM_THRESHOLD) {
      subnets.add('training');
    }

    // Check multimodal capability
    if (capabilities.multimodal === true || capabilities.vision === true) {
      subnets.add('multimodal');
    }

    // Default: every node is in the inference subnet
    if (subnets.size === 0) {
      subnets.add('inference');
    }

    const subnetArray = [...subnets];
    const primarySubnet = subnetArray[0];

    // Get or create performance record
    const existingPerf = this.performanceHistory.get(nodeId);
    const performance: SubnetAssignment['performance'] = {} as SubnetAssignment['performance'];
    for (const st of subnetArray) {
      const hist = existingPerf?.[st];
      performance[st] = {
        requests: hist?.totalRequests ?? 0,
        avgLatencyMs: hist && hist.totalRequests > 0 ? hist.totalLatency / hist.totalRequests : 0,
        errorRate: hist && hist.totalRequests > 0 ? hist.errors / hist.totalRequests : 0,
      };
    }

    const assignment: SubnetAssignment = {
      nodeId,
      subnets: subnetArray,
      primarySubnet,
      performance,
    };

    this.assignments.set(nodeId, assignment);
    return subnetArray;
  }

  // ── Get Subnet ────────────────────────────────────────────────────────

  /**
   * Return subnet info including all nodes, capacity, and health metrics.
   */
  async getSubnet(type: SubnetType): Promise<Subnet> {
    const meta = SUBNET_META[type];
    const heartbeatCutoff = new Date(
      Date.now() - REPUTATION_CONFIG.heartbeatMaxAgeSeconds * 1000,
    );

    // Get all online nodes
    const onlineNodes = await prisma.nodeOperator.findMany({
      where: {
        isOnline: true,
        lastSeenAt: { gte: heartbeatCutoff },
        apiEndpoint: { not: null },
      },
      select: {
        id: true,
        reputationScore: true,
        avgLatencyMs: true,
        capabilities: true,
        memoryProfile: {
          select: {
            vramCapacityGB: true,
            decodeThroughputTps: true,
          },
        },
      },
    });

    // Filter to nodes assigned to this subnet
    const subnetNodeIds: string[] = [];
    const models = new Set<string>();
    let totalLatency = 0;
    let totalReputation = 0;
    let totalCapacity = 0;

    for (const node of onlineNodes) {
      const caps = (node.capabilities as Record<string, unknown>) ?? {};
      const assignment = this.assignments.get(node.id);

      // If not assigned yet, auto-assign
      if (!assignment) {
        this.assignNodeToSubnets(node.id, caps);
      }

      const currentAssignment = this.assignments.get(node.id);
      if (currentAssignment?.subnets.includes(type)) {
        subnetNodeIds.push(node.id);
        totalLatency += node.avgLatencyMs;
        totalReputation += node.reputationScore;

        // Extract models from capabilities
        const nodeModels = caps.models;
        if (Array.isArray(nodeModels)) {
          for (const m of nodeModels) {
            models.add(String(m));
          }
        }

        // Approximate TFLOPS from VRAM (rough heuristic)
        const vram = node.memoryProfile?.vramCapacityGB ?? 0;
        totalCapacity += vram * 2; // ~2 TFLOPS per GB VRAM (rough)
      }
    }

    const nodeCount = subnetNodeIds.length;
    const activeRequests = this.activeSubnetRequests.get(type) ?? 0;

    return {
      id: `subnet-${type}`,
      type,
      name: meta.name,
      description: meta.description,
      nodes: subnetNodeIds,
      totalCapacityTflops: totalCapacity,
      activeRequests,
      avgLatencyMs: nodeCount > 0 ? totalLatency / nodeCount : 0,
      avgReputationScore: nodeCount > 0 ? totalReputation / nodeCount : 0,
      models: [...models],
      createdAt: new Date('2026-01-01'), // Network genesis
    };
  }

  // ── Route to Subnet ───────────────────────────────────────────────────

  /**
   * Find the best node within a subnet for a request.
   * Scoring: reputation (40%), latency (30%), availability (30%).
   */
  async routeToSubnet(type: SubnetType): Promise<string | null> {
    const heartbeatCutoff = new Date(
      Date.now() - REPUTATION_CONFIG.heartbeatMaxAgeSeconds * 1000,
    );

    const onlineNodes = await prisma.nodeOperator.findMany({
      where: {
        isOnline: true,
        reputationScore: { gte: REPUTATION_CONFIG.minReputationForDispatch },
        lastSeenAt: { gte: heartbeatCutoff },
        apiEndpoint: { not: null },
      },
      select: {
        id: true,
        reputationScore: true,
        avgLatencyMs: true,
        maxConcurrent: true,
        capabilities: true,
        memoryProfile: {
          select: { vramCapacityGB: true },
        },
      },
    });

    // Filter to nodes in this subnet
    const subnetNodes = onlineNodes.filter((node) => {
      const assignment = this.assignments.get(node.id);
      if (!assignment) {
        // Auto-assign
        const caps = (node.capabilities as Record<string, unknown>) ?? {};
        this.assignNodeToSubnets(node.id, caps);
      }
      return this.assignments.get(node.id)?.subnets.includes(type);
    });

    if (subnetNodes.length === 0) return null;

    // Score nodes
    const maxLatency = Math.max(...subnetNodes.map((n) => n.avgLatencyMs), 1);
    const maxReputation = Math.max(
      ...subnetNodes.map((n) => n.reputationScore),
      1,
    );

    const scored = subnetNodes.map((node) => {
      const reputationNorm = node.reputationScore / maxReputation;
      const latencyNorm = 1 - node.avgLatencyMs / maxLatency;
      // Availability: rough proxy from max concurrent
      const availabilityNorm = Math.min(node.maxConcurrent / 10, 1);

      const score =
        reputationNorm * 0.4 + latencyNorm * 0.3 + availabilityNorm * 0.3;

      return { node, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.node.id ?? null;
  }

  // ── Subnet Health ─────────────────────────────────────────────────────

  /**
   * Overview of all subnet health for dashboard.
   */
  async getSubnetHealth(): Promise<Record<SubnetType, SubnetHealth>> {
    const result = {} as Record<SubnetType, SubnetHealth>;

    // Get all nodes at once
    const heartbeatCutoff = new Date(
      Date.now() - REPUTATION_CONFIG.heartbeatMaxAgeSeconds * 1000,
    );

    const allNodes = await prisma.nodeOperator.findMany({
      where: {
        apiEndpoint: { not: null },
      },
      select: {
        id: true,
        isOnline: true,
        reputationScore: true,
        avgLatencyMs: true,
        capabilities: true,
        lastSeenAt: true,
        memoryProfile: {
          select: { vramCapacityGB: true },
        },
      },
    });

    // Auto-assign any unassigned nodes
    for (const node of allNodes) {
      if (!this.assignments.has(node.id)) {
        const caps = (node.capabilities as Record<string, unknown>) ?? {};
        this.assignNodeToSubnets(node.id, caps);
      }
    }

    for (const type of ALL_SUBNET_TYPES) {
      let online = 0;
      let total = 0;
      let totalLatency = 0;
      let totalCapacity = 0;

      for (const node of allNodes) {
        const assignment = this.assignments.get(node.id);
        if (!assignment?.subnets.includes(type)) continue;

        total++;
        const isRecent =
          node.lastSeenAt &&
          node.lastSeenAt >= heartbeatCutoff;
        if (node.isOnline && isRecent) {
          online++;
          totalLatency += node.avgLatencyMs;
          const vram = node.memoryProfile?.vramCapacityGB ?? 0;
          totalCapacity += vram * 2;
        }
      }

      result[type] = {
        online,
        total,
        avgLatency: online > 0 ? totalLatency / online : 0,
        capacity: totalCapacity,
      };
    }

    return result;
  }

  // ── Request Classification ────────────────────────────────────────────

  /**
   * Classify a request to determine the appropriate subnet.
   * Uses model name and request content to infer the best subnet.
   */
  classifyRequest(
    model: string,
    messages?: Array<{ role: string; content: string }>,
  ): SubnetType {
    const modelLower = model.toLowerCase();

    // Model-based classification
    if (modelLower.includes('embed')) return 'embedding';
    if (modelLower.includes('vision') || modelLower.includes('image')) return 'vision';
    if (
      modelLower.includes('code') ||
      modelLower.includes('codestral') ||
      modelLower.includes('deepseek-coder') ||
      modelLower.includes('starcoder')
    ) {
      return 'code';
    }
    if (
      modelLower.includes('o1') ||
      modelLower.includes('o3') ||
      modelLower.includes('deepseek-r1') ||
      modelLower.includes('reasoning')
    ) {
      return 'research';
    }

    // Content-based classification if messages available
    if (messages && messages.length > 0) {
      const content = messages.map((m) => m.content).join(' ').toLowerCase();

      // Code patterns
      const codePatterns = [
        'function', 'class', 'import', 'const ', 'let ', 'var ',
        'def ', 'return', 'async', 'await', '```', 'debug', 'refactor',
        'write code', 'implement', 'fix the bug',
      ];
      const codeScore = codePatterns.filter((p) => content.includes(p)).length;
      if (codeScore >= 3) return 'code';

      // Research/reasoning patterns
      const researchPatterns = [
        'analyze', 'prove', 'theorem', 'hypothesis', 'research',
        'calculate', 'equation', 'scientific', 'step by step',
      ];
      const researchScore = researchPatterns.filter((p) =>
        content.includes(p),
      ).length;
      if (researchScore >= 2) return 'research';

      // Vision check (presence of image references)
      if (
        content.includes('image') ||
        content.includes('photo') ||
        content.includes('picture') ||
        content.includes('screenshot')
      ) {
        return 'vision';
      }
    }

    // Default to inference
    return 'inference';
  }

  // ── Performance Tracking ──────────────────────────────────────────────

  /**
   * Record a completed request for performance tracking.
   */
  recordRequestPerformance(
    nodeId: string,
    subnet: SubnetType,
    latencyMs: number,
    success: boolean,
  ): void {
    let history = this.performanceHistory.get(nodeId);
    if (!history) {
      history = {} as Record<
        SubnetType,
        { totalRequests: number; totalLatency: number; errors: number }
      >;
      this.performanceHistory.set(nodeId, history);
    }

    if (!history[subnet]) {
      history[subnet] = { totalRequests: 0, totalLatency: 0, errors: 0 };
    }

    history[subnet].totalRequests++;
    history[subnet].totalLatency += latencyMs;
    if (!success) history[subnet].errors++;
  }

  /**
   * Increment active request count for a subnet.
   */
  incrementActiveRequests(subnet: SubnetType): void {
    this.activeSubnetRequests.set(
      subnet,
      (this.activeSubnetRequests.get(subnet) ?? 0) + 1,
    );
  }

  /**
   * Decrement active request count for a subnet.
   */
  decrementActiveRequests(subnet: SubnetType): void {
    const current = this.activeSubnetRequests.get(subnet) ?? 0;
    this.activeSubnetRequests.set(subnet, Math.max(0, current - 1));
  }

  /**
   * Get a node's subnet assignment.
   */
  getNodeAssignment(nodeId: string): SubnetAssignment | undefined {
    return this.assignments.get(nodeId);
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const subnetManager = new SubnetManager();
