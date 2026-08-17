const rawJson = `{
  "category": "fact",
  "key": "Stundenplan",
  "value": "Montag: Turnen\nDienstag: Mathe"
}`;

// simulate unescaped newlines as if read from string literal in source
const brokenJson = rawJson.replace(/\\n/g, '\n');

let inString = false;
let isEscaped = false;
let cleanedJson = '';
for (let i = 0; i < brokenJson.length; i++) {
  const char = brokenJson[i];
  if (inString) {
    if (char === '"' && !isEscaped) {
      inString = false;
      cleanedJson += char;
    } else if (char === '\\') {
      isEscaped = !isEscaped;
      cleanedJson += char;
    } else if (char === '\n') {
      cleanedJson += '\\n';
      isEscaped = false;
    } else if (char === '\r') {
      isEscaped = false; // ignorieren
    } else if (char === '\t') {
      cleanedJson += '\\t';
      isEscaped = false;
    } else {
      cleanedJson += char;
      isEscaped = false;
    }
  } else {
    if (char === '"') inString = true;
    cleanedJson += char;
  }
}

console.log('Cleaned:', cleanedJson);
try {
  JSON.parse(cleanedJson);
  console.log('Success!');
} catch (e) {
  console.error('Error:', e);
}
