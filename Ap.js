import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
  TextInput,
  Modal
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as MediaLibrary from 'expo-media-library';
import { DatabaseService } from './services/DatabaseService';
import { GeminiService } from './services/GeminiService';

const { width, height } = Dimensions.get('window');

export default function App() {
  // ========== EXISTING STATES ==========
  const [currentSession, setCurrentSession] = useState(null);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [instructionSets, setInstructionSets] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [feedback, setFeedback] = useState('Welcome to AI Learning!');
  const [cameraPermission, setCameraPermission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ========== NEW STATES FOR RECORDING FEATURE ==========
  const [userMode, setUserMode] = useState('student'); // 'teacher' or 'student'
  const [lessonRecordings, setLessonRecordings] = useState([]);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingData, setRecordingData] = useState({ interactions: [], startTime: null, duration: 0 });
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [currentAction, setCurrentAction] = useState('');

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [playbackScore, setPlaybackScore] = useState({ correct: 0, total: 0 });
  const [studentInput, setStudentInput] = useState('');
  const [playbackSession, setPlaybackSession] = useState(null);

  // Refs
  const cameraRef = useRef(null);
  const geminiService = useRef(new GeminiService());
  const monitoringInterval = useRef(null);
  const recordingTimer = useRef(null);
  const interactionLogger = useRef([]);
  const validationTimer = useRef(null);

  // ========== EXISTING INITIALIZATION ==========
  useEffect(() => {
    console.log('🚀 AI Learning App initializing...');
    requestPermissions();
    loadInstructionSets();
    loadLessonRecordings();
  }, []);

  // ========== EXISTING METHODS (unchanged) ==========
  const requestPermissions = async () => {
    try {
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraResult.status === 'granted');
      await MediaLibrary.requestPermissionsAsync();
      console.log('📷 Camera permission:', cameraResult.status);
    } catch (error) {
      console.error('❌ Permission error:', error);
      Alert.alert('Error', 'Failed to get required permissions');
    }
  };

  const loadInstructionSets = async () => {
    try {
      console.log('📚 Loading instruction sets...');
      const sets = await DatabaseService.getInstructionSets();
      setInstructionSets(sets);
    } catch (error) {
      console.error('❌ Error loading instruction sets:', error);
      setFeedback('Error loading lessons. Check your connection.');
    }
  };

  // ========== NEW METHODS FOR RECORDING FEATURE ==========
  
  // Load lesson recordings
  const loadLessonRecordings = async () => {
    try {
      console.log('🎬 Loading lesson recordings...');
      const recordings = await DatabaseService.getLessonRecordings();
      setLessonRecordings(recordings);
      console.log('✅ Loaded', recordings.length, 'lesson recordings');
    } catch (error) {
      console.error('❌ Error loading lesson recordings:', error);
    }
  };

  // Switch between teacher and student modes
  const switchMode = () => {
    const newMode = userMode === 'teacher' ? 'student' : 'teacher';
    setUserMode(newMode);
    setFeedback(`Switched to ${newMode} mode`);
    Speech.speak(`Switched to ${newMode} mode`);
  };

  // ========== RECORDING METHODS ==========
  
  // Start recording lesson
  const startRecording = async () => {
    if (!lessonTitle.trim()) {
      Alert.alert('Error', 'Please enter a lesson title');
      return;
    }

    try {
      setIsRecording(true);
      setRecordingData({ interactions: [], startTime: Date.now(), duration: 0 });
      interactionLogger.current = [];

      // Start timer
      recordingTimer.current = setInterval(() => {
        setRecordingData(prev => ({
          ...prev,
          duration: Date.now() - prev.startTime
        }));
      }, 1000);

      // Log initial instruction
      logInteraction('instruction', {
        value: 'Lesson started',
        instruction: 'Beginning of lesson recording'
      });

      setFeedback('🔴 Recording started! Perform actions and describe them.');
      Speech.speak('Recording started. Perform your actions while describing them.');
      
    } catch (error) {
      console.error('❌ Recording start error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  // Log interaction during recording
  const logInteraction = (type, data) => {
    if (!isRecording) return;
    
    const timestamp = Date.now() - recordingData.startTime;
    const interaction = {
      timestamp,
      type,
      data: {
        ...data,
        instruction: currentAction || data.instruction
      }
    };
    
    interactionLogger.current.push(interaction);
    console.log('📝 Logged interaction:', interaction);
    setFeedback(`Logged ${type} action: ${data.instruction || data.value}`);
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }

      // Final interaction log
      logInteraction('instruction', {
        value: 'Lesson ended',
        instruction: 'End of lesson recording'
      });

      console.log('🎬 Recording stopped. Total interactions:', interactionLogger.current.length);
      await saveLessonRecording();
      
    } catch (error) {
      console.error('❌ Recording stop error:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  // Save recorded lesson
  const saveLessonRecording = async () => {
    try {
      // Create instruction set first
      const instructionSet = await DatabaseService.createInstructionSet(
        lessonTitle,
        lessonDescription,
        'recorded_lesson'
      );

      // Save recording data
      const lessonData = {
        instructionSetId: instructionSet.id,
        title: lessonTitle,
        description: lessonDescription,
        duration: recordingData.duration,
        interactions: interactionLogger.current,
        recordingMetadata: {
          totalInteractions: interactionLogger.current.length,
          recordedAt: new Date().toISOString(),
          platform: 'mobile',
          version: '1.0'
        }
      };

      await DatabaseService.saveLessonRecording(lessonData);

      Alert.alert(
        '✅ Lesson Saved!', 
        `"${lessonTitle}" has been saved with ${interactionLogger.current.length} interaction points.`,
        [{ text: 'Great!', onPress: () => {
          setShowRecordingModal(false);
          setLessonTitle('');
          setLessonDescription('');
          setCurrentAction('');
          loadLessonRecordings();
        }}]
      );

    } catch (error) {
      console.error('❌ Save lesson error:', error);
      Alert.alert('Error', 'Failed to save lesson recording');
    }
  };

  // ========== PLAYBACK METHODS ==========

  // Start lesson playback
  const startPlayback = async (lessonRecording) => {
    try {
      setSelectedLesson(lessonRecording);
      setIsPlaying(true);
      setCurrentStep(0);
      setPlaybackScore({ correct: 0, total: 0 });
      
      // Start playback session
      const session = await DatabaseService.startPlaybackSession(lessonRecording.id);
      setPlaybackSession(session);
      
      const firstInteraction = lessonRecording.interactions[0];
      if (firstInteraction) {
        setFeedback(`Starting: ${firstInteraction.data?.instruction || 'Follow the instructions'}`);
        Speech.speak(firstInteraction.data?.instruction || 'Let\'s begin the lesson');
      }

      // Start validation timer
      startValidationTimer();
      
    } catch (error) {
      console.error('❌ Playback start error:', error);
      Alert.alert('Error', 'Failed to start lesson playback');
    }
  };

  // Start validation timer for playback
  const startValidationTimer = () => {
    if (validationTimer.current) {
      clearInterval(validationTimer.current);
    }

    validationTimer.current = setInterval(() => {
      if (isPlaying && selectedLesson) {
        validateStudentAction();
      }
    }, 3000); // Check every 3 seconds
  };

  // Validate student action during playback
  const validateStudentAction = async () => {
    if (!selectedLesson || currentStep >= selectedLesson.interactions.length) return;

    const expectedAction = selectedLesson.interactions[currentStep];
    let isCorrect = false;
    let feedbackMessage = '';

    // Simple validation based on action type
    switch (expectedAction.type) {
      case 'input':
        const expectedText = expectedAction.data?.value?.toLowerCase() || '';
        const studentText = studentInput.toLowerCase();
        isCorrect = studentText.includes(expectedText) || expectedText.includes(studentText);
        feedbackMessage = isCorrect 
          ? `Great! You typed "${studentText}" correctly!`
          : `Try typing "${expectedText}"`;
        break;
        
      case 'tap':
        // For demo, simulate tap validation
        isCorrect = Math.random() > 0.3;
        feedbackMessage = isCorrect 
          ? 'Perfect tap!' 
          : 'Try tapping the correct area';
        break;
        
      default:
        isCorrect = true;
        feedbackMessage = 'Continue following the instructions';
    }

    // Update score
    setPlaybackScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    setFeedback(feedbackMessage);
    Speech.speak(isCorrect ? 'Correct!' : 'Try again');

    // Record student action
    if (playbackSession) {
      await DatabaseService.recordStudentAction(
        playbackSession.id,
        currentStep,
        expectedAction,
        { input: studentInput },
        isCorrect,
        feedbackMessage,
        expectedAction.timestamp
      );
    }

    // Move to next step if correct
    if (isCorrect) {
      setTimeout(() => moveToNextStep(), 2000);
    }
  };

  // Move to next step in playback
  const moveToNextStep = () => {
    if (!selectedLesson || currentStep >= selectedLesson.interactions.length - 1) {
      completePlayback();
      return;
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    const nextAction = selectedLesson.interactions[nextStep];
    setFeedback(`Step ${nextStep + 1}: ${nextAction.data?.instruction || 'Follow the next instruction'}`);
    Speech.speak(nextAction.data?.instruction || 'Next step');
    
    setStudentInput(''); // Clear input for next step
  };

  // Complete playback session
  const completePlayback = async () => {
    try {
      setIsPlaying(false);
      if (validationTimer.current) {
        clearInterval(validationTimer.current);
      }

      const finalScore = Math.round((playbackScore.correct / playbackScore.total) * 100);
      
      if (playbackSession) {
        await DatabaseService.completePlaybackSession(
          playbackSession.id,
          finalScore,
          playbackScore.total,
          playbackScore.correct
        );
      }

      setFeedback(`🎉 Lesson completed! Score: ${finalScore}%`);
      Speech.speak(`Excellent work! You scored ${finalScore} percent!`);
      
      Alert.alert(
        '🎉 Lesson Complete!',
        `You scored ${playbackScore.correct} out of ${playbackScore.total} (${finalScore}%)\n\nGreat job!`,
        [{ text: 'Awesome!', onPress: () => setShowPlaybackModal(false) }]
      );
      
    } catch (error) {
      console.error('❌ Playback completion error:', error);
    }
  };

  // ========== EXISTING AI VISION METHODS (unchanged) ==========
  
  const analyzeCurrentAction = async () => {
    if (!cameraRef.current || !currentInstruction) return;

    try {
      console.log('📸 Taking photo for AI analysis...');
      setIsAnalyzing(true);
      setFeedback('📸 Taking photo for analysis...');
      setAttempts(prev => prev + 1);
      
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true,
      });

      console.log('🤖 Sending to Gemini AI for analysis...');
      setFeedback('🤖 AI is analyzing your action...');

      const analysis = await geminiService.current.analyzeUserAction(
        photo.base64,
        currentInstruction.instruction_text,
        currentInstruction.expected_action
      );

      console.log('✅ AI Analysis result:', analysis);
      
      if (analysis.isCorrect) {
        setScore(prev => prev + 1);
      }

      setFeedback(analysis.feedback || 'Analysis completed');

      if (currentSession) {
        try {
          await DatabaseService.recordStepAttempt(
            currentSession.id,
            currentInstruction.id,
            { action: analysis.userAction, objects: analysis.objectsDetected },
            analysis.isCorrect,
            analysis.feedback
          );
        } catch (dbError) {
          console.error('❌ Database recording failed:', dbError);
        }
      }

      if (analysis.isCorrect) {
        Speech.speak('Excellent! That is correct!', { pitch: 1.1, rate: 0.9 });
        setTimeout(() => moveToNextInstruction(), 3000);
      } else {
        Speech.speak('That is not quite right. Please try again.', { pitch: 1.0, rate: 0.9 });
      }

    } catch (error) {
      console.error('❌ Analysis error:', error);
      setFeedback(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createDemoLesson = async () => {
    try {
      setLoading(true);
      
      const instructionSet = await DatabaseService.createInstructionSet(
        'Real AI Vision Demo',
        'Test real AI vision with your phone camera',
        'manual'
      );

      await DatabaseService.addInstruction(
        instructionSet.id,
        1,
        'Touch something red with your finger',
        { type: 'touch', target: 'red', details: 'any red object' },
        { lookFor: ['red object', 'hand touching'], successCondition: 'finger touches red object' }
      );

      await DatabaseService.addInstruction(
        instructionSet.id,
        2,
        'Point to something blue with your finger',
        { type: 'point', target: 'blue', details: 'blue colored object' },
        { lookFor: ['pointing gesture', 'blue object'], successCondition: 'finger points at blue' }
      );

      await DatabaseService.addInstruction(
        instructionSet.id,
        3,
        'Hold up something yellow and show it to the camera',
        { type: 'hold', target: 'yellow', details: 'yellow object held up' },
        { lookFor: ['yellow object', 'holding gesture'], successCondition: 'yellow object held in view' }
      );

      setFeedback('✅ Real AI demo lesson created!');
      Speech.speak('Demo lesson created successfully!');
      await loadInstructionSets();

    } catch (error) {
      console.error('❌ Error creating demo:', error);
      Alert.alert('Error', 'Failed to create demo lesson');
    } finally {
      setLoading(false);
    }
  };

  // Permission check
  if (cameraPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!cameraPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Camera access is required for AI vision</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AI Learning Assistant</Text>
          <Text style={styles.subtitle}>
            {userMode === 'teacher' ? '🎬 Teacher Mode' : '📱 Student Mode'}
          </Text>
          
          {/* Mode Switch */}
          <TouchableOpacity style={styles.modeButton} onPress={switchMode}>
            <Text style={styles.modeButtonText}>
              Switch to {userMode === 'teacher' ? 'Student' : 'Teacher'} Mode
            </Text>
          </TouchableOpacity>
          
          {/* Stats for current session */}
          {(score > 0 || attempts > 0) && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{score}</Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{attempts}</Text>
                <Text style={styles.statLabel}>Attempts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {attempts > 0 ? Math.round((score / attempts) * 100) : 0}%
                </Text>
                <Text style={styles.statLabel}>Success</Text>
              </View>
            </View>
          )}
        </View>

        {/* Camera */}
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={Camera.Constants.Type.back}
            ratio="16:9"
          />
        </View>

        {/* Mode-specific content */}
        {userMode === 'teacher' ? (
          /* ========== TEACHER MODE ========== */
          <View style={styles.teacherSection}>
            <Text style={styles.sectionTitle}>🎬 Teacher Tools</Text>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowRecordingModal(true)}
            >
              <Text style={styles.buttonText}>📹 Record New Lesson</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={createDemoLesson}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating...' : '🎯 Create AI Vision Demo'}
              </Text>
            </TouchableOpacity>

            {/* Recorded Lessons */}
            {lessonRecordings.length > 0 && (
              <View style={styles.recordingsSection}>
                <Text style={styles.subsectionTitle}>📚 Your Recorded Lessons:</Text>
                {lessonRecordings.slice(0, 3).map(recording => (
                  <View key={recording.id} style={styles.recordingCard}>
                    <Text style={styles.recordingTitle}>{recording.title}</Text>
                    <Text style={styles.recordingDescription}>{recording.description}</Text>
                    <Text style={styles.recordingDuration}>
                      Duration: {Math.round(recording.duration_ms / 1000)}s
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* ========== STUDENT MODE ========== */
          <View style={styles.studentSection}>
            <Text style={styles.sectionTitle}>📱 Student Learning</Text>
            
            {/* AI Vision Lessons */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={createDemoLesson}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating...' : '🤖 Try AI Vision Demo'}
              </Text>
            </TouchableOpacity>

            {/* Recorded Lessons */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowPlaybackModal(true)}
            >
              <Text style={styles.buttonText}>📺 Watch Recorded Lessons</Text>
            </TouchableOpacity>

            {/* Available AI Vision Lessons */}
            {instructionSets.map(set => (
              <TouchableOpacity
                key={set.id}
                style={styles.lessonButton}
                onPress={() => startLearningSession(set.id)}
                disabled={loading}
              >
                <Text style={styles.lessonButtonText}>{set.title}</Text>
                <Text style={styles.lessonDescription}>{set.description}</Text>
              </TouchableOpacity>
            ))}

            {/* AI Analysis Button */}
            {currentInstruction && (
              <TouchableOpacity
                style={[styles.analyzeButton, isAnalyzing && styles.analyzing]}
                onPress={analyzeCurrentAction}
                disabled={isAnalyzing}
              >
                <Text style={styles.buttonText}>
                  {isAnalyzing ? '🤖 AI Analyzing...' : '📸 Let AI Check My Action'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Feedback */}
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>💬 Feedback:</Text>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      </ScrollView>

      {/* ========== RECORDING MODAL ========== */}
      <Modal
        visible={showRecordingModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎬 Record New Lesson</Text>
            <TouchableOpacity onPress={() => setShowRecordingModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TextInput
              style={styles.textInput}
              placeholder="Lesson Title"
              value={lessonTitle}
              onChangeText={setLessonTitle}
              editable={!isRecording}
            />
            
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Lesson Description"
              value={lessonDescription}
              onChangeText={setLessonDescription}
              multiline
              numberOfLines={3}
              editable={!isRecording}
            />

            <TextInput
              style={styles.textInput}
              placeholder="Current Action (describe what you're doing)"
              value={currentAction}
              onChangeText={setCurrentAction}
              editable={isRecording}
            />

            {isRecording && (
              <View style={styles.recordingStatus}>
                <Text style={styles.recordingTime}>
                  ⏱️ Recording: {Math.floor(recordingData.duration / 1000)}s
                </Text>
                <Text style={styles.interactionCount}>
                  📍 Actions: {interactionLogger.current.length}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.stopButton]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={!isRecording && (!lessonTitle || !lessonDescription)}
            >
              <Text style={styles.buttonText}>
                {isRecording ? '⏹️ Stop Recording' : '🎬 Start Recording'}
              </Text>
            </TouchableOpacity>

            {isRecording && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => logInteraction('input', { value: currentAction })}
                >
                  <Text style={styles.actionButtonText}>⌨️ Log Input</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => logInteraction('tap', { instruction: currentAction })}
                >
                  <Text style={styles.actionButtonText}>👆 Log Tap</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => logInteraction('instruction', { value: currentAction })}
                >
                  <Text style={styles.actionButtonText}>💬 Log Instruction</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ========== PLAYBACK MODAL ========== */}
      <Modal
        visible={showPlaybackModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📺 Recorded Lessons</Text>
            <TouchableOpacity onPress={() => setShowPlaybackModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {isPlaying && selectedLesson ? (
              /* Playback Interface */
              <View style={styles.playbackInterface}>
                <Text style={styles.playbackTitle}>{selectedLesson.title}</Text>
                <Text style={styles.playbackProgress}>
                  Step {currentStep + 1} of {selectedLesson.interactions.length}
                </Text>
                <Text style={styles.playbackScore}>
                  Score: {playbackScore.correct}/{playbackScore.total}
                </Text>

                {selectedLesson.interactions[currentStep]?.type === 'input' && (
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Type here:</Text>
                    <TextInput
                      style={styles.studentInput}
                      placeholder={`Type: ${selectedLesson.interactions[currentStep]?.data?.value || 'expected text'}`}
                      value={studentInput}
                      onChangeText={setStudentInput}
                      multiline
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.validateButton}
                  onPress={validateStudentAction}
                >
                  <Text style={styles.buttonText}>✓ Check My Work</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={completePlayback}
                >
                  <Text style={styles.buttonText}>⏹️ Stop Lesson</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Lesson Selection */
              <View>
                {lessonRecordings.length === 0 ? (
                  <Text style={styles.noLessonsText}>
                    No recorded lessons available. Switch to Teacher mode to create some!
                  </Text>
                ) : (
                  lessonRecordings.map(recording => (
                    <TouchableOpacity
                      key={recording.id}
                      style={styles.lessonCard}
                      onPress={() => startPlayback(recording)}
                    >
                      <Text style={styles.lessonCardTitle}>{recording.title}</Text>
                      <Text style={styles.lessonCardDescription}>{recording.description}</Text>
                      <Text style={styles.lessonCardDuration}>
                        Duration: {Math.round(recording.duration_ms / 1000)}s
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    marginBottom: 15,
  },
  modeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 15,
  },
  modeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
  },
  cameraContainer: {
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
  },
  camera: {
    width: '100%',
    height: 250,
  },
  teacherSection: {
    margin: 20,
  },
  studentSection: {
    margin: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 20,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#4ecdc4',
    padding: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 12,
  },
  lessonButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 10,
    elevation: 2,
  },
  lessonButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  lessonDescription: {
    fontSize: 14,
    color: '#666',
  },
  analyzeButton: {
    backgroundColor: '#f39c12',
    padding: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
  },
  analyzing: {
    backgroundColor: '#e67e22',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recordingsSection: {
    marginTop: 20,
  },
  recordingCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  recordingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  recordingDuration: {
    fontSize: 12,
    color: '#999',
  },
  feedbackCard: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    elevation: 3,
    marginBottom: 40,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  feedbackText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#8e44ad',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  recordingStatus: {
    backgroundColor: '#ffe6e6',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c0392b',
    marginBottom: 5,
  },
  interactionCount: {
    fontSize: 14,
    color: '#e74c3c',
  },
  recordButton: {
    backgroundColor: '#e74c3c',
    padding: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  stopButton: {
    backgroundColor: '#c0392b',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#f39c12',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
    minWidth: '30%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Playback Styles
  playbackInterface: {
    padding: 20,
  },
  playbackTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  playbackProgress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  playbackScore: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  studentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  validateButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 10,
  },
  lessonCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  lessonCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  lessonCardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  lessonCardDuration: {
    fontSize: 12,
    color: '#999',
  },
  noLessonsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4ecdc4',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    margin: 20,
  },
});
