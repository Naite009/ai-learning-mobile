import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dqioeyzsvhfhikyijkfc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaW9leXpzdmhmaGlreWlqa2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzM0ODksImV4cCI6MjA2ODk0OTQ4OX0.0hrGC7Dpo27jCW2YZwuhuhMTUCUgcHDnj_sppCns4R0';

export const supabase = createClient(supabaseUrl, supabaseKey);

export class DatabaseService {
  
  // ========== EXISTING METHODS ==========
  
  static async createInstructionSet(title, description, sourceType = 'manual', sourceUrl = null) {
    const { data, error } = await supabase
      .from('instruction_sets')
      .insert([{ title, description, source_type: sourceType, source_url: sourceUrl }])
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
      .select(`*, instructions (id, step_number, instruction_text, expected_action, validation_criteria)`)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async addInstruction(instructionSetId, stepNumber, instructionText, expectedAction, validationCriteria) {
    const { data, error } = await supabase
      .from('instructions')
      .insert([{
        instruction_set_id: instructionSetId,
        step_number: stepNumber,
        instruction_text: instructionText,
        expected_action: expectedAction,
        validation_criteria: validationCriteria
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async startLearningSession(userId, instructionSetId) {
    const { data, error } = await supabase
      .from('learning_sessions')
      .insert([{ user_id: userId, instruction_set_id: instructionSetId, status: 'in_progress' }])
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

  static async recordStepAttempt(sessionId, instructionId, userAction, isCorrect, feedbackGiven, attemptNumber = 1) {
    const { data, error } = await supabase
      .from('step_attempts')
      .insert([{
        session_id: sessionId,
        instruction_id: instructionId,
        attempt_number: attemptNumber,
        user_action: userAction,
        is_correct: isCorrect,
        feedback_given: feedbackGiven
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ========== NEW LESSON RECORDING METHODS ==========

  static async saveLessonRecording(lessonData) {
    try {
      const { data, error } = await supabase
        .from('lesson_recordings')
        .insert([{
          instruction_set_id: lessonData.instructionSetId,
          title: lessonData.title || 'Untitled Lesson',
          description: lessonData.description || '',
          duration_ms: lessonData.duration || 0,
          interactions: lessonData.interactions || [],
          recording_metadata: lessonData.recordingMetadata || {}
        }])
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Lesson recording saved:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error saving lesson recording:', error);
      throw error;
    }
  }

  static async getLessonRecording(recordingId) {
    try {
      const { data, error } = await supabase
        .from('lesson_recordings')
        .select('*')
        .eq('id', recordingId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error loading lesson recording:', error);
      throw error;
    }
  }

  static async getLessonRecordings() {
    try {
      const { data, error } = await supabase
        .from('lesson_recordings')
        .select('id, title, description, duration_ms, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error loading lesson recordings:', error);
      return [];
    }
  }

  static async startPlaybackSession(lessonRecordingId, studentId = null) {
    try {
      const { data, error } = await supabase
        .from('playback_sessions')
        .insert([{
          lesson_recording_id: lessonRecordingId,
          student_id: studentId,
          status: 'in_progress'
        }])
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Playback session started:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error starting playback session:', error);
      throw error;
    }
  }

  static async recordStudentAction(playbackSessionId, stepNumber, expectedAction, studentInput, isCorrect, feedback, timestampInLesson) {
    try {
      const { data, error } = await supabase
        .from('student_actions')
        .insert([{
          playback_session_id: playbackSessionId,
          step_number: stepNumber,
          expected_action: expectedAction,
          student_input: studentInput,
          is_correct: isCorrect,
          feedback_given: feedback,
          timestamp_in_lesson: timestampInLesson || 0
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error recording student action:', error);
      throw error;
    }
  }

  static async completePlaybackSession(sessionId, finalScore, totalActions, correctActions) {
    try {
      const { data, error } = await supabase
        .from('playback_sessions')
        .update({
          completed_at: new Date().toISOString(),
          final_score: finalScore,
          total_actions: totalActions,
          correct_actions: correctActions,
          status: 'completed'
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Playback session completed:', sessionId);
      return data;
    } catch (error) {
      console.error('❌ Error completing playback session:', error);
      throw error;
    }
  }

  static async deleteInstructionSet(id) {
    const { error } = await supabase.from('instruction_sets').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  static async deleteLessonRecording(id) {
    const { error } = await supabase.from('lesson_recordings').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}
