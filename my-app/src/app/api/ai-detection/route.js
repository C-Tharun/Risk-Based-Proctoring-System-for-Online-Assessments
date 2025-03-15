import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Log the start of the request
    console.log('AI Detection API: Starting request processing');

    // Parse request body and validate content
    let content;
    try {
      const body = await request.json();
      content = body.content;
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!content) {
      console.error('No content provided in request');
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Validate API key
    if (!process.env.SAPLING_API_KEY) {
      console.error('Sapling API key not found in environment variables');
      return NextResponse.json(
        { error: 'Sapling API key not configured' },
        { status: 500 }
      );
    }

    // Make API call to Sapling AI
    console.log('Making request to Sapling AI API');
    const response = await fetch('https://api.sapling.ai/api/v1/aidetect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SAPLING_API_KEY}`
      },
      body: JSON.stringify({
        text: content,
        key: process.env.SAPLING_API_KEY
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Sapling API error:', errorData);
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const saplingResponse = await response.json();
    console.log('Raw Sapling response:', saplingResponse);

    // Transform Sapling response to our format
    const structuredResponse = {
      confidenceScore: Math.round(saplingResponse.score * 100), // Convert probability to percentage
      explanation: saplingResponse.message || 'Analysis completed',
      isAIGenerated: saplingResponse.score > 0.7 // Consider it AI-generated if probability > 0.7
    };

    console.log('Sending final response:', structuredResponse);
    return NextResponse.json(structuredResponse);

  } catch (error) {
    console.error('Critical error in AI detection API:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        type: error.name
      },
      { status: 500 }
    );
  }
} 