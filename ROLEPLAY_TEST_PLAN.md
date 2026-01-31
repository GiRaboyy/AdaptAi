/**
 * Manual Test Plan for Roleplay Voice-to-Voice Feature
 * 
 * This document outlines the test scenarios to verify the roleplay feature works correctly.
 */

## Test Prerequisites

1. Backend server running
2. Frontend client running
3. User logged in as employee
4. Course with roleplay step exists

## Test Scenario 1: Scenario Generation

**Endpoint:** POST /api/roleplay/generate-scenario

**Test Data:**
```json
{
  "trackId": 1,
  "courseTitle": "Retail Sales Training",
  "employeeRole": "Продавец-консультант",
  "kbChunkIds": []
}
```

**Expected Response:**
```json
{
  "scenario": {
    "situation": "1-2 sentence description",
    "employee_role": "Вы — продавец-консультант",
    "goal": "Clear objective",
    "rules": ["rule 1", "rule 2", "rule 3"],
    "ai_role": "Клиент",
    "turns_total": 6,
    "ai_opening_line": "Customer opening statement"
  }
}
```

**Validation:**
- ✅ Response has all required fields
- ✅ Rules array has 1-3 items
- ✅ turns_total is 6
- ✅ Text is in Russian

---

## Test Scenario 2: Next AI Turn Generation

**Endpoint:** POST /api/roleplay/next-turn

**Test Data:**
```json
{
  "trackId": 1,
  "stepId": 10,
  "scenario": {
    "situation": "Клиент недоволен качеством товара",
    "employee_role": "Вы — продавец-консультант",
    "goal": "Снять напряжение, уточнить проблему",
    "rules": ["Не спорить", "Уточнить детали"],
    "ai_role": "Клиент",
    "turns_total": 6,
    "ai_opening_line": "Я хочу вернуть этот товар!"
  },
  "conversationHistory": [
    { "role": "ai", "text": "Я хочу вернуть этот товар!" },
    { "role": "employee", "text": "Понимаю ваше недовольство. Что случилось?" }
  ],
  "turnNumber": 3
}
```

**Expected Response:**
```json
{
  "reply_text": "AI customer reply (1-3 sentences)",
  "should_escalate": false,
  "escalation_reason": ""
}
```

**Validation:**
- ✅ reply_text is not empty
- ✅ Reply is contextually appropriate
- ✅ Reply is 1-3 sentences
- ✅ AI responds naturally to employee's empathy

---

## Test Scenario 3: Roleplay Evaluation

**Endpoint:** POST /api/roleplay/evaluate

**Test Data:**
```json
{
  "trackId": 1,
  "stepId": 10,
  "scenario": {
    "situation": "Клиент недоволен качеством товара",
    "employee_role": "Вы — продавец-консультант",
    "goal": "Снять напряжение, уточнить проблему",
    "rules": ["Не спорить", "Уточнить детали"],
    "ai_role": "Клиент",
    "turns_total": 6,
    "ai_opening_line": "Я хочу вернуть этот товар!"
  },
  "fullConversation": [
    { "role": "ai", "text": "Я хочу вернуть этот товар!" },
    { "role": "employee", "text": "Понимаю ваше недовольство. Что случилось?" },
    { "role": "ai", "text": "Купил вчера, а сегодня не работает!" },
    { "role": "employee", "text": "Давайте проверим чек и посмотрим на товар." },
    { "role": "ai", "text": "Вот чек. Что теперь?" },
    { "role": "employee", "text": "Я оформлю обмен или возврат по правилам магазина." }
  ]
}
```

**Expected Response:**
```json
{
  "score_0_10": 7,
  "verdict": "Хорошо",
  "strengths": ["Выразили эмпатию", "Задали уточняющий вопрос"],
  "improvements": ["Можно было упомянуть гарантию"],
  "better_example": "Понимаю, это неприятно. Давайте проверим чек и гарантийный талон..."
}
```

**Validation:**
- ✅ score_0_10 is between 0-10
- ✅ verdict matches score range
- ✅ strengths array has 1-3 items
- ✅ improvements array has 1-3 items
- ✅ better_example is provided

---

## Test Scenario 4: Frontend Integration

**Test Steps:**

1. **Scenario Phase**
   - [ ] Scenario card displays with 4 sections (Ситуация, Роль, Цель, Правила)
   - [ ] "Озвучить сценарий" button is visible
   - [ ] Clicking speaker button plays TTS
   - [ ] "Начать диалог" button works
   - [ ] After TTS completes, dialogue auto-starts after 2 seconds

2. **Dialogue Phase**
   - [ ] AI opening line appears in transcript
   - [ ] AI message plays via TTS automatically
   - [ ] Microphone button becomes active after AI speaks
   - [ ] Clicking mic button starts recording (red color, pulsing)
   - [ ] Live transcript appears while speaking
   - [ ] Stopping recording submits employee response
   - [ ] Employee message appears in transcript (right-aligned, green)
   - [ ] AI generates next turn automatically
   - [ ] Turn counter displays correctly (e.g., "Реплика 2/3 (вы) • Диалог 4/6")
   - [ ] "Ввести текстом" fallback works
   - [ ] Text input mode allows typing and sending
   - [ ] "Повторить" button on AI messages replays audio

3. **Feedback Phase**
   - [ ] After 6th turn, feedback panel appears
   - [ ] Score badge displays (e.g., "7/10")
   - [ ] Verdict label matches score (Слабовато/Нормально/Хорошо/Отлично)
   - [ ] Strengths section shows with checkmark icon
   - [ ] Improvements section shows with warning icon
   - [ ] Better example shows with lightbulb icon
   - [ ] "Попробовать снова" button resets to scenario phase
   - [ ] "Далее" button advances to next step

4. **Audio Controls Cleanup**
   - [ ] Content steps have NO audio controls
   - [ ] Quiz steps have NO audio controls
   - [ ] Open steps have voice input (existing) but no TTS button
   - [ ] Only roleplay steps have full voice suite
   - [ ] Voice toggle button removed from header

---

## Test Scenario 5: Error Handling

**Test Cases:**

1. **LLM Fails to Generate Scenario**
   - Expected: 500 error with message
   - Frontend should show error toast

2. **LLM Fails to Generate Next Turn**
   - Expected: Fallback AI response "Понятно. Продолжим диалог."
   - Dialogue continues

3. **LLM Fails to Evaluate**
   - Expected: Fallback evaluation with score 5
   - Feedback shows "Не удалось выполнить полную оценку"

4. **Speech Recognition Not Supported**
   - Expected: Fallback to text input automatically
   - Shows textarea instead of mic button

5. **Conversation History Wrong Length**
   - Expected: 400 error "must contain exactly 6 turns"

---

## Test Scenario 6: Knowledge Base Integration

**Setup:**
- Create course with KB containing refund policy
- Generate roleplay scenario with kbChunkIds

**Test:**
1. AI customer mentions refund
2. Employee references KB policy
3. Evaluation checks alignment with KB

**Expected:**
- AI doesn't invent policies
- Evaluation praises KB alignment
- If KB lacks info, evaluation flags "Не хватило данных о правилах"

---

## Performance Tests

**Metrics to Verify:**

| Metric | Target | Actual |
|--------|--------|--------|
| Scenario TTS duration | < 30s | ___ |
| AI turn latency | < 3s | ___ |
| STT processing lag | < 500ms | ___ |
| Evaluation latency | < 5s | ___ |

---

## Accessibility Tests

**Checklist:**

- [ ] All buttons have aria-labels
- [ ] Transcript messages are screen-reader accessible
- [ ] Keyboard navigation works (Tab through buttons)
- [ ] Text fallback available for all voice interactions
- [ ] Visual indicators for recording state (color + animation)
- [ ] Processing spinner shows during waits

---

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Speech Recognition Support:**
- Chrome: ✅
- Firefox: ❌ (fallback to text)
- Safari: ✅
- Edge: ✅

---

## Notes

- Voice recognition quality varies by browser and microphone
- Russian language STT works best in Chrome
- TTS voice quality depends on system voices
- Background noise can affect recognition accuracy
