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

      await DatabaseService
