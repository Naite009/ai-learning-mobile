# AI Learning Assistant - Mobile App

A real AI-powered learning application that uses your phone's camera and Google Gemini AI to provide interactive learning experiences with voice feedback.

## 🌟 Features

- **Real AI Vision**: Uses Google Gemini 1.5 Pro to analyze camera images
- **Camera Learning**: Point your phone at objects and get instant AI feedback
- **Voice Instructions**: Speaks tasks and feedback aloud
- **Progress Tracking**: Saves learning progress to Supabase database
- **Interactive Lessons**: Multi-step learning sequences
- **Real-time Monitoring**: Continuous or single-shot AI analysis

## 🚀 Quick Start

### Option 1: Test with Expo Go (Recommended)

1. **Install Expo Go** on your Android phone from Google Play Store
2. **Clone this repository**
3. **Install dependencies**: `npm install`
4. **Start the app**: `npx expo start`
5. **Scan QR code** with Expo Go app
6. **Grant camera permissions** when prompted
7. **Create demo lesson** and start learning!

### Option 2: GitHub Codespaces (No Local Setup)

1. **Open this repository in GitHub Codespaces**
2. **Run**: `npx expo start --tunnel`
3. **Scan QR code** with Expo Go app on your phone
4. **Start testing** immediately!

## 📱 How It Works

1. **Create AI Demo**: Tap to create a sample lesson with color recognition tasks
2. **Start Lesson**: Begin the learning sequence
3. **Follow Instructions**: Read the current task (e.g., "Touch something red")
4. **Perform Action**: Do the action in front of your phone's camera
5. **AI Analysis**: Tap "Analyze Now" or use continuous monitoring
6. **Get Feedback**: Receive instant AI feedback and voice confirmation
7. **Progress**: Move to next task when successful

## 🎯 Example Learning Tasks

- **Touch something red with your finger**
- **Point to something blue**
- **Hold up something yellow and show it to the camera**
- **Find and touch something green**

## 🛠️ Technology Stack

- **Frontend**: React Native with Expo
- **AI Vision**: Google Gemini 1.5 Pro
- **Database**: Supabase (PostgreSQL)
- **Voice**: Expo Speech API
- **Camera**: Expo Camera API

## 🔧 Requirements

- **Android phone** with camera
- **Expo Go app** installed
- **Internet connection** for AI analysis
- **Colored objects** to interact with

## 📊 Database Schema

The app uses these Supabase tables:
- `instruction_sets` - Learning lesson collections
- `instructions` - Individual learning tasks
- `learning_sessions` - User learning sessions
- `step_attempts` - Individual task attempts and results

## 🎮 Testing the AI

The app works best with:
- **Good lighting** for camera clarity
- **Distinct colored objects** (red, blue, yellow, green items)
- **Clear hand gestures** when touching or pointing
- **Stable phone position** during analysis

## 🔐 API Configuration

The app comes pre-configured with:
- **Supabase database** for progress tracking
- **Google Gemini API** for AI vision analysis

All credentials are included for demo purposes.

## 🚧 Development

### Local Development
```bash
# Install dependencies
npm install

# Start Expo development server
npx expo start

# Run on specific platform
npx expo start --android
npx expo start --ios
```

### Building APK
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## 📈 Features in Development

- **Custom lesson creation** via mobile interface
- **YouTube video analysis** for automatic lesson generation
- **Offline mode** for basic functionality
- **Multi-language support**
- **Advanced gesture recognition**

## 🎯 Use Cases

- **Early childhood education** - Color and shape recognition
- **Special needs learning** - Interactive skill building
- **Language learning** - Object identification and naming
- **Therapy applications** - Motor skill development
- **Remote learning** - Interactive homework assistance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Expo Go
5. Submit a pull request

## 📄 License

This project is for educational and demonstration purposes.

## 🆘 Troubleshooting

**Camera not working?**
- Grant camera permissions in phone settings
- Ensure good lighting conditions

**AI analysis failing?**
- Check internet connection
- Try with more distinct colored objects
- Ensure objects are clearly visible in camera

**App not starting?**
- Update Expo Go app
- Check node_modules installation
- Try clearing Expo cache

## 🎬 Demo

The app includes a pre-built demo lesson that tests:
1. Touching red objects
2. Pointing to blue objects  
3. Holding up yellow objects

Perfect for immediate testing of AI vision capabilities!

---

**Ready to test real AI vision learning? Install Expo Go and scan the QR code!** 📱🤖
