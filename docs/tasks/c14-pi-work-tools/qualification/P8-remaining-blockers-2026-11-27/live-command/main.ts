// Meteor Dodge Command - Canvas Game
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');

// Draw background
context.fillStyle = '#07152c';
context.fillRect(0, 0, canvas.width, canvas.height);

// Draw title "Meteor Dodge Command" on the canvas
context.fillStyle = '#e5f5ff';
context.font = 'bold 36px Arial';
context.fillText('Meteor Dodge Command', 80, 64);

// Draw a simple ship at the bottom
const shipX = canvas.width / 2;
const shipY = canvas.height - 40;
context.fillStyle = '#4fc3f7';
context.beginPath();
context.moveTo(shipX, shipY - 20);
context.lineTo(shipX - 15, shipY + 10);
context.lineTo(shipX + 15, shipY + 10);
context.closePath();
context.fill();

// Draw some falling meteors
const meteors = [
  { x: 120, y: 80, r: 12 },
  { x: 320, y: 140, r: 16 },
  { x: 500, y: 100, r: 10 },
];

context.fillStyle = '#a1887f';
meteors.forEach(m => {
  context.beginPath();
  context.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  context.fill();
});
