// Test course generation with mock data
const fs = require('fs');

// Create a test file
const testContent = `This is a test knowledge base for course generation. 
It contains information about software development best practices and testing methodologies.
Key topics include:
- Unit testing principles
- Integration testing strategies  
- Test-driven development
- Code quality metrics
- Automated testing frameworks`;

fs.writeFileSync('/tmp/test-kb.txt', testContent);

console.log('Test file created. You can now test course generation through the UI by:');
console.log('1. Going to http://localhost:3000');
console.log('2. Logging in as a curator');
console.log('3. Going to Library page');
console.log('4. Clicking "Create Training"');
console.log('5. Uploading the file: /tmp/test-kb.txt');
console.log('6. Setting title to "Test Course"');
console.log('7. Clicking Create');
console.log('');
console.log('Expected behavior:');
console.log('- PDF parsing should now work (we fixed the format support)');
console.log('- AI logs should be created in the database');
console.log('- Course content should be generated (using fallback since GigaChat credentials need updating)');