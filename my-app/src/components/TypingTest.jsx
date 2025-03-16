"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const TypingTest = ({ onComplete }) => {
  const [inputText, setInputText] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [isTestComplete, setIsTestComplete] = useState(false);
  const [averageWPM, setAverageWPM] = useState(0);
  const inputRef = useRef(null);

  const typingPrompt = {
    text: `Before starting the exam, please type out this sample text to verify your system configuration:

In computer science, algorithms and data structures form the foundation of efficient problem-solving. An algorithm is a step-by-step procedure for solving a problem, while data structures organize and store data in ways that enable efficient access and modification. Understanding these concepts is crucial for writing optimized code and developing scalable applications. Common data structures include arrays, linked lists, trees, and graphs, each with their own advantages and use cases. Similarly, different algorithmic approaches like divide-and-conquer, dynamic programming, and greedy algorithms help solve complex computational problems effectively.`,
    placeholder: "Type the text here to continue..."
  };

  const calculateWPM = (text, timeInSeconds) => {
    if (timeInSeconds === 0) return 0;
    const words = text.trim().split(/\s+/).length;
    const minutes = timeInSeconds / 60;
    return Math.round(words / minutes);
  };

  const handleInputChange = (e) => {
    if (!startTime) {
      setStartTime(Date.now());
    }
    setInputText(e.target.value);
  };

  const handleComplete = () => {
    if (inputText.trim().length === 0) return;

    const endTime = Date.now();
    const timeInSeconds = (endTime - startTime) / 1000;
    const wpm = calculateWPM(inputText, timeInSeconds);

    setAverageWPM(wpm);
    setIsTestComplete(true);
    
    // Call onComplete with the results
    onComplete({
      typingResults: [{
        text: inputText,
        wpm: wpm,
        timeInSeconds: timeInSeconds
      }],
      averageWPM: wpm,
      timestamp: new Date().toISOString(),
      details: {
        totalWords: inputText.trim().split(/\s+/).length,
        totalTime: timeInSeconds,
        baseline_wpm: wpm
      }
    });
  };

  const handleKeyPress = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleComplete();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto p-6 bg-white/10 backdrop-blur-lg rounded-xl"
    >
      <h2 className="text-2xl font-bold text-white mb-6">System Verification</h2>
      {!isTestComplete ? (
        <>
          <div className="mb-6">
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <p className="text-lg text-blue-50 whitespace-pre-wrap font-mono">
                {typingPrompt.text}
              </p>
            </div>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              className="w-full h-48 bg-white/5 text-white rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder={typingPrompt.placeholder}
              autoFocus
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-blue-50/90">
              Press Ctrl+Enter when finished
            </p>
            <button
              onClick={handleComplete}
              disabled={inputText.trim().length === 0}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="text-xl text-green-400 mb-4">✓ System verification complete!</p>
          <p className="text-blue-50">
            You may now proceed with the exam
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TypingTest; 