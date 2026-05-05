const [topic = 'unknown-topic', ...evidence] = process.argv.slice(2);

console.log(`topic: ${topic}`);
if (evidence.length === 0) {
  console.log('evidence: (none)');
  process.exit(0);
}

console.log('evidence:');
for (const item of evidence) {
  console.log(`- ${item}`);
}
