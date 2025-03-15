import { supabase } from "@/lib/supabase";

class RiskAssessmentService {
  constructor() {
    // Initialize with default weights that can be adjusted based on historical data
    this.riskFactors = {
      tabSwitch: { weight: 0.3, threshold: 3 },
      mouseLeave: { weight: 0.25, threshold: 2 },
      inactivity: { weight: 0.2, threshold: 300 }, // 5 minutes in seconds
      rapidMovement: { weight: 0.15, threshold: 10 }, // movements per second
      copyPaste: { weight: 0.1, threshold: 1 }
    };

    // Maintain session context for adaptive decision making
    this.sessionContext = {
      violations: [],
      warningCount: 0,
      lastAssessmentTime: Date.now(),
      riskTrend: [], // Track risk score progression
    };
  }

  // Calculate risk score based on multiple factors and their weights
  calculateRiskScore(behaviors) {
    let totalRisk = 0;
    let riskDetails = [];

    for (const [behavior, data] of Object.entries(behaviors)) {
      if (this.riskFactors[behavior]) {
        const { weight, threshold } = this.riskFactors[behavior];
        const severity = data.value / threshold;
        const riskContribution = weight * Math.min(severity, 1);
        
        totalRisk += riskContribution;
        riskDetails.push({
          type: behavior,
          severity,
          contribution: riskContribution
        });
      }
    }

    // Normalize risk score to 0-100 range
    return {
      score: Math.min(Math.round(totalRisk * 100), 100),
      details: riskDetails
    };
  }

  // Analyze behavior patterns to detect anomalies
  async analyzeBehaviorPatterns(examSessionId, behaviors) {
    const { mouseMovements, keystrokes, tabSwitches, timeInactive } = behaviors;
    
    // Calculate behavior metrics
    const behaviorMetrics = {
      tabSwitch: { value: tabSwitches },
      mouseLeave: { value: behaviors.mouseLeaveCount || 0 },
      inactivity: { value: timeInactive / 1000 }, // Convert to seconds
      rapidMovement: { value: this.calculateMovementIntensity(mouseMovements) },
      copyPaste: { value: behaviors.copyPasteAttempts || 0 }
    };

    // Get risk assessment
    const riskAssessment = this.calculateRiskScore(behaviorMetrics);
    
    // Update session context
    this.sessionContext.riskTrend.push(riskAssessment.score);
    
    // Store violation if risk is significant
    if (riskAssessment.score > 30) {
      await this.recordViolation(examSessionId, riskAssessment);
    }

    return riskAssessment;
  }

  // Calculate intensity of mouse movements
  calculateMovementIntensity(movements) {
    if (!movements || movements.length < 2) return 0;
    
    let totalDistance = 0;
    let timeSpan = movements[movements.length - 1].timestamp - movements[0].timestamp;
    
    for (let i = 1; i < movements.length; i++) {
      const dx = movements[i].x - movements[i-1].x;
      const dy = movements[i].y - movements[i-1].y;
      totalDistance += Math.sqrt(dx*dx + dy*dy);
    }
    
    return totalDistance / (timeSpan / 1000); // pixels per second
  }

  // Record violation in the database
  async recordViolation(examSessionId, riskAssessment) {
    try {
      // Record the violation
      const { error: violationError } = await supabase.from("exam_violations").insert({
        exam_session_id: examSessionId,
        risk_score: riskAssessment.score,
        reason: riskAssessment.details.map(d => `${d.type}: ${(d.contribution * 100).toFixed(1)}%`).join(', '),
        details: riskAssessment.details,
      });

      if (violationError) throw violationError;

      // Update exam session risk score and warnings
      const { error: sessionError } = await supabase
        .from("exam_sessions")
        .update({
          risk_score: riskAssessment.score,
          warnings: supabase.sql`warnings + 1`,
          updated_at: new Date().toISOString()
        })
        .eq("id", examSessionId);

      if (sessionError) throw sessionError;
      
      this.sessionContext.violations.push({
        timestamp: Date.now(),
        score: riskAssessment.score
      });

      // Record behavior logs
      const behaviorLogs = riskAssessment.details.map(detail => ({
        exam_session_id: examSessionId,
        behavior_type: detail.type,
        behavior_data: { severity: detail.severity },
        risk_contribution: detail.contribution,
      }));

      const { error: logsError } = await supabase
        .from("behavior_logs")
        .insert(behaviorLogs);

      if (logsError) throw logsError;

    } catch (error) {
      console.error("Error recording violation:", error);
    }
  }

  // Get recommended intervention based on risk assessment
  getRecommendedIntervention(riskAssessment) {
    const recentViolations = this.sessionContext.violations.filter(
      v => Date.now() - v.timestamp < 300000 // violations in last 5 minutes
    );

    // Determine intervention based on risk score and violation history
    if (riskAssessment.score >= 80) {
      return {
        type: 'TERMINATE',
        reason: 'Critical risk level detected',
        urgency: 'HIGH'
      };
    } else if (riskAssessment.score >= 50 || recentViolations.length >= 3) {
      return {
        type: 'WARNING',
        reason: 'Multiple suspicious activities detected',
        urgency: 'MEDIUM'
      };
    } else if (riskAssessment.score >= 30) {
      return {
        type: 'MONITOR',
        reason: 'Elevated risk behavior detected',
        urgency: 'LOW'
      };
    }

    return {
      type: 'NONE',
      reason: 'Normal behavior',
      urgency: 'NONE'
    };
  }

  // Update risk factor weights based on historical data
  async updateRiskFactorWeights() {
    try {
      // Fetch historical violation data
      const { data: violations, error } = await supabase
        .from("exam_violations")
        .select("details")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (violations.length > 0) {
        // Calculate new weights based on violation frequency and severity
        const weightUpdates = this.calculateNewWeights(violations);
        
        // Update weights gradually to avoid sudden changes
        for (const [factor, newWeight] of Object.entries(weightUpdates)) {
          if (this.riskFactors[factor]) {
            this.riskFactors[factor].weight = 
              0.8 * this.riskFactors[factor].weight + 0.2 * newWeight;
          }
        }
      }
    } catch (error) {
      console.error("Error updating risk factor weights:", error);
    }
  }

  // Calculate new weights based on historical violations
  calculateNewWeights(violations) {
    const factorFrequency = {};
    const factorSeverity = {};
    
    violations.forEach(violation => {
      violation.details.forEach(detail => {
        factorFrequency[detail.type] = (factorFrequency[detail.type] || 0) + 1;
        factorSeverity[detail.type] = (factorSeverity[detail.type] || 0) + detail.severity;
      });
    });

    // Normalize frequencies and severities
    const totalViolations = violations.length;
    const weights = {};
    
    for (const factor of Object.keys(this.riskFactors)) {
      const frequency = factorFrequency[factor] || 0;
      const severity = factorSeverity[factor] || 0;
      
      weights[factor] = (frequency / totalViolations + severity / totalViolations) / 2;
    }

    return weights;
  }
}

export const riskAssessmentService = new RiskAssessmentService(); 