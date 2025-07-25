import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as MediaLibrary from 'expo-media-library';
import { DatabaseService } from './services/DatabaseService';
import { GeminiService } from './services/GeminiService';

const { width, height } = Dimensions.get('window');

export default function App() {
  // State management
  const [currentSession, setCurrentSession] = useState(null);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [instructionSets, setInstructionSets] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [feedback, setFeedback] = useState('Welcome to AI Learning! Create a demo to start.');
  const [cameraPermission, setCameraPermission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Refs
  const cameraRef = useRef(null);
  const geminiService = useRef(new GeminiService());
  const monitoringInterval = useRef(null);

  // Initialize app
  useEffect(() => {
    console.log('🚀 AI Learning App initializing...');
    requestPermissions();
    loadInstructionSets();
  }, []);

  // Request all permissions
  const requestPermissions = async () => {
    try {
      // Camera permission
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraResult.status === 'granted');
      
      // Media library permission
      await MediaLibrary.requestPermissionsAsync();
      
      console.log('📷 Camera permission:', cameraResult.status);
    } catch (error) {
      console.error('❌ Permission error:', error);
      Alert.alert('Error', 'Failed to get required permissions');
    }
  };

  // Load instruction sets from database
  const loadInstructionSets = async () => {
    try {
      console.log('📚 Loading instruction sets...');
      const sets = await DatabaseService.getInstructionSets();
      console.log('✅ Loaded instruction sets:', sets.length);
      setInstructionSets(sets);
    } catch (error) {
      console.error('❌ Error loading instruction sets:', error);
      setFeedback('Error loading lessons. Check your connection.');
    }
  };

  // Real AI analysis of camera image
  const analyzeCurrentAction = async () => {
    if (!cameraRef.current || !currentInstruction) return;

    try {
      console.log('📸 Taking photo for AI analysis...');
      setIsAnalyzing(true);
      setFeedback('📸 Taking photo for analysis...');
      setAttempts(prev => prev + 1);
      
      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true,
      });

      console.log('🤖 Sending to Gemini AI for analysis...');
      setFeedback('🤖 AI is analyzing your action...');

      // Send to Gemini AI for analysis
      const analysis = await geminiService.current.analyzeUserAction(
        photo.base64,
        currentInstruction.instruction_text,
        currentInstruction.expected_action
      );

      console.log('✅ AI Analysis result:', analysis);
      
      // Update score
      if (analysis.isCorrect) {
        setScore(prev => prev + 1);
      }

      // Update feedback
      setFeedback(analysis.feedback || 'Analysis completed');

      // Record attempt in database
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

      // Provide voice feedback
      if (analysis.isCorrect) {
        Speech.speak('Excellent! That is correct!', { pitch: 1.1, rate: 0.9 });
        setTimeout(() => moveToNextInstruction(), 3000);
      } else {
        Speech.speak('That is not quite right. Please try again.', { pitch: 1.0, rate: 0.9 });
      }

    } catch (error) {
      console.error('❌ Analysis error:', error);
      setFeedback(`Analysis failed: ${error.message}`);
      Alert.alert('Error', 'Failed to analyze your action. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start continuous monitoring
  const startMonitoring = () => {
    if (isMonitoring || !currentInstruction) return;

    setIsMonitoring(true);
    setFeedback('👀 AI is now watching... Perform your action!');
    Speech.speak('I am now watching. Please perform the action.');

    // Monitor every 4 seconds
    monitoringInterval.current = setInterval(() => {
      analyzeCurrentAction();
    }, 4000);
  };

  // Stop monitoring
  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (monitoringInterval.current) {
      clearInterval(monitoringInterval.current);
      monitoringInterval.current = null;
    }
    setFeedback('Monitoring stopped.');
  };

  // Start learning session
  const startLearningSession = async (instructionSetId) => {
    try {
      setLoading(true);
      console.log('🎓 Starting session for:', instructionSetId);

      const instructionSet = await DatabaseService.getInstructionSet(instructionSetId);
      const session = await DatabaseService.startLearningSession(null, instructionSetId);
      
      setCurrentSession({ ...session, instructionSet });
      setScore(0);
      setAttempts(0);

      if (instructionSet.instructions?.length > 0) {
        const firstInstruction = instructionSet.instructions[0];
        setCurrentInstruction(firstInstruction);
        setFeedback(`Starting: ${instructionSet.title}`);
        
        Speech.speak(`Let's begin ${instructionSet.title}. ${firstInstruction.instruction_text}`);
      }
    } catch (error) {
      console.error('❌ Error starting session:', error);
      Alert.alert('Error', `Failed to start session: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Move to next instruction
  const moveToNextInstruction = () => {
    if (!currentSession || !currentInstruction) return;

    stopMonitoring(); // Stop current monitoring

    const instructions = currentSession.instructionSet.instructions;
    const currentIndex = instructions.findIndex(inst => inst.id === currentInstruction.id);

    if (currentIndex < instructions.length - 1) {
      const nextInstruction = instructions[currentIndex + 1];
      setCurrentInstruction(nextInstruction);
      setFeedback(`Next: ${nextInstruction.instruction_text}`);
      Speech.speak(nextInstruction.instruction_text);
    } else {
      completeSession();
    }
  };

  // Complete session
  const completeSession = async () => {
    try {
      stopMonitoring();
      
      if (currentSession) {
        await DatabaseService.updateSessionStatus(
          currentSession.id, 
          'completed', 
          new Date().toISOString()
        );
      }

      setCurrentSession(null);
      setCurrentInstruction(null);
      setFeedback(`🎉 Lesson completed! Score: ${score}/${attempts} (${attempts > 0 ? Math.round((score/attempts)*100) : 0}%)`);
      Speech.speak(`Excellent work! You completed the lesson with a score of ${score} out of ${attempts}!`);
    } catch (error) {
      console.error('❌ Error completing session:', error);
    }
  };

  // Create demo lesson
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
          <Text style={styles.subtitle}>Real AI Vision • Real Learning</Text>
          
          {/* Stats */}
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

        {/* Current Instruction */}
        {currentInstruction && (
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>
              🎯 Step {currentInstruction.step_number}
            </Text>
            <Text style={styles.instructionText}>
              {currentInstruction.instruction_text}
            </Text>
          </View>
        )}

        {/* Camera */}
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={Camera.Constants.Type.back}
            ratio="16:9"
          />
          
          {/* Camera overlay */}
          <View style={styles.cameraOverlay}>
            <View style={[styles.monitoringStatus, isMonitoring && styles.monitoring]}>
              <Text style={styles.monitoringText}>
                {isMonitoring ? '👀 AI Watching' : '⏸️ Monitoring Off'}
              </Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsSection}>
          {currentInstruction ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, isMonitoring && styles.stopButton]}
                onPress={isMonitoring ? stopMonitoring : startMonitoring}
                disabled={isAnalyzing}
              >
                <Text style={styles.buttonText}>
                  {isMonitoring ? '⏹️ Stop AI Watching' : '👀 Start AI Monitoring'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={analyzeCurrentAction}
                disabled={loading || isAnalyzing}
              >
                <Text style={styles.buttonText}>
                  {isAnalyzing ? '🤖 Analyzing...' : '📸 Analyze Now'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={createDemoLesson}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating...' : '🎯 Create AI Demo'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Lesson selection */}
          {instructionSets.map(set => (
            <TouchableOpacity
              key={set.id}
              style={styles.lessonButton}
              onPress={() => startLearningSession(set.id)}
              disabled={loading || isMonitoring}
            >
              <Text style={styles.lessonButtonText}>{set.title}</Text>
              <Text style={styles.lessonDescription}>{set.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feedback */}
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>🤖 AI Feedback:</Text>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>

        {/* Session controls */}
        {currentSession && (
          <View style={styles.sessionControls}>
            <TouchableOpacity
              style={styles.warningButton}
              onPress={completeSession}
            >
              <Text style={styles.buttonText}>🏁 End Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Features info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>✨ Real AI Features:</Text>
          <Text style={styles.infoText}>
            • Google Gemini AI vision analysis{'\n'}
            • Real camera with instant feedback{'\n'}
            • Voice instructions and results{'\n'}
            • Supabase database progress tracking{'\n'}
            • Continuous or single-shot monitoring{'\n'}
            • Works with any colored objects!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

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
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginBottom: 20,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
  },
  instructionCard: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 18,
    color: '#666',
    lineHeight: 26,
  },
  cameraContainer: {
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: 350,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monitoringStatus: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  monitoring: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
  },
  monitoringText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  controlsSection: {
    margin: 20,
  },
  primaryButton: {
    backgroundColor: '#4ecdc4',
    padding: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  stopButton: {
    backgroundColor: '#e74c3c',
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
  warningButton: {
    backgroundColor: '#e67e22',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#4ecdc4',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    margin: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackCard: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    elevation: 3,
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
  sessionControls: {
    margin: 20,
  },
  infoCard: {
    margin: 20,
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#e8f5e8',
    borderRadius: 15,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 22,
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
}); 
