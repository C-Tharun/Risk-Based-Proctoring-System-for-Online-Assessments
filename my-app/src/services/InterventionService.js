import { supabase } from "@/lib/supabase";

class InterventionService {
  constructor() {
    this.interventionHistory = new Map(); // Track interventions per session
    this.warningThresholds = {
      LOW: 30,
      MEDIUM: 50,
      HIGH: 80
    };
  }

  // Handle intervention based on risk assessment
  async handleIntervention(examSessionId, intervention, userId) {
    const sessionHistory = this.getSessionHistory(examSessionId);
    const response = await this.determineResponse(intervention, sessionHistory);
    
    await this.executeIntervention(examSessionId, userId, response);
    this.updateInterventionHistory(examSessionId, response);
    
    return response;
  }

  // Get intervention history for a session
  getSessionHistory(examSessionId) {
    if (!this.interventionHistory.has(examSessionId)) {
      this.interventionHistory.set(examSessionId, []);
    }
    return this.interventionHistory.get(examSessionId);
  }

  // Determine appropriate response based on intervention type and history
  async determineResponse(intervention, sessionHistory) {
    const recentInterventions = sessionHistory.filter(
      i => Date.now() - i.timestamp < 300000 // last 5 minutes
    );

    const response = {
      ...intervention,
      actions: [],
      timestamp: Date.now()
    };

    switch (intervention.type) {
      case 'TERMINATE':
        response.actions.push({
          type: 'END_EXAM',
          message: 'Exam terminated due to critical violations'
        });
        break;

      case 'WARNING':
        // Escalate warning if multiple recent warnings
        if (recentInterventions.filter(i => i.type === 'WARNING').length >= 2) {
          response.actions.push(
            {
              type: 'FINAL_WARNING',
              message: 'Final warning: Continued violations will result in exam termination'
            },
            {
              type: 'NOTIFY_ADMIN',
              message: 'Multiple warnings issued to candidate'
            }
          );
        } else {
          response.actions.push({
            type: 'ISSUE_WARNING',
            message: 'Warning: Suspicious activity detected'
          });
        }
        break;

      case 'MONITOR':
        response.actions.push({
          type: 'INCREASE_MONITORING',
          message: 'Increased monitoring activated'
        });
        break;
    }

    return response;
  }

  // Execute the determined intervention
  async executeIntervention(examSessionId, userId, response) {
    try {
      for (const action of response.actions) {
        switch (action.type) {
          case 'END_EXAM':
            await this.terminateExam(examSessionId);
            break;

          case 'ISSUE_WARNING':
          case 'FINAL_WARNING':
            await this.issueWarning(examSessionId, userId, action.message);
            break;

          case 'NOTIFY_ADMIN':
            await this.notifyAdmin(examSessionId, userId, action.message);
            break;

          case 'INCREASE_MONITORING':
            await this.updateMonitoringLevel(examSessionId, 'ENHANCED');
            break;
        }
      }
    } catch (error) {
      console.error('Error executing intervention:', error);
    }
  }

  // Terminate the exam
  async terminateExam(examSessionId) {
    const { error } = await supabase
      .from('exam_sessions')
      .update({
        completed: true,
        terminated: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', examSessionId);

    if (error) throw error;
  }

  // Issue a warning to the candidate
  async issueWarning(examSessionId, userId, message) {
    const { error } = await supabase
      .from('admin_warnings')
      .insert({
        exam_session_id: examSessionId,
        user_id: userId,
        message,
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  // Notify admin about the situation
  async notifyAdmin(examSessionId, userId, message) {
    const { error } = await supabase
      .from('admin_notifications')
      .insert({
        exam_session_id: examSessionId,
        user_id: userId,
        message,
        status: 'PENDING',
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  // Update monitoring level for the session
  async updateMonitoringLevel(examSessionId, level) {
    const { error } = await supabase
      .from('exam_sessions')
      .update({
        monitoring_level: level,
        updated_at: new Date().toISOString()
      })
      .eq('id', examSessionId);

    if (error) throw error;
  }

  // Update intervention history
  updateInterventionHistory(examSessionId, response) {
    const history = this.getSessionHistory(examSessionId);
    history.push(response);
    
    // Keep only last 10 interventions to manage memory
    if (history.length > 10) {
      history.shift();
    }
  }
}

export const interventionService = new InterventionService(); 