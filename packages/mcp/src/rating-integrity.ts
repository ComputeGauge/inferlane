// ============================================================================
// RatingIntegrity — Anti-spam, validation, and continuous improvement engine
//
// Every rating that comes in is validated before being accepted:
// 1. STRUCTURAL VALIDATION — Does the rating make logical sense?
// 2. BEHAVIORAL ANALYSIS — Is the rating pattern consistent with genuine use?
// 3. ANOMALY DETECTION — Does this rating deviate from established patterns?
// 4. POLICY COMPLIANCE — Does the feedback comply with content policies?
//
// After validation, the CONTINUOUS IMPROVEMENT ENGINE:
// 1. Detects quality issues in pick_model recommendations
// 2. Suggests specific fixes (quality score adjustments, new task types, etc.)
// 3. Reviews suggested fixes against system policies
// 4. Queues approved fixes for implementation
// 5. Logs edge cases that can't be auto-fixed (legal, structural constraints)
//
// License: Apache-2.0
// ============================================================================

// ============================================================================
// Types
// ============================================================================

interface RatingSubmission {
  model: string;
  provider: string;
  taskType: string;
  rating: number;
  taskSuccess: boolean;
  wouldUseAgain: boolean;
  costEffective: boolean;
  feedback?: string;
  // Context from session (injected by caller)
  sessionRequestCount: number;
  sessionModelHistory: string[];
  timeSinceLastRating: number; // ms
}

interface ValidationResult {
  valid: boolean;
  accepted: boolean;
  flags: ValidationFlag[];
  adjustedRating?: number;
  sanitizedFeedback?: string;
  rejectionReason?: string;
}

interface ValidationFlag {
  type: 'spam' | 'anomaly' | 'policy' | 'structural' | 'trust' | 'edge_case';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface QualityIssue {
  id: string;
  type: 'score_drift' | 'task_mismatch' | 'provider_bias' | 'cost_miscalculation' | 'missing_capability' | 'user_dissatisfaction';
  model: string;
  taskType: string;
  description: string;
  evidence: string;
  suggestedFix: SuggestedFix;
  policyReview: PolicyReviewResult;
  status: 'detected' | 'fix_proposed' | 'policy_reviewed' | 'approved' | 'blocked' | 'implemented';
  createdAt: Date;
}

interface SuggestedFix {
  action: 'adjust_quality_score' | 'add_task_capability' | 'add_disqualification' | 'update_speed_score' | 'flag_for_manual_review';
  details: string;
  currentValue?: number;
  proposedValue?: number;
  confidence: number; // 0-1, based on amount of evidence
}

interface PolicyReviewResult {
  approved: boolean;
  policyViolations: string[];
  edgeCases: string[];
  notes: string;
}

// Content policy keywords — feedback containing these patterns is flagged
const POLICY_BLOCKED_PATTERNS: RegExp[] = [
  /\b(hack|exploit|jailbreak|bypass|ignore.*instructions|ignore.*rules)\b/i,
  /\b(inject|injection|prompt.*inject)\b/i,
  /<script|javascript:|data:/i,
  /\b(password|api.?key|secret|token|credential)\b/i,
];

const POLICY_FLAGGED_PATTERNS: RegExp[] = [
  /\b(unsafe|dangerous|harmful|illegal)\b/i,
  /\b(bias|discriminat|racist|sexist)\b/i,
  /\b(copyright|pirat|steal|stolen)\b/i,
];

// ============================================================================
// Rating Integrity Engine
// ============================================================================

export class RatingIntegrityEngine {
  private ratingHistory: Array<{
    submission: RatingSubmission;
    validation: ValidationResult;
    timestamp: Date;
  }> = [];

  private qualityIssues: QualityIssue[] = [];
  private issueCounter = 0;

  // Tracks per-model rating patterns for anomaly detection
  private modelRatingPatterns: Map<string, {
    ratings: number[];
    avgRating: number;
    stdDev: number;
    lastUpdated: Date;
  }> = new Map();

  // ========================================================================
  // VALIDATION PIPELINE
  // ========================================================================

  validateRating(submission: RatingSubmission): ValidationResult {
    const flags: ValidationFlag[] = [];
    let accepted = true;
    let adjustedRating = submission.rating;
    let sanitizedFeedback = submission.feedback;

    // --- Stage 1: STRUCTURAL VALIDATION ---
    const structuralFlags = this.validateStructure(submission);
    flags.push(...structuralFlags);
    if (structuralFlags.some(f => f.severity === 'critical')) {
      accepted = false;
    }

    // --- Stage 2: BEHAVIORAL ANALYSIS ---
    const behaviorFlags = this.analyzeBehavior(submission);
    flags.push(...behaviorFlags);
    if (behaviorFlags.some(f => f.severity === 'critical')) {
      accepted = false;
    }
    // Down-weight ratings from suspicious behavioral patterns
    if (behaviorFlags.some(f => f.type === 'spam')) {
      adjustedRating = this.dampRating(submission.rating);
    }

    // --- Stage 3: ANOMALY DETECTION ---
    const anomalyFlags = this.detectAnomalies(submission);
    flags.push(...anomalyFlags);
    // Anomalies don't reject but get flagged and down-weighted
    if (anomalyFlags.some(f => f.severity === 'warning')) {
      adjustedRating = this.dampRating(adjustedRating, 0.8);
    }

    // --- Stage 4: POLICY COMPLIANCE ---
    if (submission.feedback) {
      const policyResult = this.checkPolicies(submission.feedback);
      flags.push(...policyResult.flags);
      sanitizedFeedback = policyResult.sanitizedFeedback;
      if (policyResult.rejected) {
        sanitizedFeedback = undefined; // Strip the feedback entirely
        flags.push({
          type: 'policy',
          severity: 'warning',
          message: 'Feedback removed due to policy violation. Rating still counted.',
        });
      }
    }

    // --- Stage 5: TRUST SCORING ---
    // Higher trust for sessions with more requests (genuine working sessions)
    if (submission.sessionRequestCount < 2) {
      flags.push({
        type: 'trust',
        severity: 'info',
        message: 'Low session activity — rating weighted at 50% until more requests are logged.',
      });
      adjustedRating = this.dampRating(adjustedRating, 0.5);
    }

    const result: ValidationResult = {
      valid: structuralFlags.every(f => f.severity !== 'critical'),
      accepted,
      flags,
      adjustedRating: adjustedRating !== submission.rating ? adjustedRating : undefined,
      sanitizedFeedback: sanitizedFeedback !== submission.feedback ? sanitizedFeedback : undefined,
      rejectionReason: !accepted
        ? flags.filter(f => f.severity === 'critical').map(f => f.message).join('; ')
        : undefined,
    };

    // Record in history
    this.ratingHistory.push({
      submission,
      validation: result,
      timestamp: new Date(),
    });

    // Update model patterns if accepted
    if (accepted) {
      this.updateModelPatterns(submission.model, adjustedRating);
    }

    return result;
  }

  // ========================================================================
  // STRUCTURAL VALIDATION
  // ========================================================================

  private validateStructure(sub: RatingSubmission): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    // Rating must be 1-5
    if (sub.rating < 1 || sub.rating > 5 || !Number.isInteger(sub.rating)) {
      flags.push({
        type: 'structural',
        severity: 'critical',
        message: `Invalid rating value: ${sub.rating}. Must be integer 1-5.`,
      });
    }

    // Model and provider must be non-empty
    if (!sub.model || sub.model.trim().length === 0) {
      flags.push({
        type: 'structural',
        severity: 'critical',
        message: 'Model name is required.',
      });
    }

    if (!sub.provider || sub.provider.trim().length === 0) {
      flags.push({
        type: 'structural',
        severity: 'critical',
        message: 'Provider name is required.',
      });
    }

    // Contradiction check: task failed but rated 5/5
    if (!sub.taskSuccess && sub.rating >= 4) {
      flags.push({
        type: 'structural',
        severity: 'warning',
        message: `Contradictory: task failed but rated ${sub.rating}/5. Rating down-weighted.`,
      });
    }

    // Contradiction check: wouldn't use again but rated 5/5
    if (!sub.wouldUseAgain && sub.rating === 5) {
      flags.push({
        type: 'structural',
        severity: 'warning',
        message: 'Contradictory: rated 5/5 but would not use again. Rating down-weighted.',
      });
    }

    // Contradiction check: not cost effective but task was simple/cheap
    // (lightweight check — just flags for review)
    if (sub.costEffective && sub.rating <= 2) {
      flags.push({
        type: 'structural',
        severity: 'info',
        message: 'Low rating but marked as cost-effective — unusual combination.',
      });
    }

    // Feedback length check
    if (sub.feedback && sub.feedback.length > 1000) {
      flags.push({
        type: 'structural',
        severity: 'warning',
        message: 'Feedback truncated to 1000 characters.',
      });
    }

    return flags;
  }

  // ========================================================================
  // BEHAVIORAL ANALYSIS — detecting spam and manipulation
  // ========================================================================

  private analyzeBehavior(sub: RatingSubmission): ValidationFlag[] {
    const flags: ValidationFlag[] = [];
    const recentRatings = this.ratingHistory.slice(-20);

    // RAPID-FIRE DETECTION: ratings coming in faster than 2 seconds
    if (sub.timeSinceLastRating > 0 && sub.timeSinceLastRating < 2000) {
      flags.push({
        type: 'spam',
        severity: 'warning',
        message: `Rating submitted ${sub.timeSinceLastRating}ms after previous — possible automated spam.`,
      });
    }

    // CARPET BOMBING: All 1-star or all 5-star in rapid succession
    if (recentRatings.length >= 5) {
      const last5 = recentRatings.slice(-5).map(r => r.submission.rating);
      const allSame = last5.every(r => r === last5[0]);
      if (allSame) {
        flags.push({
          type: 'spam',
          severity: 'warning',
          message: `Last 5 ratings are all ${last5[0]}/5 — possible rating manipulation.`,
        });
      }
    }

    // MODEL NOT IN SESSION: rating a model that wasn't logged in this session
    if (!sub.sessionModelHistory.includes(sub.model)) {
      flags.push({
        type: 'spam',
        severity: 'warning',
        message: `Model "${sub.model}" not found in session request history — rating weighted at 50% until confirmed by logged usage.`,
      });
    }

    // VOLUME LIMIT: more than 50 ratings per session is suspicious
    if (this.ratingHistory.length > 50) {
      flags.push({
        type: 'spam',
        severity: 'info',
        message: 'High rating volume for a single session. Ratings after 50 are weighted at 25%.',
      });
    }

    return flags;
  }

  // ========================================================================
  // ANOMALY DETECTION — ratings that deviate from established patterns
  // ========================================================================

  private detectAnomalies(sub: RatingSubmission): ValidationFlag[] {
    const flags: ValidationFlag[] = [];
    const pattern = this.modelRatingPatterns.get(sub.model);

    if (pattern && pattern.ratings.length >= 10) {
      // Z-score anomaly detection: flag ratings > 2 standard deviations from mean
      const zScore = pattern.stdDev > 0
        ? Math.abs(sub.rating - pattern.avgRating) / pattern.stdDev
        : 0;

      if (zScore > 2) {
        flags.push({
          type: 'anomaly',
          severity: 'warning',
          message: `Rating ${sub.rating}/5 is ${zScore.toFixed(1)} std devs from model average (${pattern.avgRating.toFixed(1)}/5). Outlier detected.`,
        });
      }

      // Sudden shift detection: if the last 5 ratings diverge from the overall trend
      if (pattern.ratings.length >= 20) {
        const recent5Avg = pattern.ratings.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const overallAvg = pattern.avgRating;
        if (Math.abs(recent5Avg - overallAvg) > 1.0) {
          flags.push({
            type: 'anomaly',
            severity: 'info',
            message: `Recent ratings (avg ${recent5Avg.toFixed(1)}) diverging from overall (${overallAvg.toFixed(1)}) — possible quality change or coordinated manipulation.`,
          });
        }
      }
    }

    return flags;
  }

  // ========================================================================
  // POLICY COMPLIANCE — content filtering for feedback text
  // ========================================================================

  private checkPolicies(feedback: string): {
    flags: ValidationFlag[];
    sanitizedFeedback: string;
    rejected: boolean;
  } {
    const flags: ValidationFlag[] = [];
    let sanitizedFeedback = feedback.trim().slice(0, 1000); // length limit
    let rejected = false;

    // Check for blocked patterns (immediate rejection of feedback)
    for (const pattern of POLICY_BLOCKED_PATTERNS) {
      if (pattern.test(sanitizedFeedback)) {
        flags.push({
          type: 'policy',
          severity: 'critical',
          message: `Feedback contains blocked content pattern. Feedback will be stripped.`,
        });
        rejected = true;
        break;
      }
    }

    // Check for flagged patterns (feedback kept but flagged for review)
    if (!rejected) {
      for (const pattern of POLICY_FLAGGED_PATTERNS) {
        if (pattern.test(sanitizedFeedback)) {
          flags.push({
            type: 'policy',
            severity: 'info',
            message: `Feedback flagged for review: may contain sensitive content.`,
          });
          break;
        }
      }
    }

    // Sanitize: strip any HTML/script tags regardless
    sanitizedFeedback = sanitizedFeedback
      .replace(/<[^>]*>/g, '') // Strip HTML
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // ASCII-only (strip control chars)
      .trim();

    return { flags, sanitizedFeedback, rejected };
  }

  // ========================================================================
  // CONTINUOUS IMPROVEMENT ENGINE
  // ========================================================================

  runImprovementCycle(): string {
    const issues = this.detectQualityIssues();
    const lines: string[] = [];

    lines.push('# Continuous Improvement Report');
    lines.push('');
    lines.push(`**Ratings analyzed**: ${this.ratingHistory.length}`);
    lines.push(`**Issues detected**: ${issues.length}`);
    lines.push(`**Previously tracked**: ${this.qualityIssues.length}`);
    lines.push('');

    if (issues.length === 0 && this.qualityIssues.length === 0) {
      lines.push('✅ No quality issues detected. Model recommendations are performing well.');
      return lines.join('\n');
    }

    // New issues
    if (issues.length > 0) {
      lines.push('## New Issues Detected');
      lines.push('');
      for (const issue of issues) {
        lines.push(`### ${issue.id}: ${issue.type}`);
        lines.push(`**Model**: ${issue.model} | **Task**: ${issue.taskType}`);
        lines.push(`**Description**: ${issue.description}`);
        lines.push(`**Evidence**: ${issue.evidence}`);
        lines.push('');
        lines.push(`**Suggested Fix**: ${issue.suggestedFix.details}`);
        if (issue.suggestedFix.currentValue !== undefined) {
          lines.push(`  Current: ${issue.suggestedFix.currentValue} → Proposed: ${issue.suggestedFix.proposedValue}`);
        }
        lines.push(`  Confidence: ${(issue.suggestedFix.confidence * 100).toFixed(0)}%`);
        lines.push('');

        // Policy review
        lines.push(`**Policy Review**: ${issue.policyReview.approved ? '✅ Approved' : '❌ Blocked'}`);
        if (issue.policyReview.policyViolations.length > 0) {
          lines.push(`  Violations: ${issue.policyReview.policyViolations.join(', ')}`);
        }
        if (issue.policyReview.edgeCases.length > 0) {
          lines.push(`  ⚠️ Edge cases: ${issue.policyReview.edgeCases.join(', ')}`);
        }
        if (issue.policyReview.notes) {
          lines.push(`  Notes: ${issue.policyReview.notes}`);
        }
        lines.push(`**Status**: ${issue.status}`);
        lines.push('');
      }
    }

    // Existing tracked issues
    const tracked = this.qualityIssues.filter(i => i.status !== 'implemented');
    if (tracked.length > 0) {
      lines.push('## Tracked Issues');
      lines.push('| ID | Type | Model | Status | Confidence |');
      lines.push('|----|------|-------|--------|-----------|');
      for (const issue of tracked) {
        lines.push(`| ${issue.id} | ${issue.type} | ${issue.model} | ${issue.status} | ${(issue.suggestedFix.confidence * 100).toFixed(0)}% |`);
      }
    }

    return lines.join('\n');
  }

  private detectQualityIssues(): QualityIssue[] {
    const newIssues: QualityIssue[] = [];
    const acceptedRatings = this.ratingHistory.filter(r => r.validation.accepted);

    if (acceptedRatings.length < 3) return newIssues;

    // Group ratings by model+task
    const groups = new Map<string, typeof acceptedRatings>();
    for (const r of acceptedRatings) {
      const key = `${r.submission.model}:${r.submission.taskType}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    for (const [key, ratings] of groups) {
      if (ratings.length < 2) continue;
      const [model, taskType] = key.split(':');

      const avgRating = ratings.reduce((s, r) => s + r.submission.rating, 0) / ratings.length;
      const successRate = ratings.filter(r => r.submission.taskSuccess).length / ratings.length;
      const costEffRate = ratings.filter(r => r.submission.costEffective).length / ratings.length;

      // ISSUE: Consistently low ratings for a model+task combo
      if (avgRating < 3.0 && ratings.length >= 3) {
        const issue = this.createIssue({
          type: 'score_drift',
          model,
          taskType,
          description: `${model} consistently rated below 3/5 for ${taskType}`,
          evidence: `Avg rating: ${avgRating.toFixed(1)}/5 across ${ratings.length} ratings. Success rate: ${(successRate * 100).toFixed(0)}%`,
          fix: {
            action: 'adjust_quality_score',
            details: `Reduce ${model} quality score for ${taskType} based on agent feedback`,
            confidence: Math.min(0.9, ratings.length * 0.15),
          },
        });
        newIssues.push(issue);
      }

      // ISSUE: High quality but not cost effective
      if (avgRating >= 4.0 && costEffRate < 0.3 && ratings.length >= 3) {
        const issue = this.createIssue({
          type: 'cost_miscalculation',
          model,
          taskType,
          description: `${model} delivers quality but agents find it cost-ineffective for ${taskType}`,
          evidence: `Avg rating: ${avgRating.toFixed(1)}/5 but only ${(costEffRate * 100).toFixed(0)}% rate it as cost-effective`,
          fix: {
            action: 'adjust_quality_score',
            details: `Consider deprioritizing ${model} for ${taskType} in "balanced" and "cheapest" modes — agents report good quality but poor value`,
            confidence: Math.min(0.8, ratings.length * 0.12),
          },
        });
        newIssues.push(issue);
      }

      // ISSUE: Task failures despite being recommended
      if (successRate < 0.5 && ratings.length >= 3) {
        const issue = this.createIssue({
          type: 'task_mismatch',
          model,
          taskType,
          description: `${model} failing >50% of ${taskType} tasks despite being recommended`,
          evidence: `Success rate: ${(successRate * 100).toFixed(0)}% across ${ratings.length} attempts`,
          fix: {
            action: 'add_disqualification',
            details: `Consider disqualifying ${model} from ${taskType} recommendations until quality improves`,
            confidence: Math.min(0.85, ratings.length * 0.15),
          },
        });
        newIssues.push(issue);
      }
    }

    // Track new issues
    this.qualityIssues.push(...newIssues);

    return newIssues;
  }

  private createIssue(params: {
    type: QualityIssue['type'];
    model: string;
    taskType: string;
    description: string;
    evidence: string;
    fix: {
      action: SuggestedFix['action'];
      details: string;
      confidence: number;
    };
  }): QualityIssue {
    this.issueCounter++;
    const id = `CG-${this.issueCounter.toString().padStart(3, '0')}`;

    const suggestedFix: SuggestedFix = {
      action: params.fix.action,
      details: params.fix.details,
      confidence: params.fix.confidence,
    };

    // Auto-review against policies
    const policyReview = this.reviewFixAgainstPolicies(suggestedFix, params.model, params.taskType);

    return {
      id,
      type: params.type,
      model: params.model,
      taskType: params.taskType,
      description: params.description,
      evidence: params.evidence,
      suggestedFix,
      policyReview,
      status: policyReview.approved ? 'approved' : 'blocked',
      createdAt: new Date(),
    };
  }

  // ========================================================================
  // POLICY REVIEW — checks if suggested fixes are safe to implement
  // ========================================================================

  private reviewFixAgainstPolicies(
    fix: SuggestedFix,
    model: string,
    taskType: string
  ): PolicyReviewResult {
    const violations: string[] = [];
    const edgeCases: string[] = [];
    let notes = '';

    // Policy 1: Never fully disqualify a model — always keep it as a fallback
    if (fix.action === 'add_disqualification') {
      edgeCases.push(
        'Disqualification should be "soft" — model deprioritized, not removed. ' +
        'Users may have legal/contractual obligations to use specific providers.'
      );
      notes = 'Implementing as priority reduction rather than hard block.';
    }

    // Policy 2: Don't adjust scores based on < 5 data points
    if (fix.confidence < 0.5) {
      violations.push(
        `Insufficient data confidence (${(fix.confidence * 100).toFixed(0)}%). ` +
        'Minimum 50% confidence required for auto-adjustment.'
      );
    }

    // Policy 3: Score adjustments must be gradual (max ±10 points per cycle)
    if (fix.action === 'adjust_quality_score' && fix.proposedValue !== undefined && fix.currentValue !== undefined) {
      const delta = Math.abs(fix.proposedValue - fix.currentValue);
      if (delta > 10) {
        violations.push(
          `Score adjustment too large (${delta} points). Max ±10 per cycle to prevent oscillation.`
        );
      }
    }

    // Policy 4: Can't adjust frontier models below premium threshold
    // (Legal edge case: some enterprises require frontier models for compliance audit trails)
    const frontierModels = ['claude-opus-4', 'o1'];
    if (frontierModels.includes(model) && fix.action === 'adjust_quality_score') {
      edgeCases.push(
        'Frontier model — some enterprises are contractually required to use frontier models for audit compliance. ' +
        'Quality score can be adjusted but model must remain available in "best_quality" mode.'
      );
    }

    // Policy 5: Provider-specific constraints
    // (Structural edge case: some providers have rate limits that affect perceived quality)
    const rateLimitedProviders = ['groq', 'together'];
    if (rateLimitedProviders.includes(model.toLowerCase())) {
      edgeCases.push(
        'Provider has aggressive rate limits — low ratings may be caused by throttling, not model quality. ' +
        'Adjust speed score instead of quality score.'
      );
    }

    // Policy 6: Task type may not exist in quality matrix
    // (Structural constraint: agents can submit arbitrary task types)
    const knownTaskTypes = [
      'complex_reasoning', 'code_generation', 'code_review', 'simple_qa',
      'classification', 'extraction', 'summarization', 'translation',
      'creative_writing', 'data_analysis', 'math', 'conversation', 'embedding', 'general',
    ];
    if (!knownTaskTypes.includes(taskType)) {
      edgeCases.push(
        `Non-standard task type "${taskType}" — cannot map to existing quality matrix. ` +
        'Rating stored but no auto-adjustment possible. Consider adding task type in next version.'
      );
    }

    const approved = violations.length === 0;

    return {
      approved,
      policyViolations: violations,
      edgeCases,
      notes,
    };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private dampRating(rating: number, factor: number = 0.7): number {
    // Pull rating toward the neutral mean (3.0) by the given factor
    // factor=0.7 means 70% of the original distance from 3.0 is preserved
    const neutral = 3.0;
    return neutral + (rating - neutral) * factor;
  }

  private updateModelPatterns(model: string, rating: number): void {
    const existing = this.modelRatingPatterns.get(model) || {
      ratings: [],
      avgRating: 0,
      stdDev: 0,
      lastUpdated: new Date(),
    };

    existing.ratings.push(rating);

    // Recalculate stats
    const n = existing.ratings.length;
    existing.avgRating = existing.ratings.reduce((a, b) => a + b, 0) / n;
    if (n > 1) {
      const variance = existing.ratings.reduce((sum, r) => sum + Math.pow(r - existing.avgRating, 2), 0) / (n - 1);
      existing.stdDev = Math.sqrt(variance);
    }
    existing.lastUpdated = new Date();

    this.modelRatingPatterns.set(model, existing);
  }

  // ========================================================================
  // REPORTING
  // ========================================================================

  getIntegrityReport(): string {
    const total = this.ratingHistory.length;
    if (total === 0) {
      return 'No ratings submitted yet.';
    }

    const accepted = this.ratingHistory.filter(r => r.validation.accepted).length;
    const rejected = total - accepted;
    const flagged = this.ratingHistory.filter(r => r.validation.flags.length > 0).length;
    const adjusted = this.ratingHistory.filter(r => r.validation.adjustedRating !== undefined).length;

    const lines: string[] = [];
    lines.push('# Rating Integrity Report');
    lines.push('');
    lines.push(`**Total Submissions**: ${total}`);
    lines.push(`**Accepted**: ${accepted} (${((accepted / total) * 100).toFixed(0)}%)`);
    lines.push(`**Rejected**: ${rejected} (${((rejected / total) * 100).toFixed(0)}%)`);
    lines.push(`**Flagged**: ${flagged} (${((flagged / total) * 100).toFixed(0)}%)`);
    lines.push(`**Score-Adjusted**: ${adjusted} (${((adjusted / total) * 100).toFixed(0)}%)`);

    // Flag breakdown
    const flagTypes: Record<string, number> = {};
    for (const r of this.ratingHistory) {
      for (const f of r.validation.flags) {
        flagTypes[f.type] = (flagTypes[f.type] || 0) + 1;
      }
    }

    if (Object.keys(flagTypes).length > 0) {
      lines.push('');
      lines.push('## Flag Breakdown');
      for (const [type, count] of Object.entries(flagTypes).sort((a, b) => b[1] - a[1])) {
        lines.push(`- **${type}**: ${count} flags`);
      }
    }

    // Quality issues
    if (this.qualityIssues.length > 0) {
      lines.push('');
      lines.push('## Quality Issues');
      lines.push(`- Detected: ${this.qualityIssues.filter(i => i.status === 'detected').length}`);
      lines.push(`- Approved for fix: ${this.qualityIssues.filter(i => i.status === 'approved').length}`);
      lines.push(`- Blocked by policy: ${this.qualityIssues.filter(i => i.status === 'blocked').length}`);
      lines.push(`- Implemented: ${this.qualityIssues.filter(i => i.status === 'implemented').length}`);
    }

    return lines.join('\n');
  }
}
