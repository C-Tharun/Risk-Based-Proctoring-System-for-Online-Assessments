class AIDetectionService {
  async detectAIContent(content) {
    try {
      console.log('AIDetectionService: Starting content analysis');
      
      if (!content) {
        console.error('AIDetectionService: No content provided');
        throw new Error('Content is required for AI detection');
      }

      console.log('AIDetectionService: Making API request');
      const response = await fetch('/api/ai-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      console.log('AIDetectionService: Received response with status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AIDetectionService: API error response:', errorData);
        throw new Error(
          errorData.message || 
          errorData.error || 
          `HTTP error! status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log('AIDetectionService: Successfully parsed response:', result);

      // Validate the response format
      if (!result || typeof result.confidenceScore !== 'number') {
        console.error('AIDetectionService: Invalid response format:', result);
        throw new Error('Invalid response format from AI detection service');
      }

      return {
        confidenceScore: result.confidenceScore,
        explanation: result.explanation || 'No explanation provided',
        isAIGenerated: Boolean(result.isAIGenerated)
      };
    } catch (error) {
      console.error('AIDetectionService: Error in detection:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // Return a default response in case of error
      return {
        confidenceScore: 0,
        explanation: `Unable to perform AI detection: ${error.message}`,
        isAIGenerated: false,
        error: true
      };
    }
  }
}

// Create and export a singleton instance
export const aiDetectionService = new AIDetectionService(); 