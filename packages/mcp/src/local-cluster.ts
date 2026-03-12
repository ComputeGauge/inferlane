// ============================================================================
// LocalCluster — Detection, quality assessment, and cloud routing incentives
//
// This module handles the bridge between local/on-prem AI inference and
// cloud APIs. The key insight:
//
// Mac Minis, GPU clusters, self-hosted Ollama/vLLM instances are GREAT
// for many tasks. But they have limits. When a local model can't handle
// a complex task, the smart move is to route to a paid cloud platform.
//
// ComputeGauge makes this routing transparent, cost-optimized, and
// auditable — and rewards the agent with credibility points for making
// the right call.
//
// THE INCENTIVE MECHANISM:
// 1. Local agent detects task complexity
// 2. Compares local model capability vs task requirements
// 3. If gap detected → route to cloud via ComputeGauge pick_model
// 4. Agent earns credibility for honest assessment + smart routing
// 5. User gets better results at optimal cost
// 6. ComputeGauge earns data + routing influence
//
// SUPPORTED LOCAL INFERENCE:
// - Ollama (Mac Mini, Linux servers)
// - vLLM (GPU clusters)
// - llama.cpp (bare metal)
// - TGI (HuggingFace Text Generation Inference)
// - LocalAI (multi-model local inference)
// - Custom endpoints (any OpenAI-compatible local API)
//
// License: Apache-2.0
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface LocalClusterConfig {
  /** Detected local inference endpoints */
  endpoints: LocalEndpoint[];
  /** Detected local models */
  models: LocalModelInfo[];
  /** Hardware profile (if detectable) */
  hardware: HardwareProfile | null;
  /** Is this a local-only, cloud-only, or hybrid environment? */
  environmentType: 'local_only' | 'cloud_only' | 'hybrid';
}

export interface LocalEndpoint {
  name: string;
  type: 'ollama' | 'vllm' | 'llamacpp' | 'tgi' | 'localai' | 'custom';
  url: string;
  status: 'detected' | 'reachable' | 'unreachable' | 'unknown';
  models: string[];
}

export interface LocalModelInfo {
  name: string;
  endpoint: string;
  /** Estimated quality score (0-100) for key task types */
  estimatedQuality: Partial<Record<string, number>>;
  /** Estimated context window */
  contextWindow: number;
  /** Does it support tool use? */
  toolUse: boolean;
  /** Does it support vision? */
  vision: boolean;
  /** Estimated tokens/second on this hardware */
  estimatedTps: number;
  /** Cost per call (amortized hardware + electricity, 0 if unknown) */
  estimatedCostPerCall: number;
}

export interface HardwareProfile {
  /** CPU type (e.g., "Apple M4", "AMD EPYC") */
  cpu: string;
  /** GPU type and count (e.g., "NVIDIA A100 x4") */
  gpu: string;
  /** Total VRAM in GB */
  vramGb: number;
  /** Total RAM in GB */
  ramGb: number;
  /** Estimated total cost per hour (amortized hardware + electricity) */
  costPerHour: number;
}

/** Assessment of whether a task should stay local or go to cloud */
export interface RoutingAssessment {
  /** Should this task be routed to cloud? */
  routeToCloud: boolean;
  /** Confidence in this assessment (0-1) */
  confidence: number;
  /** Why we made this decision */
  reason: string;
  /** The quality gap between local and cloud models for this task */
  qualityGap: number;
  /** Best available local model for this task */
  bestLocalModel: LocalModelInfo | null;
  /** Recommended cloud model (from pick_model) */
  recommendedCloudModel: string | null;
  /** Cost comparison: local vs cloud */
  costComparison: {
    localCost: number;
    cloudCost: number;
    savings: number; // positive = cloud saves money, negative = local saves money
  } | null;
}

// ============================================================================
// Known local model capabilities
// ============================================================================

// Estimated quality scores for common local models
const LOCAL_MODEL_CAPABILITIES: Record<string, {
  quality: Partial<Record<string, number>>;
  contextWindow: number;
  toolUse: boolean;
  vision: boolean;
  estimatedTps: { cpu: number; gpu: number };
}> = {
  // Llama 3.x family
  'llama3.3:70b': {
    quality: { complex_reasoning: 78, code_generation: 80, code_review: 78, simple_qa: 82, classification: 80, extraction: 80, summarization: 80, general: 79 },
    contextWindow: 128000, toolUse: true, vision: false,
    estimatedTps: { cpu: 5, gpu: 30 },
  },
  'llama3.2:3b': {
    quality: { complex_reasoning: 35, code_generation: 40, simple_qa: 60, classification: 65, extraction: 60, summarization: 55, general: 48 },
    contextWindow: 128000, toolUse: false, vision: false,
    estimatedTps: { cpu: 25, gpu: 80 },
  },
  'llama3.1:8b': {
    quality: { complex_reasoning: 45, code_generation: 50, code_review: 45, simple_qa: 72, classification: 75, extraction: 70, summarization: 65, general: 58 },
    contextWindow: 128000, toolUse: false, vision: false,
    estimatedTps: { cpu: 15, gpu: 60 },
  },
  // Qwen family
  'qwen2.5:72b': {
    quality: { complex_reasoning: 80, code_generation: 82, code_review: 79, simple_qa: 83, classification: 81, math: 82, general: 81 },
    contextWindow: 128000, toolUse: true, vision: false,
    estimatedTps: { cpu: 3, gpu: 25 },
  },
  'qwen2.5:7b': {
    quality: { complex_reasoning: 52, code_generation: 58, simple_qa: 68, classification: 70, extraction: 65, general: 60 },
    contextWindow: 128000, toolUse: false, vision: false,
    estimatedTps: { cpu: 18, gpu: 65 },
  },
  // Mistral family
  'mistral:7b': {
    quality: { complex_reasoning: 48, code_generation: 52, simple_qa: 70, classification: 72, extraction: 68, summarization: 65, general: 58 },
    contextWindow: 32000, toolUse: false, vision: false,
    estimatedTps: { cpu: 18, gpu: 65 },
  },
  // DeepSeek family (local)
  'deepseek-r1:14b': {
    quality: { complex_reasoning: 72, code_generation: 75, math: 78, data_analysis: 70, general: 68 },
    contextWindow: 128000, toolUse: false, vision: false,
    estimatedTps: { cpu: 10, gpu: 45 },
  },
  'deepseek-r1:70b': {
    quality: { complex_reasoning: 85, code_generation: 86, math: 88, data_analysis: 82, general: 80 },
    contextWindow: 128000, toolUse: false, vision: false,
    estimatedTps: { cpu: 3, gpu: 20 },
  },
  // Code-specific
  'codellama:34b': {
    quality: { code_generation: 72, code_review: 68, general: 55 },
    contextWindow: 16000, toolUse: false, vision: false,
    estimatedTps: { cpu: 8, gpu: 35 },
  },
  // Phi family
  'phi3:14b': {
    quality: { complex_reasoning: 55, code_generation: 60, simple_qa: 72, classification: 70, math: 58, general: 60 },
    contextWindow: 128000, toolUse: false, vision: false,
    estimatedTps: { cpu: 12, gpu: 50 },
  },
  // Vision models
  'llava:13b': {
    quality: { simple_qa: 55, classification: 60, extraction: 55, general: 50 },
    contextWindow: 4096, toolUse: false, vision: true,
    estimatedTps: { cpu: 8, gpu: 30 },
  },
};

// Quality threshold — below this score, recommend cloud routing
const CLOUD_ROUTING_THRESHOLD = 65;
// Minimum quality gap to trigger cloud recommendation
const MINIMUM_QUALITY_GAP = 15;

// ============================================================================
// Local Cluster Detection Engine
// ============================================================================

export class LocalClusterEngine {

  // ========================================================================
  // ENVIRONMENT DETECTION
  // ========================================================================

  /**
   * Detect the local inference environment.
   * Checks environment variables and known endpoints.
   */
  detectEnvironment(): LocalClusterConfig {
    const endpoints = this.detectEndpoints();
    const models = this.detectModels(endpoints);
    const hardware = this.detectHardware();

    const hasLocal = endpoints.length > 0;
    const hasCloud = !!(
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GOOGLE_API_KEY
    );

    return {
      endpoints,
      models,
      hardware,
      environmentType: hasLocal && hasCloud ? 'hybrid'
        : hasLocal ? 'local_only'
        : 'cloud_only',
    };
  }

  private detectEndpoints(): LocalEndpoint[] {
    const endpoints: LocalEndpoint[] = [];

    // Ollama
    const ollamaHost = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL;
    if (ollamaHost) {
      endpoints.push({
        name: 'Ollama',
        type: 'ollama',
        url: ollamaHost,
        status: 'detected',
        models: this.parseModelList(process.env.OLLAMA_MODELS || ''),
      });
    }
    // Also check default Ollama port
    if (!ollamaHost && process.env.OLLAMA_MODELS) {
      endpoints.push({
        name: 'Ollama (default)',
        type: 'ollama',
        url: 'http://localhost:11434',
        status: 'detected',
        models: this.parseModelList(process.env.OLLAMA_MODELS),
      });
    }

    // vLLM
    const vllmHost = process.env.VLLM_HOST || process.env.VLLM_BASE_URL;
    if (vllmHost) {
      endpoints.push({
        name: 'vLLM',
        type: 'vllm',
        url: vllmHost,
        status: 'detected',
        models: this.parseModelList(process.env.VLLM_MODELS || ''),
      });
    }

    // llama.cpp
    const llamacppHost = process.env.LLAMACPP_HOST || process.env.LLAMA_SERVER_URL;
    if (llamacppHost) {
      endpoints.push({
        name: 'llama.cpp',
        type: 'llamacpp',
        url: llamacppHost,
        status: 'detected',
        models: this.parseModelList(process.env.LLAMACPP_MODEL || ''),
      });
    }

    // TGI (HuggingFace Text Generation Inference)
    const tgiHost = process.env.TGI_HOST || process.env.HF_INFERENCE_HOST;
    if (tgiHost) {
      endpoints.push({
        name: 'TGI',
        type: 'tgi',
        url: tgiHost,
        status: 'detected',
        models: this.parseModelList(process.env.TGI_MODEL || ''),
      });
    }

    // LocalAI
    const localaiHost = process.env.LOCALAI_HOST || process.env.LOCALAI_BASE_URL;
    if (localaiHost) {
      endpoints.push({
        name: 'LocalAI',
        type: 'localai',
        url: localaiHost,
        status: 'detected',
        models: this.parseModelList(process.env.LOCALAI_MODELS || ''),
      });
    }

    // Custom OpenAI-compatible endpoint
    const customHost = process.env.LOCAL_LLM_ENDPOINT || process.env.LOCAL_AI_ENDPOINT;
    if (customHost) {
      endpoints.push({
        name: 'Custom Local',
        type: 'custom',
        url: customHost,
        status: 'detected',
        models: this.parseModelList(process.env.LOCAL_LLM_MODELS || ''),
      });
    }

    return endpoints;
  }

  private detectModels(endpoints: LocalEndpoint[]): LocalModelInfo[] {
    const models: LocalModelInfo[] = [];
    const hasGpu = this.hasGpuHardware();

    for (const endpoint of endpoints) {
      for (const modelName of endpoint.models) {
        const caps = this.findModelCapabilities(modelName);
        if (caps) {
          models.push({
            name: modelName,
            endpoint: endpoint.url,
            estimatedQuality: caps.quality,
            contextWindow: caps.contextWindow,
            toolUse: caps.toolUse,
            vision: caps.vision,
            estimatedTps: hasGpu ? caps.estimatedTps.gpu : caps.estimatedTps.cpu,
            estimatedCostPerCall: 0, // Local inference = no per-call cost (amortized in hardware)
          });
        } else {
          // Unknown model — provide conservative estimates
          models.push({
            name: modelName,
            endpoint: endpoint.url,
            estimatedQuality: { general: 50 },
            contextWindow: 4096,
            toolUse: false,
            vision: false,
            estimatedTps: hasGpu ? 20 : 8,
            estimatedCostPerCall: 0,
          });
        }
      }
    }

    return models;
  }

  private detectHardware(): HardwareProfile | null {
    // Read hardware hints from environment
    const gpu = process.env.COMPUTEGAUGE_GPU || process.env.NVIDIA_GPU_NAME;
    const vram = process.env.COMPUTEGAUGE_VRAM_GB || process.env.GPU_VRAM_GB;
    const ram = process.env.COMPUTEGAUGE_RAM_GB;
    const cpu = process.env.COMPUTEGAUGE_CPU;
    const costPerHour = process.env.COMPUTEGAUGE_COST_PER_HOUR;

    if (!gpu && !cpu) return null;

    return {
      cpu: cpu || 'Unknown',
      gpu: gpu || 'None detected',
      vramGb: vram ? parseFloat(vram) : 0,
      ramGb: ram ? parseFloat(ram) : 0,
      costPerHour: costPerHour ? parseFloat(costPerHour) : 0,
    };
  }

  // ========================================================================
  // ROUTING ASSESSMENT — Should this task stay local or go to cloud?
  // ========================================================================

  /**
   * Assess whether a task should be routed to the cloud.
   * This is the core intelligence that makes the incentive system work.
   */
  assessRouting(params: {
    taskType: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    needsToolUse: boolean;
    needsVision: boolean;
    qualityRequirement: 'minimum' | 'good' | 'excellent';
  }): RoutingAssessment {
    const config = this.detectEnvironment();

    // If no local models, always route to cloud
    if (config.models.length === 0) {
      return {
        routeToCloud: true,
        confidence: 1.0,
        reason: 'No local inference endpoints detected — cloud routing required',
        qualityGap: 100,
        bestLocalModel: null,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }

    // Find best local model for this task
    const bestLocal = this.findBestLocalModel(config.models, params.taskType, params);
    if (!bestLocal) {
      return {
        routeToCloud: true,
        confidence: 0.9,
        reason: `No local model meets requirements for ${params.taskType} (tool_use=${params.needsToolUse}, vision=${params.needsVision})`,
        qualityGap: 50,
        bestLocalModel: null,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }

    // Get local quality score for this task
    const localQuality = bestLocal.estimatedQuality[params.taskType]
      ?? bestLocal.estimatedQuality['general']
      ?? 50;

    // Determine cloud quality threshold based on requirement
    const cloudQualityThresholds = {
      minimum: 65,
      good: 78,
      excellent: 88,
    };
    const requiredQuality = cloudQualityThresholds[params.qualityRequirement];

    // Check context window
    if (params.estimatedInputTokens > bestLocal.contextWindow * 0.8) {
      return {
        routeToCloud: true,
        confidence: 0.95,
        reason: `Input tokens (${params.estimatedInputTokens}) approach local model context limit (${bestLocal.contextWindow}). Cloud models offer larger contexts.`,
        qualityGap: 20,
        bestLocalModel: bestLocal,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }

    // Check capability gaps
    if (params.needsToolUse && !bestLocal.toolUse) {
      return {
        routeToCloud: true,
        confidence: 0.95,
        reason: `Task requires tool use but best local model (${bestLocal.name}) doesn't support it`,
        qualityGap: 30,
        bestLocalModel: bestLocal,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }
    if (params.needsVision && !bestLocal.vision) {
      return {
        routeToCloud: true,
        confidence: 0.95,
        reason: `Task requires vision but best local model (${bestLocal.name}) doesn't support it`,
        qualityGap: 30,
        bestLocalModel: bestLocal,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }

    // Core quality assessment
    const qualityGap = requiredQuality - localQuality;

    if (qualityGap > MINIMUM_QUALITY_GAP) {
      // Cloud routing recommended
      return {
        routeToCloud: true,
        confidence: Math.min(0.95, 0.5 + (qualityGap / 100)),
        reason: `Local model quality (${localQuality}/100) is ${qualityGap} points below ${params.qualityRequirement} threshold (${requiredQuality}) for ${params.taskType}. Cloud model will deliver significantly better results.`,
        qualityGap,
        bestLocalModel: bestLocal,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }

    if (localQuality < CLOUD_ROUTING_THRESHOLD) {
      // Below absolute threshold
      return {
        routeToCloud: true,
        confidence: 0.7,
        reason: `Local model quality (${localQuality}/100) is below minimum threshold (${CLOUD_ROUTING_THRESHOLD}) for reliable ${params.taskType} performance.`,
        qualityGap: CLOUD_ROUTING_THRESHOLD - localQuality,
        bestLocalModel: bestLocal,
        recommendedCloudModel: null,
        costComparison: null,
      };
    }

    // Local model is good enough!
    return {
      routeToCloud: false,
      confidence: Math.min(0.95, 0.5 + (localQuality / 200)),
      reason: `Local model ${bestLocal.name} (quality ${localQuality}/100) meets requirements for ${params.taskType}. No cloud routing needed — saving money.`,
      qualityGap: Math.max(0, requiredQuality - localQuality),
      bestLocalModel: bestLocal,
      recommendedCloudModel: null,
      costComparison: null,
    };
  }

  // ========================================================================
  // REPORTING — Local cluster status
  // ========================================================================

  getClusterStatus(): string {
    const config = this.detectEnvironment();
    const lines: string[] = [];

    lines.push('# Local Cluster Status');
    lines.push('');
    lines.push(`**Environment**: ${config.environmentType}`);
    lines.push(`**Endpoints detected**: ${config.endpoints.length}`);
    lines.push(`**Models available**: ${config.models.length}`);
    lines.push('');

    if (config.endpoints.length === 0) {
      lines.push('_No local inference endpoints detected._');
      lines.push('');
      lines.push('## How to Set Up Local Inference');
      lines.push('');
      lines.push('ComputeGauge detects local inference via environment variables:');
      lines.push('');
      lines.push('| Platform | Environment Variable | Example |');
      lines.push('|----------|---------------------|---------|');
      lines.push('| Ollama | `OLLAMA_HOST` | `http://localhost:11434` |');
      lines.push('| vLLM | `VLLM_HOST` | `http://localhost:8000` |');
      lines.push('| llama.cpp | `LLAMACPP_HOST` | `http://localhost:8080` |');
      lines.push('| TGI | `TGI_HOST` | `http://localhost:8080` |');
      lines.push('| LocalAI | `LOCALAI_HOST` | `http://localhost:8080` |');
      lines.push('| Custom | `LOCAL_LLM_ENDPOINT` | Any OpenAI-compatible URL |');
      lines.push('');
      lines.push('Also set `OLLAMA_MODELS`, `VLLM_MODELS`, etc. (comma-separated model names).');
      lines.push('');
      lines.push('### Hardware Detection');
      lines.push('For cost tracking, set:');
      lines.push('- `COMPUTEGAUGE_GPU` — GPU name (e.g., "NVIDIA RTX 4090")');
      lines.push('- `COMPUTEGAUGE_VRAM_GB` — VRAM in GB');
      lines.push('- `COMPUTEGAUGE_RAM_GB` — RAM in GB');
      lines.push('- `COMPUTEGAUGE_COST_PER_HOUR` — Amortized cost/hr');
      return lines.join('\n');
    }

    // Show endpoints
    lines.push('## Endpoints');
    for (const ep of config.endpoints) {
      lines.push(`### ${ep.name} (${ep.type})`);
      lines.push(`- URL: \`${ep.url}\``);
      lines.push(`- Status: ${ep.status}`);
      lines.push(`- Models: ${ep.models.length > 0 ? ep.models.join(', ') : 'none detected'}`);
      lines.push('');
    }

    // Show models with capabilities
    if (config.models.length > 0) {
      lines.push('## Available Models');
      lines.push('| Model | Quality (general) | Context | Tool Use | Vision | Est. TPS |');
      lines.push('|-------|-------------------|---------|----------|--------|----------|');
      for (const m of config.models.sort((a, b) =>
        (b.estimatedQuality['general'] || 50) - (a.estimatedQuality['general'] || 50)
      )) {
        const quality = m.estimatedQuality['general'] || m.estimatedQuality['simple_qa'] || 50;
        lines.push(`| ${m.name} | ${quality}/100 | ${(m.contextWindow / 1000).toFixed(0)}K | ${m.toolUse ? '✅' : '❌'} | ${m.vision ? '✅' : '❌'} | ${m.estimatedTps}/s |`);
      }
    }

    // Hardware
    if (config.hardware) {
      lines.push('');
      lines.push('## Hardware Profile');
      lines.push(`- **CPU**: ${config.hardware.cpu}`);
      lines.push(`- **GPU**: ${config.hardware.gpu}`);
      if (config.hardware.vramGb > 0) lines.push(`- **VRAM**: ${config.hardware.vramGb} GB`);
      if (config.hardware.ramGb > 0) lines.push(`- **RAM**: ${config.hardware.ramGb} GB`);
      if (config.hardware.costPerHour > 0) lines.push(`- **Amortized cost**: $${config.hardware.costPerHour.toFixed(2)}/hr`);
    }

    // Routing recommendation summary
    lines.push('');
    lines.push('## Routing Intelligence');
    lines.push('');
    const bestModel = config.models.sort((a, b) =>
      (b.estimatedQuality['general'] || 50) - (a.estimatedQuality['general'] || 50)
    )[0];
    if (bestModel) {
      const generalQuality = bestModel.estimatedQuality['general'] || 50;
      lines.push(`**Best local model**: ${bestModel.name} (quality: ${generalQuality}/100)`);
      lines.push('');

      if (generalQuality >= 80) {
        lines.push('✅ Local cluster handles most tasks well. Cloud routing recommended only for:');
        lines.push('- Complex reasoning requiring frontier models');
        lines.push('- Tasks needing capabilities not available locally');
      } else if (generalQuality >= 65) {
        lines.push('⚠️ Local cluster is adequate for simple tasks. Consider cloud routing for:');
        lines.push('- Code generation and review');
        lines.push('- Complex reasoning and analysis');
        lines.push('- Any task requiring high accuracy');
      } else {
        lines.push('📡 Local cluster is best for simple tasks only. Cloud routing recommended for:');
        lines.push('- Most production workloads');
        lines.push('- Anything beyond simple Q&A and classification');
      }
    }

    return lines.join('\n');
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private parseModelList(envVar: string): string[] {
    if (!envVar) return [];
    return envVar.split(',').map(m => m.trim()).filter(m => m.length > 0);
  }

  private findModelCapabilities(modelName: string): (typeof LOCAL_MODEL_CAPABILITIES)[string] | null {
    // Direct match
    if (LOCAL_MODEL_CAPABILITIES[modelName]) {
      return LOCAL_MODEL_CAPABILITIES[modelName];
    }

    // Fuzzy match — handle Ollama-style names (e.g., "llama3.3:70b-instruct-q4_0")
    const normalized = modelName.toLowerCase().replace(/[-_:]/g, '');
    for (const [key, value] of Object.entries(LOCAL_MODEL_CAPABILITIES)) {
      const keyNormalized = key.toLowerCase().replace(/[-_:]/g, '');
      if (normalized.includes(keyNormalized) || keyNormalized.includes(normalized)) {
        return value;
      }
    }

    return null;
  }

  private findBestLocalModel(
    models: LocalModelInfo[],
    taskType: string,
    params: { needsToolUse: boolean; needsVision: boolean }
  ): LocalModelInfo | null {
    // Filter by capability requirements
    let candidates = models;
    if (params.needsToolUse) {
      candidates = candidates.filter(m => m.toolUse);
    }
    if (params.needsVision) {
      candidates = candidates.filter(m => m.vision);
    }

    if (candidates.length === 0) return null;

    // Sort by quality for the specific task type
    return candidates.sort((a, b) => {
      const aQuality = a.estimatedQuality[taskType] ?? a.estimatedQuality['general'] ?? 50;
      const bQuality = b.estimatedQuality[taskType] ?? b.estimatedQuality['general'] ?? 50;
      return bQuality - aQuality;
    })[0];
  }

  private hasGpuHardware(): boolean {
    return !!(
      process.env.NVIDIA_GPU_NAME ||
      process.env.COMPUTEGAUGE_GPU ||
      process.env.CUDA_VISIBLE_DEVICES ||
      process.env.GPU_VRAM_GB
    );
  }
}
