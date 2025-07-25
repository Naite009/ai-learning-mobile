import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials
const supabaseUrl = 'https://dqioeyzsvhfhikyijkfc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaW9leXpzdmhmaGlreWlqa2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzM0ODksImV4cCI6MjA2ODk0OTQ4OX0.0hrGC7Dpo27jCW2YZwuhuhMTUCUgcHDnj_sppCns4R0';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database service functions
export class DatabaseService {
  // Instruction Set Management
  static async createInstructionSet(title, description, sourceType = 'manual', sourceUrl = null) {
    const { data, error } = await supabase
      .from('instruction_sets')
      .insert([
        {
          title,
          description,
          source_type: sourceType,
          source_url: sourceUrl
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getInstructionSets() {
    const { data, error } = await supabase
      .from('instruction_sets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getInstructionSet(id) {
    const { data, error } = await supabase
      .from('instruction_sets')
      .select(`
        *,
        instructions (
          id,
          step_number,
          instruction_text,
          expected_action,
          validation_criteria
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // Instructions Management
  static async addInstruction(instructionSetId, stepNumber, instructionText, expectedAction, validationCriteria) {
    const { data, error } = await supabase
      .from('instructions')
      .insert([
        {
          instruction_set_id: instructionSetId,
          step_number: stepNumber,
          instruction_text: instructionText,
          expected_action: expectedAction,
          validation_criteria: validationCriteria
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getInstructions(instructionSetId) {
    const { data, error } = await supabase
      .from('instructions')
      .select('*')
      .eq('instruction_set_id', instructionSetId)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return data;
  }

  // Learning Session Management
  static async startLearningSession(userId, instructionSetId) {
    const { data, error } = await supabase
      .from('learning_sessions')
      .insert([
        {
          user_id: userId,
          instruction_set_id: instructionSetId,
          status: 'in_progress'
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateSessionStatus(sessionId, status, completedAt = null) {
    const updateData = { status };
    if (completedAt) updateData.completed_at = completedAt;

    const { data, error } = await supabase
      .from('learning_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Step Attempts Management
  static async recordStepAttempt(sessionId, instructionId, userAction, isCorrect, feedbackGiven, attemptNumber = 1) {
    const { data, error } = await supabase
      .from('step_attempts')
      .insert([
        {
          session_id: sessionId,
          instruction_id: instructionId,
          attempt_number: attemptNumber,
          user_action: userAction,
          is_correct: isCorrect,
          feedback_given: feedbackGiven
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getSessionProgress(sessionId) {
    const { data, error } = await supabase
      .from('step_attempts')
      .select(`
        *,
        instructions (
          step_number,
          instruction_text
        )
      `)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data;
  }

  // Utility functions
  static async deleteInstructionSet(id) {
    const { error } = await supabase
      .from('instruction_sets')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}
