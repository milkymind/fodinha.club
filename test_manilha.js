const VALUES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

function getNextManilha(carta) {
  console.log(`Input card: "${carta}"`);
  const value = carta.substring(0, carta.length - 1);
  console.log(`Extracted value: "${value}"`);
  const valueIndex = VALUES.indexOf(value);
  console.log(`Value index in array: ${valueIndex}`);
  const nextIndex = (valueIndex + 1) % VALUES.length;
  console.log(`Next index: ${nextIndex}`);
  const result = VALUES[nextIndex];
  console.log(`Result manilha: "${result}"`);
  return result;
}

// Test with the card from the screenshot
console.log('=== Testing with 7♦ ===');
const result1 = getNextManilha('7♦');
console.log(`Final result: ${result1}`);

console.log('\n=== Testing with some other cards ===');
console.log(`4♥ -> ${getNextManilha('4♥')}`);
console.log(`Q♠ -> ${getNextManilha('Q♠')}`);
console.log(`3♣ -> ${getNextManilha('3♣')}`); 