import { GoogleGenerativeAI } from '@google/generative-ai';

// Your Google API key
const API_KEY = 'AIzaSyDtOODij_r8v4IhYag09jznXKDoyVnjN14';
const genAI = new GoogleGenerativeAI(API_KEY);

export class GeminiService {
  constructor() {
    // Use working model for vision analysis
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    console.log('🤖 GeminiService initialized with gemini-1.5-pro');
  }

  // Analyze image and compare with expected action
  async analyzeUserAction(imageData, instruction, expectedAction) {
    try {
      console.log('🔍 Starting Gemini analysis...');
      console.log('📝 Instruction:', instruction);
      console.log('🎯 Expected action:', expectedAction);
      
      const prompt = `You are an AI tutor analyzing what a user is doing based on mobile camera input.

Current Instruction: "${instruction}"
Expected Action: ${JSON.stringify(expectedAction)}

Analyze the image and determine:
1. What objects, colors, and shapes are visible?
2. What action is the user performing (touching, pointing, holding, showing)?
3. Does the user's action match the expected action?
4. Provide specific, encouraging feedback.

Focus on:
- Hand gestures and positions
- Object colors (red, blue, yellow, green, etc.)
- Touch interactions (finger touching objects)
- Pointing gestures (finger pointing at objects)
- Holding/showing objects to camera

Respond with ONLY a valid JSON object in this exact format:
{
  "objectsDetected": ["list of objects and colors you see"],
  "userAction": "specific description of what the user is doing",
  "isCorrect": true,
  "feedback": "encouraging and specific feedback message",
  "confidence": 0.8
}

Set isCorrect to true if the user is doing what the instruction asks, false otherwise.
Be encouraging in your feedback and specific about what you observed.
Do not include any text before or after the JSON object.`;

      console.log('📤 Sending request to Gemini...');
      
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const response = await result.response;
      let text = response.text().trim();
      
      console.log('📥 Raw Gemini response length:', text.length);
      console.log('📥 First 200 chars:', text.substring(0, 200));
      
      // Clean up the response - remove any markdown formatting
      if (text.startsWith('```json')) {
        text = text.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      if (text.startsWith('```')) {
        text = text.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      console.log('🧹 Cleaned response length:', text.length);
      
      // Parse JSON response
      try {
        const parsedResponse = JSON.parse(text);
        console.log('✅ Parsed Gemini response successfully');
        console.log('🎯 Is correct:', parsedResponse.isCorrect);
        console.log('💬 Feedback:', parsedResponse.feedback);
        
        // Validate the response has required fields
        if (!parsedResponse.feedback || typeof parsedResponse.isCorrect !== 'boolean') {
          throw new Error('Invalid response structure - missing required fields');
        }
        
        return parsedResponse;
      } catch (parseError) {
        console.error('❌ Error parsing Gemini response:', parseError);
        console.log('🔧 Raw response that failed to parse:', text);
        
        // Enhanced fallback analysis based on text content
        const textLower = text.toLowerCase();
        const instructionLower = instruction.toLowerCase();
        
        // Extract colors from both instruction and response
        const colors = ['red', 'blue', 'yellow', 'green', 'white', 'black', 'orange', 'purple', 'pink'];
        const detectedColor = colors.find(color => textLower.includes(color));
        const expectedColor = colors.find(color => instructionLower.includes(color));
        
        // Look for action words
        const hasTouch = textLower.includes('touch') || textLower.includes('finger') || textLower.includes('hand');
        const hasPoint = textLower.includes('point') || textLower.includes('pointing');
        const hasHold = textLower.includes('hold') || textLower.includes('holding') || textLower.includes('showing');
        
        // Determine expected action type
        const expectedTouch = instructionLower.includes('touch');
        const expectedPoint = instructionLower.includes('point');
        const expectedHold = instructionLower.includes('hold') || instructionLower.includes('show');
        
        // Simple matching logic
        const colorMatch = detectedColor === expectedColor;
        const actionMatch = (expectedTouch && hasTouch) || (expectedPoint && hasPoint) || (expectedHold && hasHold);
        const isCorrect = colorMatch && actionMatch;
        
        // Generate appropriate feedback
        let feedback;
        if (isCorrect) {
          feedback = `Great job! I can see you're ${hasTouch ? 'touching' : hasPoint ? 'pointing to' : 'showing'} the ${detectedColor} object correctly!`;
        } else if (colorMatch && !actionMatch) {
          feedback = `I see the ${detectedColor} object, but try ${expectedTouch ? 'touching it with your finger' : expectedPoint ? 'pointing to it' : 'holding it up'} as instructed.`;
        } else if (!colorMatch && actionMatch) {
          feedback = `Good ${hasTouch ? 'touching' : hasPoint ? 'pointing' : 'showing'} action! Now try to find the ${expectedColor} object instead.`;
        } else {
          feedback = `I can see you're trying! Look for the ${expectedColor} object and ${expectedTouch ? 'touch it' : expectedPoint ? 'point to it' : 'hold it up'} as instructed.`;
        }
        
        return {
          objectsDetected: [detectedColor || "various objects"],
          userAction: `${hasTouch ? 'touching' : hasPoint ? 'pointing to' : hasHold ? 'holding' : 'showing'} ${detectedColor || 'an object'}`,
          isCorrect: isCorrect,
          feedback: feedback,
          confidence: 0.6
        };
      }
    } catch (error) {
      console.error('❌ Error in analyzeUserAction:', error);
      console.error('❌ Error details:', error.message);
      
      // Provide more specific error feedback
      if (error.message.includes('404')) {
        throw new Error('AI model not available. Please check your setup.');
      } else if (error.message.includes('403')) {
        throw new Error('API access denied. Check your API key and billing.');
      } else if (error.message.includes('429')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else {
        throw new Error(`AI analysis failed: ${error.message}`);
      }
    }
  }

  // Test the API connection
  async testConnection() {
    try {
      console.log('🧪 Testing Gemini API connection...');
      
      const result = await this.model.generateContent("Hello, can you respond with 'API test successful'?");
      const response = await result.response;
      const text = response.text();
      
      console.log('✅ API test response:', text);
      return { success: true, response: text };
    } catch (error) {
      console.error('❌ API test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate hints for struggling users
  async generateHint(instruction, previousAttempts) {
    try {
      const prompt = `A user is struggling with this learning task: "${instruction}"

Their previous attempts: ${JSON.stringify(previousAttempts)}

Provide a helpful, encouraging hint that guides them toward success without giving away the answer completely.
Keep it specific and actionable.

Return just the hint text, no JSON formatting needed.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating hint:', error);
      return "Try looking more carefully at the objects around you and think about what the instruction is asking you to do.";
    }
  }
}
