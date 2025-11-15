const fs = require('fs');
const content = fs.readFileSync('node_modules/typeorm/src/persistence/SubjectExecutor.ts', 'utf8');
const lines = content.split('\n');

// Find the broadcastBeforeEventsForAll method
let methodStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('broadcastBeforeEventsForAll')) {
    methodStart = i;
    break;
  }
}

if (methodStart >= 0) {
  console.log('Method starts at line:', methodStart + 1);
  // Print the method
  for (let i = methodStart; i < Math.min(methodStart + 30, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
