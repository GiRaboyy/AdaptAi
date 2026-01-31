#!/usr/bin/env node

/**
 * Quick test script for roleplay voice endpoints
 * 
 * Usage: node test-roleplay.js
 */

const BASE_URL = 'http://localhost:5000';

async function testScenarioGeneration() {
  console.log('\n=== Testing Scenario Generation ===\n');
  
  const response = await fetch(`${BASE_URL}/api/roleplay/generate-scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: 1,
      courseTitle: 'Retail Sales Training',
      employeeRole: 'Продавец-консультант',
      kbChunkIds: []
    })
  });

  if (!response.ok) {
    console.error('❌ Scenario generation failed:', response.status);
    const error = await response.json();
    console.error('Error details:', error);
    return null;
  }

  const data = await response.json();
  console.log('✅ Scenario generated successfully');
  console.log('Situation:', data.scenario.situation);
  console.log('Role:', data.scenario.employee_role);
  console.log('Goal:', data.scenario.goal);
  console.log('Rules:', data.scenario.rules);
  console.log('AI Opening:', data.scenario.ai_opening_line);
  
  return data.scenario;
}

async function testNextTurn(scenario) {
  console.log('\n=== Testing Next Turn Generation ===\n');
  
  const conversationHistory = [
    { role: 'ai', text: scenario.ai_opening_line },
    { role: 'employee', text: 'Понимаю ваше недовольство. Расскажите, что случилось?' }
  ];

  const response = await fetch(`${BASE_URL}/api/roleplay/next-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: 1,
      stepId: 10,
      scenario,
      conversationHistory,
      turnNumber: 3,
      kbChunkIds: []
    })
  });

  if (!response.ok) {
    console.error('❌ Next turn generation failed:', response.status);
    const error = await response.json();
    console.error('Error details:', error);
    return null;
  }

  const data = await response.json();
  console.log('✅ Next turn generated successfully');
  console.log('AI Reply:', data.reply_text);
  console.log('Should Escalate:', data.should_escalate);
  
  return data.reply_text;
}

async function testEvaluation(scenario) {
  console.log('\n=== Testing Evaluation ===\n');
  
  const fullConversation = [
    { role: 'ai', text: scenario.ai_opening_line },
    { role: 'employee', text: 'Понимаю ваше недовольство. Расскажите подробнее, что произошло?' },
    { role: 'ai', text: 'Я купил этот товар вчера, а сегодня он не работает!' },
    { role: 'employee', text: 'Давайте проверим чек и посмотрим, что можно сделать.' },
    { role: 'ai', text: 'Вот чек. И что теперь?' },
    { role: 'employee', text: 'Мы можем оформить обмен или возврат согласно правилам магазина.' }
  ];

  const response = await fetch(`${BASE_URL}/api/roleplay/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: 1,
      stepId: 10,
      scenario,
      fullConversation,
      kbChunkIds: []
    })
  });

  if (!response.ok) {
    console.error('❌ Evaluation failed:', response.status);
    const error = await response.json();
    console.error('Error details:', error);
    return;
  }

  const data = await response.json();
  console.log('✅ Evaluation completed successfully');
  console.log('Score:', data.score_0_10, '/10');
  console.log('Verdict:', data.verdict);
  console.log('Strengths:', data.strengths);
  console.log('Improvements:', data.improvements);
  console.log('Better Example:', data.better_example);
}

async function runTests() {
  try {
    console.log('🚀 Starting Roleplay API Tests...\n');
    console.log('Base URL:', BASE_URL);
    
    // Test 1: Generate scenario
    const scenario = await testScenarioGeneration();
    if (!scenario) {
      console.error('\n❌ Cannot continue tests without scenario');
      return;
    }

    // Test 2: Generate next turn
    await testNextTurn(scenario);

    // Test 3: Evaluate roleplay
    await testEvaluation(scenario);

    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { testScenarioGeneration, testNextTurn, testEvaluation };
